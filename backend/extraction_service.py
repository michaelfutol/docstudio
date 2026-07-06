import os
import json
from sqlalchemy.orm import Session
import models
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

def extract_structured_data(db: Session, document_id: int, template_id: int):
    doc = db.query(models.Document).filter(models.Document.id == document_id).first()
    template = db.query(models.Template).filter(models.Template.id == template_id).first()
    
    if not doc or not template:
        return None

    # Update document status
    doc.status = "extracting"
    doc.extraction_progress = "Initializing extraction..."
    db.commit()

    # Fetch all pages
    pages = db.query(models.DocumentPage).filter(models.DocumentPage.document_id == document_id).order_by(models.DocumentPage.page_number).all()
    full_text = "\n\n".join([f"--- Page {p.page_number} ---\n{p.text_content}" for p in pages if p.text_content])

    api_key = os.getenv("GEMINI_API_KEY")
    
    has_images = any(p.image_path and os.path.exists(p.image_path) for p in pages)
    
    # If API key is not set or there's absolutely no text and no images, fallback to mock data
    if not api_key or "YOUR_GEMINI_API_KEY_HERE" in api_key or (not full_text and not has_images):
        # Mocking extraction based on the template schema dynamically
        def generate_mock_value(schema_node, field_name=""):
            node_type = schema_node.get("type", "string")
            if node_type == "object":
                props = schema_node.get("properties", {})
                return {k: generate_mock_value(v, k) for k, v in props.items()}
            elif node_type == "array":
                items_schema = schema_node.get("items", {"type": "string"})
                return [generate_mock_value(items_schema, field_name)]
            elif node_type == "number" or node_type == "integer":
                return 42
            elif node_type == "boolean":
                return True
            else:
                return f"Mock {field_name.capitalize()}" if field_name else "Mock Value"
                
        def generate_confidences(data, prefix=""):
            confs = {}
            if isinstance(data, dict):
                for k, v in data.items():
                    key_path = f"{prefix}.{k}" if prefix else k
                    if isinstance(v, dict):
                        confs.update(generate_confidences(v, key_path))
                    elif isinstance(v, list):
                        confs.update(generate_confidences(v, key_path))
                    else:
                        confs[key_path] = 0.99
            elif isinstance(data, list):
                confs[prefix] = 0.99
            return confs

        schema = template.schema_json if template.schema_json else {"type": "object"}
        mock_extracted_data = generate_mock_value(schema)
        mock_confidences = generate_confidences(mock_extracted_data)
        
        # Merge confidences back in if it's an object
        if isinstance(mock_extracted_data, dict):
            mock_extracted_data["field_confidences"] = mock_confidences

        record = models.ExtractedRecord(
            document_id=doc.id,
            template_id=template.id,
            record_data=mock_extracted_data,
            confidence=0.99,
            needs_review=False,
            status="pending"
        )
        db.add(record)
        doc.status = "pending_review"
        db.commit()
        db.refresh(record)
        return record

    # Real AI Extraction via Google Gemini
    import time
    client = genai.Client(api_key=api_key)
    
    # Check if this is a transcription template
    schema = template.schema_json if template.schema_json else {"type": "object", "properties": {}}
    is_transcription = "full_transcription" in schema.get("properties", {})
    is_tabular = template.validation_rules and template.validation_rules.get("is_tabular", False)
    
    # Merge overall_confidence into the expected response schema so Gemini understands it's strictly required
    if "properties" in schema:
        schema["properties"]["overall_confidence"] = {
            "type": "number",
            "description": "Overall confidence score for the extraction between 0.0 and 1.0"
        }

    # Chunking logic
    CHUNK_SIZE = 10
    chunks = [pages[i:i + CHUNK_SIZE] for i in range(0, len(pages), CHUNK_SIZE)]
    
    merged_data = {}
    all_confidences = []
    
    try:
        from PIL import Image
        for idx, chunk in enumerate(chunks):
            # Update progress
            chunk_num = idx + 1
            total_chunks = len(chunks)
            if total_chunks > 1:
                est_seconds = (total_chunks - chunk_num) * 5
                est_str = f"{est_seconds // 60} mins {est_seconds % 60} secs" if est_seconds >= 60 else f"{est_seconds} secs"
                doc.extraction_progress = f"Processing chunk {chunk_num} of {total_chunks}... Estimated time remaining: {est_str}"
            else:
                doc.extraction_progress = "Processing document with AI..."
            db.commit()
            
            chunk_text = "\n\n".join([f"--- Page {p.page_number} ---\n{p.text_content}" for p in chunk if p.text_content])
            
            if is_transcription:
                prompt = f"""You are a highly precise document transcription assistant. Your sole task is to perfectly transcribe the following document text into the 'full_transcription' field.
CRITICAL RULES:
1. PRESERVE ALL LAYOUT, spacing, paragraphs, and line breaks exactly as they appear.
2. Do NOT summarize. Do NOT skip anything.
3. If there are tables or columns, try to format them clearly using spaces or markdown.
4. Provide an 'overall_confidence' score (0.0 to 1.0).

Raw Document Text:
{chunk_text}
"""
            else:
                tabular_instructions = ""
                if is_tabular:
                    tabular_instructions = """
CRITICAL TABULAR EXTRACTION RULES:
This is a tabular data extraction task (e.g. Material Schedule, Invoice Line Items).
You MUST extract every single row or line item found in the document into the 'data' array.
Do NOT summarize or miss any rows. Output the data exactly as it appears in the table.
"""
                prompt = f"""You are a data extraction assistant.
Extract the structured data from the following document text according to the provided JSON schema.
{tabular_instructions}
Also, please provide an 'overall_confidence' score between 0.0 and 1.0 at the root of your JSON response.

Raw Document Text:
{chunk_text}
"""
            
            openrouter_key = os.getenv("OPENROUTER_API_KEY")
            if openrouter_key:
                import base64
                from openai import OpenAI
                or_client = OpenAI(base_url="https://openrouter.ai/api/v1", api_key=openrouter_key)
                
                content = [{"type": "text", "text": prompt}]
                for p in chunk:
                    if p.image_path and os.path.exists(p.image_path):
                        try:
                            with open(p.image_path, "rb") as image_file:
                                encoded = base64.b64encode(image_file.read()).decode("utf-8")
                                ext = os.path.splitext(p.image_path)[1].lower()
                                mime_type = "image/png" if ext == ".png" else "image/jpeg"
                                content.append({
                                    "type": "image_url",
                                    "image_url": {
                                        "url": f"data:{mime_type};base64,{encoded}"
                                    }
                                })
                        except Exception as e:
                            print(f"Failed to load image for OpenRouter: {e}")
                
                response = or_client.chat.completions.create(
                  model="google/gemini-2.5-flash",
                  messages=[{"role": "user", "content": content}],
                  response_format={"type": "json_schema", "json_schema": {"name": "extraction", "schema": schema, "strict": False}}
                )
                raw_content = response.choices[0].message.content
                try:
                    extracted_json = json.loads(raw_content, strict=False)
                except json.JSONDecodeError:
                    import re
                    match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', raw_content)
                    if match:
                        extracted_json = json.loads(match.group(1), strict=False)
                    else:
                        raise ValueError(f"Could not parse JSON from response: {raw_content}")
            else:
                client = genai.Client(api_key=api_key)
                contents = [prompt]
                from PIL import Image
                for p in chunk:
                    if p.image_path and os.path.exists(p.image_path):
                        try:
                            img = Image.open(p.image_path)
                            contents.append(img)
                        except Exception as e:
                            print(f"Failed to load image for Gemini: {e}")
                
                response = client.models.generate_content(
                    model='gemini-2.5-flash',
                    contents=contents,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        response_schema=schema
                    ),
                )
                extracted_json = json.loads(response.text)
            
            # Merge logic
            if is_transcription:
                if "full_transcription" in extracted_json:
                    if "full_transcription" not in merged_data:
                        merged_data["full_transcription"] = ""
                    merged_data["full_transcription"] += extracted_json["full_transcription"] + "\n\n"
            else:
                if is_tabular and "data" in extracted_json:
                    if "data" not in merged_data:
                        merged_data["data"] = []
                    merged_data["data"].extend(extracted_json["data"])
                    # For other fields, take the first chunk's values
                    for k, v in extracted_json.items():
                        if k not in ["data", "overall_confidence"] and k not in merged_data:
                            merged_data[k] = v
                else:
                    # General merge: just overwrite or fill missing
                    for k, v in extracted_json.items():
                        if k != "overall_confidence" and k not in merged_data:
                            merged_data[k] = v
                            
            if "overall_confidence" in extracted_json:
                all_confidences.append(extracted_json["overall_confidence"])
                    
            if idx < total_chunks - 1:
                time.sleep(5) # Respect Gemini free tier limits (15 requests per minute -> 4s minimum, using 5s to be safe)
                
        # Finalize
        confidence = sum(all_confidences) / len(all_confidences) if all_confidences else 0.90
        needs_review = any(c < 0.95 for c in all_confidences) if all_confidences else True
        
        # Generate mock confidences if none exist
        if not all_confidences:
            merged_data["field_confidences"] = {"overall": 0.90}
        else:
            merged_data["field_confidences"] = {"overall": confidence}

        record = models.ExtractedRecord(
            document_id=doc.id,
            template_id=template.id,
            record_data=merged_data,
            confidence=confidence,
            needs_review=needs_review,
            status="pending"
        )
        db.add(record)
        doc.status = "pending_review"
        doc.extraction_progress = "Complete!"
        db.commit()
        db.refresh(record)
        return record

    except Exception as e:
        print(f"Extraction failed: {e}")
        doc.status = "processed"
        doc.extraction_progress = f"Failed: {str(e)}"
        db.commit()
        return None

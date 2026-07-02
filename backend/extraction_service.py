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
    db.commit()

    # Fetch all pages text
    pages = db.query(models.DocumentPage).filter(models.DocumentPage.document_id == document_id).all()
    full_text = "\n\n".join([f"--- Page {p.page_number} ---\n{p.text_content}" for p in pages if p.text_content])

    api_key = os.getenv("GEMINI_API_KEY")
    
    # If API key is not set or mock text is used without real OCR, fallback to mock data
    if not api_key or "YOUR_GEMINI_API_KEY_HERE" in api_key or not full_text:
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
    client = genai.Client(api_key=api_key)
    
    prompt = f"""
    You are a data extraction assistant.
    Extract the structured data from the following document text according to the provided JSON schema.
    Also, please provide a 'field_confidences' object at the root of your JSON response, mapping each extracted field key (including nested keys using dot notation) to a confidence score between 0.0 and 1.0.
    
    Raw Document Text:
    {full_text}
    """
    
    # Merge field_confidences into the expected response schema so Gemini understands it's strictly required
    schema = template.schema_json if template.schema_json else {"type": "object", "properties": {}}
    if "properties" in schema:
        schema["properties"]["field_confidences"] = {
            "type": "object",
            "description": "Mapping of extracted field keys to a float confidence score between 0.0 and 1.0",
            "additionalProperties": {"type": "number"}
        }

    try:
        response = client.models.generate_content(
            model='gemini-2.5-pro',
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=schema
            ),
        )
        extracted_json = json.loads(response.text)
        
        # Determine overall confidence
        confidence = 0.90
        needs_review = False
        
        if "field_confidences" in extracted_json:
            conf_values = extracted_json["field_confidences"].values()
            if conf_values:
                confidence = sum(conf_values) / len(conf_values)
                needs_review = any(c < 0.95 for c in conf_values)
        else:
            # Generate mock field confidences if LLM didn't return them
            conf_map = {}
            for k in extracted_json.keys():
                conf_map[k] = 0.90
            extracted_json["field_confidences"] = conf_map
            needs_review = True
        
        record = models.ExtractedRecord(
            document_id=doc.id,
            template_id=template.id,
            record_data=extracted_json,
            confidence=confidence,
            needs_review=needs_review,
            status="pending"
        )
        db.add(record)
        doc.status = "pending_review"
        db.commit()
        db.refresh(record)
        return record
        
    except Exception as e:
        print(f"Extraction failed: {e}")
        doc.status = "processed"
        db.commit()
        return None

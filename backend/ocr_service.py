import os
import io
import fitz  # PyMuPDF
from PIL import Image
from sqlalchemy.orm import Session
import models
from pypdf import PdfWriter, PdfReader

def process_document_ocr(db: Session, document_id: int):
    """
    Background task to process a document.
    Replaced heavy Tesseract/Poppler with PyMuPDF for lightning-fast native PDF parsing.
    """
    doc = db.query(models.Document).filter(models.Document.id == document_id).first()
    if not doc:
        return

    doc.status = "processing"
    db.commit()

    try:
        file_ext = os.path.splitext(doc.file_path)[1].lower()
        full_text = []

        if file_ext == '.pdf':
            pdf_document = fitz.open(doc.file_path)
            for page_num in range(len(pdf_document)):
                page = pdf_document.load_page(page_num)
                
                # Render to image for UI
                pix = page.get_pixmap(dpi=150)
                img_data = pix.tobytes("png")
                
                base_dir = os.path.dirname(doc.file_path)
                base_name = os.path.basename(doc.file_path).replace('.pdf', '')
                image_filename = f"{base_name}_page_{page_num + 1}.png"
                image_path = os.path.join(base_dir, image_filename)
                
                with open(image_path, "wb") as f:
                    f.write(img_data)
                
                # Extract embedded page images for the recreated book
                try:
                    exports_dir = os.path.join("exports", str(doc.id))
                    images_dir = os.path.join(exports_dir, "images")
                    os.makedirs(images_dir, exist_ok=True)
                    
                    image_list = page.get_images(full=True)
                    for img_idx, img in enumerate(image_list):
                        xref = img[0]
                        base_image = pdf_document.extract_image(xref)
                        image_bytes = base_image["image"]
                        image_ext = base_image["ext"]
                        
                        img_filename = f"page_{page_num + 1}_img_{img_idx}.{image_ext}"
                        img_filepath = os.path.join(images_dir, img_filename)
                        with open(img_filepath, "wb") as img_file:
                            img_file.write(image_bytes)
                except Exception as img_err:
                    print(f"Failed to extract embedded images on page {page_num+1}: {img_err}")
                
                # Extract text blocks
                text_dict = page.get_text("dict")
                page_text = page.get_text()
                
                # If page has no native text layer, it's a scanned PDF. Transcribe it via Gemini!
                is_scanned = not page_text.strip()
                if is_scanned:
                    try:
                        api_key = os.getenv("GEMINI_API_KEY")
                        if api_key:
                            from google import genai
                            from google.genai import types
                            from PIL import Image
                            client = genai.Client(api_key=api_key)
                            img = Image.open(image_path)
                            response = client.models.generate_content(
                                model='gemini-2.5-flash',
                                contents=[
                                    "Transcribe the text in this page image exactly, including all small print, footnotes, index tables, and cataloging details. Do not summarize or omit anything. Even if the text is very small, transcribe it verbatim. Do not add explanations or comments. Preserve line breaks.",
                                    img
                                ]
                            )
                            if response.text:
                                page_text = response.text
                    except Exception as gemini_err:
                        print(f"Gemini page transcription failed for page {page_num+1}: {gemini_err}")
                
                full_text.append(page_text)
                
                lines = []
                if is_scanned and page_text.strip():
                    lines.append({
                        "text": page_text.strip(),
                        "confidence": 0.95,
                        "bbox": [0, 0, page.rect.width, page.rect.height],
                        "needsReview": False
                    })
                else:
                    for block in text_dict.get("blocks", []):
                        for line in block.get("lines", []):
                            for span in line.get("spans", []):
                                text = span.get("text", "").strip()
                                if text:
                                    bbox = span.get("bbox")
                                    lines.append({
                                        "text": text,
                                        "confidence": 1.0, # Native PDF is 100% accurate
                                        "bbox": bbox,
                                        "needsReview": False
                                    })
                
                ocr_json = {
                    "pages": [{
                        "page": page_num + 1,
                        "confidence": 1.0,
                        "width": page.rect.width,
                        "height": page.rect.height,
                        "lines": lines
                    }]
                }

                db.add(models.DocumentPage(
                    document_id=doc.id,
                    page_number=page_num + 1,
                    image_path=image_path,
                    width=page.rect.width,
                    height=page.rect.height,
                    ocr_json=ocr_json,
                    text_content=page_text,
                    confidence=1.0
                ))
            
            pdf_document.close()
            
        else:
            # It's an image. Just save it as page 1 and let Gemini handle extraction later.
            img = Image.open(doc.file_path)
            width, height = img.size
            
            base_dir = os.path.dirname(doc.file_path)
            base_name = os.path.basename(doc.file_path).rsplit('.', 1)[0]
            image_filename = f"{base_name}_page_1.png"
            image_path = os.path.join(base_dir, image_filename)
            img.save(image_path, "PNG")
            
            ocr_json = {
                "pages": [{
                    "page": 1,
                    "confidence": 1.0,
                    "width": width,
                    "height": height,
                    "lines": [] # No lines, Gemini handles it
                }]
            }
            
            db.add(models.DocumentPage(
                document_id=doc.id,
                page_number=1,
                image_path=image_path,
                width=width,
                height=height,
                ocr_json=ocr_json,
                text_content="",
                confidence=1.0
            ))

        # Save raw text
        txt_export_path = os.path.join(os.path.dirname(doc.file_path), f"{doc.id}_raw.txt")
        with open(txt_export_path, "w", encoding="utf-8") as f:
            f.write("\n\n".join(full_text))

        doc.status = "processed"
        db.commit()

    except Exception as e:
        print(f"Processing Error: {e}")
        doc.status = "failed"
        db.commit()

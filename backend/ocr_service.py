import os
import uuid
import pytesseract
from pdf2image import convert_from_path
from PIL import Image
from sqlalchemy.orm import Session
import models
import io
from pypdf import PdfWriter, PdfReader

from dotenv import load_dotenv

load_dotenv()

# Configure tesseract path if provided in .env (for Windows dev)
tesseract_cmd = os.getenv("TESSERACT_CMD")
if tesseract_cmd:
    pytesseract.pytesseract.tesseract_cmd = tesseract_cmd

# Configure poppler path if provided in .env
POPPLER_PATH = os.getenv("POPPLER_PATH", None)

def process_document_ocr(db: Session, document_id: int):
    """
    Background task to process a document with real OCR (Tesseract).
    """
    # Fetch document
    doc = db.query(models.Document).filter(models.Document.id == document_id).first()
    if not doc:
        return

    # Update status to processing
    doc.status = "processing"
    db.commit()

    try:
        # Check if it's a PDF or Image
        file_ext = os.path.splitext(doc.file_path)[1].lower()
        images = []
        
        if file_ext == '.pdf':
            images = convert_from_path(doc.file_path, poppler_path=POPPLER_PATH)
        else:
            images = [Image.open(doc.file_path)]

        pdf_writer = PdfWriter()
        full_text = []

        for i, img in enumerate(images):
            page_num = i + 1
            width, height = img.size
            
            # Get verbose data including boxes
            data = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT)
            
            lines = []
            page_text = ""
            
            n_boxes = len(data['level'])
            current_line = []
            current_line_num = -1
            
            for j in range(n_boxes):
                if data['text'][j].strip(): # if it's a valid word
                    line_n = data['line_num'][j]
                    if line_n != current_line_num:
                        if current_line:
                            lines.append(_compile_line(current_line))
                        current_line = []
                        current_line_num = line_n
                    
                    current_line.append({
                        'text': data['text'][j],
                        'conf': float(data['conf'][j]),
                        'left': data['left'][j],
                        'top': data['top'][j],
                        'width': data['width'][j],
                        'height': data['height'][j]
                    })
                    
            if current_line:
                lines.append(_compile_line(current_line))

            for line in lines:
                page_text += line['text'] + "\n"

            full_text.append(page_text)

            # Generate searchable PDF page
            pdf_bytes = pytesseract.image_to_pdf_or_hocr(img, extension='pdf')
            pdf_reader = PdfReader(io.BytesIO(pdf_bytes))
            pdf_writer.add_page(pdf_reader.pages[0])

            # We need to serve this image to the frontend.
            # If it's a PDF, we need to save the page image.
            image_path = doc.file_path
            if file_ext == '.pdf':
                # Save the page image alongside the pdf
                base_dir = os.path.dirname(doc.file_path)
                base_name = os.path.basename(doc.file_path).replace('.pdf', '')
                image_filename = f"{base_name}_page_{page_num}.png"
                image_path = os.path.join(base_dir, image_filename)
                img.save(image_path, "PNG")

            ocr_json = {
                "pages": [{
                    "page": page_num,
                    "confidence": sum(l['confidence'] for l in lines) / len(lines) if lines else 0,
                    "width": width,
                    "height": height,
                    "lines": lines
                }]
            }

            # Create DocumentPage
            page = models.DocumentPage(
                document_id=doc.id,
                page_number=page_num,
                image_path=image_path,
                width=width,
                height=height,
                ocr_json=ocr_json,
                text_content=page_text,
                confidence=ocr_json["pages"][0]["confidence"]
            )
            db.add(page)
            
        # Save combined searchable PDF
        pdf_export_path = os.path.join(os.path.dirname(doc.file_path), f"{doc.id}_searchable.pdf")
        with open(pdf_export_path, "wb") as f:
            pdf_writer.write(f)
            
        # Save raw text
        txt_export_path = os.path.join(os.path.dirname(doc.file_path), f"{doc.id}_raw.txt")
        with open(txt_export_path, "w", encoding="utf-8") as f:
            f.write("\n\n".join(full_text))

        # Update document status
        doc.status = "processed"
        db.commit()

    except Exception as e:
        print(f"OCR Error: {e}")
        doc.status = "failed"
        db.commit()

def _compile_line(words):
    text = " ".join([w['text'] for w in words])
    conf = sum(w['conf'] for w in words) / len(words) / 100.0 # tesseract conf is 0-100
    
    left = min(w['left'] for w in words)
    top = min(w['top'] for w in words)
    right = max(w['left'] + w['width'] for w in words)
    bottom = max(w['top'] + w['height'] for w in words)
    
    return {
        "text": text,
        "confidence": conf,
        "bbox": [left, top, right, bottom],
        "needsReview": conf < 0.8
    }

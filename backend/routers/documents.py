import os
import uuid
import shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.responses import FileResponse, Response
from sqlalchemy.orm import Session
from database import get_db
import models
import schemas
from typing import Optional
from ocr_service import process_document_ocr
from extraction_service import extract_structured_data
import book_engine

router = APIRouter(prefix="/api/v1/documents", tags=["documents"])

@router.post("")
@router.post("/")
def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    project_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    # Save file
    file_ext = file.filename.split(".")[-1] if "." in file.filename else "pdf"
    file_id = str(uuid.uuid4())
    file_path = f"uploads/{file_id}.{file_ext}"
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Create document record
    doc = models.Document(
        filename=file.filename,
        file_path=file_path,
        project_id=project_id,
        status="uploaded",
        doc_type="unknown"
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # Trigger OCR background task
    background_tasks.add_task(process_document_ocr, db, doc.id)

    return {"message": "Document uploaded successfully", "document_id": doc.id}

@router.get("/{document_id}")
def get_document(document_id: int, db: Session = Depends(get_db)):
    doc = db.query(models.Document).filter(models.Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    pages = db.query(models.DocumentPage).filter(models.DocumentPage.document_id == doc.id).all()
    
    return {
        "id": doc.id,
        "filename": doc.filename,
        "status": doc.status,
        "extraction_progress": doc.extraction_progress,
        "pages": pages
    }

@router.post("/{document_id}/extract")
def trigger_extraction(
    document_id: int, 
    req: schemas.ExtractRequest, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    background_tasks.add_task(extract_structured_data, db, document_id, req.template_id)
    return {"message": "Extraction started in background"}

@router.get("/{document_id}/record")
def get_document_record(document_id: int, db: Session = Depends(get_db)):
    record = db.query(models.ExtractedRecord).filter(models.ExtractedRecord.document_id == document_id).order_by(models.ExtractedRecord.id.desc()).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    return record

@router.put("/{document_id}/pages/{page_number}/text")
def update_page_text(document_id: int, page_number: int, req: schemas.PageTextUpdate, db: Session = Depends(get_db)):
    page = db.query(models.DocumentPage).filter(
        models.DocumentPage.document_id == document_id,
        models.DocumentPage.page_number == page_number
    ).first()
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    
    page.ocr_json = req.ocr_json
    db.commit()
    return {"message": "Page text updated"}

@router.get("/{document_id}/export/searchable-pdf")
def export_searchable_pdf(document_id: int, db: Session = Depends(get_db)):
    doc = db.query(models.Document).filter(models.Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    file_ext = os.path.splitext(doc.file_path)[1].lower()
    if file_ext == ".pdf":
        if not os.path.exists(doc.file_path):
            raise HTTPException(status_code=404, detail="Original PDF file is no longer on the server. Please re-upload the document.")
            
        # We will generate a truly searchable PDF by injecting the transcribed text layer
        searchable_path = os.path.join(os.path.dirname(doc.file_path), f"{doc.id}_searchable.pdf")
        
        # Check if we need to build it (cache it for speed)
        if not os.path.exists(searchable_path):
            import fitz
            try:
                pdf_doc = fitz.open(doc.file_path)
                pages = db.query(models.DocumentPage).filter(models.DocumentPage.document_id == document_id).order_by(models.DocumentPage.page_number).all()
                
                for p_idx, page in enumerate(pdf_doc):
                    db_page = next((p for p in pages if p.page_number == p_idx + 1), None)
                    if db_page and db_page.text_content:
                        # Check if page already has text. If not, inject the database text_content
                        if not page.get_text().strip():
                            # Inject text invisibly with book margins (12% horizontal, 8% vertical)
                            margin_x = page.rect.width * 0.12
                            margin_y = page.rect.height * 0.08
                            text_rect = fitz.Rect(
                                margin_x,
                                margin_y,
                                page.rect.width - margin_x,
                                page.rect.height - margin_y
                            )
                            page.insert_textbox(
                                text_rect,
                                db_page.text_content,
                                render_mode=3,
                                fontsize=9
                            )
                
                pdf_doc.save(searchable_path)
                pdf_doc.close()
            except Exception as pdf_err:
                print(f"Error injecting text layer: {pdf_err}")
                return FileResponse(doc.file_path, media_type="application/pdf", filename=f"{doc.filename}")
                
        return FileResponse(searchable_path, media_type="application/pdf", filename=f"{doc.filename}")
    else:
        # It's an image, convert to basic PDF for export
        pdf_path = os.path.join(os.path.dirname(doc.file_path), f"{doc.id}_converted.pdf")
        searchable_path = os.path.join(os.path.dirname(doc.file_path), f"{doc.id}_converted_searchable.pdf")
        
        if not os.path.exists(searchable_path):
            from PIL import Image
            import fitz
            try:
                # 1. Convert image to PDF first if not exists
                if not os.path.exists(pdf_path):
                    img = Image.open(doc.file_path)
                    img.convert('RGB').save(pdf_path)
                
                # 2. Inject text layer
                pdf_doc = fitz.open(pdf_path)
                pages = db.query(models.DocumentPage).filter(models.DocumentPage.document_id == document_id).order_by(models.DocumentPage.page_number).all()
                
                for p_idx, page in enumerate(pdf_doc):
                    db_page = next((p for p in pages if p.page_number == p_idx + 1), None)
                    if db_page and db_page.text_content:
                        margin_x = page.rect.width * 0.12
                        margin_y = page.rect.height * 0.08
                        text_rect = fitz.Rect(
                            margin_x,
                            margin_y,
                            page.rect.width - margin_x,
                            page.rect.height - margin_y
                        )
                        page.insert_textbox(
                            text_rect,
                            db_page.text_content,
                            render_mode=3,
                            fontsize=9
                        )
                pdf_doc.save(searchable_path)
                pdf_doc.close()
            except Exception as e:
                print(f"Error generating searchable PDF for image: {e}")
                if os.path.exists(pdf_path):
                    return FileResponse(pdf_path, media_type="application/pdf", filename=f"{doc.filename}.pdf")
                raise HTTPException(status_code=500, detail="Failed to generate PDF")
                
        return FileResponse(searchable_path, media_type="application/pdf", filename=f"{doc.filename}.pdf")

@router.get("/{document_id}/processing_report")
def get_processing_report(document_id: int, db: Session = Depends(get_db)):
    doc = db.query(models.Document).filter(models.Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    pages = db.query(models.DocumentPage).filter(models.DocumentPage.document_id == document_id).order_by(models.DocumentPage.page_number).all()
    
    report_pages = []
    total_pages = len(pages)
    successful_conversions = 0
    blank_pages = 0
    
    for p in pages:
        has_text = bool(p.text_content and p.text_content.strip())
        
        is_ai_ocr = False
        lines = p.ocr_json.get("pages", [{}])[0].get("lines", []) if p.ocr_json else []
        if lines and lines[0].get("confidence") == 0.95:
            is_ai_ocr = True
            
        if has_text:
            source = "AI OCR (Gemini)" if is_ai_ocr else "Native PDF Text"
            status = "Success"
            remarks = f"Extracted {len(p.text_content.strip())} characters successfully."
            successful_conversions += 1
        else:
            source = "Scanned Image"
            status = "Blank / Empty"
            remarks = "No text detected. The page might be blank or the text is too small/blurry to read."
            blank_pages += 1
            
        report_pages.append({
            "page_number": p.page_number,
            "status": status,
            "source": source,
            "char_count": len(p.text_content.strip()) if p.text_content else 0,
            "remarks": remarks
        })
        
    return {
        "document_name": doc.filename,
        "total_pages": total_pages,
        "successful_conversions": successful_conversions,
        "blank_pages": blank_pages,
        "pages": report_pages
    }

@router.get("/{document_id}/export/text")
def export_text(document_id: int, db: Session = Depends(get_db)):
    doc = db.query(models.Document).filter(models.Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    # Check if there's an AI extraction with a full_transcription
    record = db.query(models.ExtractedRecord).filter(models.ExtractedRecord.document_id == document_id).first()
    if record and record.record_data and "full_transcription" in record.record_data:
        text_content = record.record_data["full_transcription"]
        return Response(
            content=text_content,
            media_type="text/plain",
            headers={"Content-Disposition": f'attachment; filename="{doc.filename}_transcription.txt"'}
        )
        
    # Fallback to raw OCR text
    txt_path = os.path.join(os.path.dirname(doc.file_path), f"{doc.id}_raw.txt")
    if not os.path.exists(txt_path) or os.path.getsize(txt_path) == 0:
        # If it's an image or empty, return a helpful message
        helpful_message = "Raw text extraction requires a PDF document. Since this is an image, please use the 'Layout-Preserving Transcription' template to extract text using AI."
        return Response(
            content=helpful_message,
            media_type="text/plain",
            headers={"Content-Disposition": f'attachment; filename="{doc.filename}_raw_text_info.txt"'}
        )
        
    return FileResponse(txt_path, media_type="text/plain", filename=f"{doc.filename}_raw.txt")

@router.delete("/{document_id}")
def delete_document(document_id: int, db: Session = Depends(get_db)):
    doc = db.query(models.Document).filter(models.Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Try to delete associated files physically
    try:
        base_dir = os.path.dirname(doc.file_path)
        
        # Original file
        if os.path.exists(doc.file_path):
            os.remove(doc.file_path)
            
        # Converted pdf (if image)
        conv_pdf = os.path.join(base_dir, f"{doc.id}_converted.pdf")
        if os.path.exists(conv_pdf):
            os.remove(conv_pdf)
            
        # Raw text
        raw_txt = os.path.join(base_dir, f"{doc.id}_raw.txt")
        if os.path.exists(raw_txt):
            os.remove(raw_txt)
            
        # Clean up any generated page images
        base_name_pdf = os.path.basename(doc.file_path).replace('.pdf', '')
        base_name_img = os.path.basename(doc.file_path).rsplit('.', 1)[0]
        
        for file in os.listdir(base_dir):
            if file.startswith(base_name_pdf + "_page_") or file.startswith(base_name_img + "_page_"):
                os.remove(os.path.join(base_dir, file))
                
    except Exception as e:
        print(f"Error during file cleanup: {e}")
        # We proceed to delete from DB even if file cleanup fails partially
        pass

    db.delete(doc)
    db.commit()
    
    return {"message": "Document deleted successfully"}

@router.post("/{doc_id}/recreate_book")
def recreate_book(doc_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    doc = db.query(models.Document).filter(models.Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    # Queue background task
    background_tasks.add_task(book_engine.process_recreate_book, db, doc_id)
    
    # Update immediate status
    doc.status = "recreating_book"
    doc.extraction_progress = "Starting Book Recreation Engine..."
    db.commit()
    
    return {"message": "Book recreation started in background"}

@router.get("/{doc_id}/download_book")
def download_recreated_book(doc_id: int, db: Session = Depends(get_db)):
    doc = db.query(models.Document).filter(models.Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    # Prefer edited/approved record transcription if available
    record = db.query(models.ExtractedRecord).filter(models.ExtractedRecord.document_id == doc_id).first()
    
    full_markdown = ""
    if record and record.record_data and "full_transcription" in record.record_data:
        full_markdown = record.record_data["full_transcription"]
    else:
        # Fallback: join raw database page text
        pages = db.query(models.DocumentPage).filter(models.DocumentPage.document_id == doc_id).order_by(models.DocumentPage.page_number).all()
        full_markdown = f"# {doc.filename}\n\n"
        for p in pages:
            if p.text_content:
                full_markdown += f"## Page {p.page_number}\n\n{p.text_content}\n\n"
                
    if not full_markdown.strip():
        raise HTTPException(status_code=400, detail="No transcribed text available to recreate the book. Please run transcription first.")
        
    # Convert Markdown to HTML
    import markdown
    import io
    from xhtml2pdf import pisa
    
    html_content = markdown.markdown(full_markdown, extensions=['tables', 'fenced_code'])
    
    # Beautiful typesetting CSS
    css = """
    <style>
        @page { size: A4; margin: 2.5cm; }
        body { font-family: 'Times New Roman', serif; line-height: 1.6; font-size: 12pt; color: #333; }
        h1 { font-size: 24pt; text-align: center; margin-bottom: 2em; page-break-before: always; }
        h2 { font-size: 18pt; margin-top: 1.5em; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
        h3 { font-size: 14pt; margin-top: 1.2em; }
        p { text-align: justify; margin-bottom: 1em; }
        img { max-width: 100%; height: auto; display: block; margin: 20px auto; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 1em; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        hr { border: 0; border-top: 1px solid #eee; margin: 2em 0; }
    </style>
    """
    
    # Resolve images
    exports_dir = os.path.join("exports", str(doc_id))
    images_dir = os.path.join(exports_dir, "images")
    if os.path.exists(images_dir):
        for img_name in os.listdir(images_dir):
            abs_path = os.path.abspath(os.path.join(images_dir, img_name))
            html_content = html_content.replace(img_name, abs_path)
            
    full_html = f"<html><head>{css}</head><body>{html_content}</body></html>"
    
    output = io.BytesIO()
    pisa_status = pisa.CreatePDF(full_html, dest=output)
    if pisa_status.err:
        raise HTTPException(status_code=500, detail="Failed to generate typeset PDF")
        
    output.seek(0)
    return Response(
        content=output.getvalue(),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="Recreated_{doc.filename}.pdf"'}
    )

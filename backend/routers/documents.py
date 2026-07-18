import os
import uuid
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.responses import FileResponse, Response
from sqlalchemy.orm import Session
from database import get_db
import models
import schemas
from typing import Optional
from file_utils import cleanup_document_files, invalidate_searchable_exports, safe_download_name
from tasks import run_book_recreation, run_document_ocr, run_extraction

router = APIRouter(prefix="/api/v1/documents", tags=["documents"])

ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff", ".bmp"}
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_MB", "50")) * 1024 * 1024


def _insert_invisible_text_layer(pdf_page, db_page) -> None:
    text = (db_page.text_content or "").strip()
    if not text:
        return

    margin_x = pdf_page.rect.width * 0.12
    margin_y = pdf_page.rect.height * 0.08
    text_rect = pdf_page.rect + (margin_x, margin_y, -margin_x, -margin_y)

    # PyMuPDF returns a negative value when text does not fit. Reduce the font
    # until a complete invisible layer can be inserted.
    for font_size in (9, 8, 7, 6, 5, 4):
        result = pdf_page.insert_textbox(
            text_rect,
            text,
            render_mode=3,
            fontsize=font_size,
        )
        if result >= 0:
            return

    # Last-resort searchable layer for unusually dense pages.
    cursor_y = margin_y + 5
    for line in text.splitlines():
        if cursor_y >= pdf_page.rect.height - margin_y:
            break
        if line.strip():
            pdf_page.insert_text(
                (margin_x, cursor_y),
                line[:500],
                render_mode=3,
                fontsize=4,
            )
        cursor_y += 5

@router.post("")
@router.post("/")
def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    project_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    if project_id is not None:
        project = db.query(models.Project).filter(models.Project.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

    original_name = safe_download_name(file.filename or "document")
    file_ext = Path(original_name).suffix.lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        supported = ", ".join(sorted(ALLOWED_EXTENSIONS))
        raise HTTPException(status_code=415, detail=f"Unsupported file type. Supported types: {supported}")

    file_id = str(uuid.uuid4())
    file_path = Path("uploads") / f"{file_id}{file_ext}"
    file_path.parent.mkdir(parents=True, exist_ok=True)

    size = 0
    try:
        with file_path.open("wb") as buffer:
            while chunk := file.file.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_UPLOAD_BYTES:
                    raise HTTPException(
                        status_code=413,
                        detail=f"File exceeds the {MAX_UPLOAD_BYTES // (1024 * 1024)} MB upload limit",
                    )
                buffer.write(chunk)
    except Exception:
        if file_path.exists():
            file_path.unlink()
        raise

    if size == 0:
        file_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    # Create document record
    doc = models.Document(
        filename=original_name,
        file_path=str(file_path),
        project_id=project_id,
        status="uploaded",
        doc_type="unknown"
    )
    try:
        db.add(doc)
        db.commit()
        db.refresh(doc)
    except Exception:
        db.rollback()
        file_path.unlink(missing_ok=True)
        raise

    # Trigger OCR background task
    background_tasks.add_task(run_document_ocr, doc.id)

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
    doc = db.query(models.Document).filter(models.Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    template = db.query(models.Template).filter(models.Template.id == req.template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    if doc.status in {"uploaded", "processing", "extracting", "recreating_book"}:
        raise HTTPException(status_code=409, detail=f"Document is currently {doc.status.replace('_', ' ')}")
    if doc.status == "failed":
        raise HTTPException(status_code=409, detail="Document processing failed; upload the document again")
    if not doc.pages:
        raise HTTPException(status_code=409, detail="Document has no processed pages")

    doc.status = "extracting"
    doc.extraction_progress = "Extraction queued..."
    db.commit()
    background_tasks.add_task(run_extraction, document_id, req.template_id)
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
    if req.text_content is not None:
        page.text_content = req.text_content
    else:
        lines = req.ocr_json.get("pages", [{}])[0].get("lines", [])
        page.text_content = "\n".join(
            str(line.get("text", "")).strip()
            for line in lines
            if str(line.get("text", "")).strip()
        )
    doc = db.query(models.Document).filter(models.Document.id == document_id).first()
    if doc:
        invalidate_searchable_exports(doc)
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
                            _insert_invisible_text_layer(page, db_page)
                
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
                        _insert_invisible_text_layer(page, db_page)
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
        
        page_metadata = p.ocr_json.get("pages", [{}])[0] if p.ocr_json else {}
        source_name = page_metadata.get("source")
        lines = page_metadata.get("lines", [])
        is_ai_ocr = source_name == "gemini_ocr" or (
            not source_name and lines and lines[0].get("confidence") == 0.95
        )
            
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
        
    # 1. Check if there's an AI extraction with a full_transcription
    record = db.query(models.ExtractedRecord).filter(
        models.ExtractedRecord.document_id == document_id
    ).order_by(models.ExtractedRecord.id.desc()).first()
    if record and record.record_data and "full_transcription" in record.record_data:
        text_content = record.record_data["full_transcription"]
        return Response(
            content=text_content,
            media_type="text/plain",
            headers={"Content-Disposition": f'attachment; filename="{safe_download_name(doc.filename)}_transcription.txt"'}
        )
        
    # 2. Check if we have transcribed pages in the database
    pages = db.query(models.DocumentPage).filter(models.DocumentPage.document_id == document_id).order_by(models.DocumentPage.page_number).all()
    db_text = ""
    for p in pages:
        if p.text_content:
            db_text += p.text_content + "\n\n"
            
    if db_text.strip():
        return Response(
            content=db_text.strip(),
            media_type="text/plain",
            headers={"Content-Disposition": f'attachment; filename="{safe_download_name(doc.filename)}_ocr_text.txt"'}
        )
        
    # 3. Fallback to raw OCR text file
    txt_path = os.path.join(os.path.dirname(doc.file_path), f"{doc.id}_raw.txt")
    if os.path.exists(txt_path) and os.path.getsize(txt_path) > 0:
        return FileResponse(txt_path, media_type="text/plain", filename=f"{doc.filename}_raw.txt")
        
    helpful_message = "No text extraction available. Please run extraction or transcribe the pages first."
    return Response(
        content=helpful_message,
        media_type="text/plain",
        headers={"Content-Disposition": f'attachment; filename="{safe_download_name(doc.filename)}_no_text.txt"'}
    )

@router.delete("/{document_id}")
def delete_document(document_id: int, db: Session = Depends(get_db)):
    doc = db.query(models.Document).filter(models.Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    try:
        cleanup_document_files(doc)
    except OSError as exc:
        print(f"Error during file cleanup: {exc}")
        # We proceed to delete from DB even if file cleanup fails partially

    db.delete(doc)
    db.commit()
    
    return {"message": "Document deleted successfully"}

@router.post("/{doc_id}/recreate_book")
def recreate_book(doc_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    doc = db.query(models.Document).filter(models.Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    if doc.status in {"uploaded", "processing", "extracting", "recreating_book"}:
        raise HTTPException(status_code=409, detail=f"Document is currently {doc.status.replace('_', ' ')}")
    pages = db.query(models.DocumentPage).filter(models.DocumentPage.document_id == doc_id).all()
    if not pages or not any((page.text_content or "").strip() or page.image_path for page in pages):
        raise HTTPException(status_code=400, detail="No processed page content is available for book recreation")
    gemini_key = os.getenv("GEMINI_API_KEY")
    openrouter_key = os.getenv("OPENROUTER_API_KEY")
    if gemini_key and "YOUR_GEMINI_API_KEY" in gemini_key:
        gemini_key = None
    if openrouter_key and "YOUR_OPENROUTER_API_KEY" in openrouter_key:
        openrouter_key = None
    if not gemini_key and not openrouter_key:
        raise HTTPException(status_code=503, detail="Configure GEMINI_API_KEY or OPENROUTER_API_KEY before recreating a book")

    background_tasks.add_task(run_book_recreation, doc_id)
    
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
        
    recreated_path = os.path.join("exports", str(doc_id), "recreated_book.pdf")
    if os.path.isfile(recreated_path):
        return FileResponse(
            recreated_path,
            media_type="application/pdf",
            filename=f"Recreated_{safe_download_name(doc.filename)}.pdf",
        )

    # Prefer the latest edited/approved transcription if available.
    record = db.query(models.ExtractedRecord).filter(
        models.ExtractedRecord.document_id == doc_id
    ).order_by(models.ExtractedRecord.id.desc()).first()
    
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
        headers={"Content-Disposition": f'attachment; filename="Recreated_{safe_download_name(doc.filename)}.pdf"'}
    )

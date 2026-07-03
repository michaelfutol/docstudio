import os
import uuid
import shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from database import get_db
import models
import schemas
from typing import Optional
from ocr_service import process_document_ocr
from extraction_service import extract_structured_data

router = APIRouter(prefix="/api/v1/documents", tags=["documents"])

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
        "pages": pages
    }

@router.post("/{document_id}/extract")
def trigger_extraction(document_id: int, req: schemas.ExtractRequest, db: Session = Depends(get_db)):
    record = extract_structured_data(db, document_id, req.template_id)
    if not record:
        raise HTTPException(status_code=400, detail="Failed to extract data")
    return {"message": "Extraction complete", "record_id": record.id}

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
        return FileResponse(doc.file_path, media_type="application/pdf", filename=f"{doc.filename}")
    else:
        # It's an image, convert to basic PDF for export
        pdf_path = os.path.join(os.path.dirname(doc.file_path), f"{doc.id}_converted.pdf")
        if not os.path.exists(pdf_path):
            from PIL import Image
            try:
                img = Image.open(doc.file_path)
                img.convert('RGB').save(pdf_path)
            except Exception as e:
                print(f"Error converting image to PDF: {e}")
                raise HTTPException(status_code=500, detail="Failed to generate PDF")
                
        return FileResponse(pdf_path, media_type="application/pdf", filename=f"{doc.filename}.pdf")

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
    if not os.path.exists(txt_path):
        raise HTTPException(status_code=404, detail="Raw text not found. Ensure OCR has completed.")
        
    return FileResponse(txt_path, media_type="text/plain", filename=f"{doc.filename}_raw.txt")

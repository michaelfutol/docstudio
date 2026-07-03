from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models
import schemas

router = APIRouter(prefix="/api/v1/records", tags=["records"])

@router.get("/pending")
def get_pending_records(db: Session = Depends(get_db)):
    records = db.query(models.ExtractedRecord).filter(models.ExtractedRecord.status == "pending").all()
    # Eager load document to get filename
    result = []
    for r in records:
        doc = db.query(models.Document).filter(models.Document.id == r.document_id).first()
        result.append({
            "id": r.id,
            "document_id": r.document_id,
            "filename": doc.filename if doc else "Unknown",
            "record_data": r.record_data,
            "confidence": r.confidence,
            "needs_review": r.needs_review,
            "status": r.status
        })
    return result

@router.get("/{record_id}")
def get_record(record_id: int, db: Session = Depends(get_db)):
    record = db.query(models.ExtractedRecord).filter(models.ExtractedRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    return {
        "id": record.id,
        "document_id": record.document_id,
        "record_data": record.record_data,
        "confidence": record.confidence,
        "needs_review": record.needs_review,
        "status": record.status
    }

@router.put("/{record_id}/status")
def update_record_status(record_id: int, req: schemas.RecordStatusUpdate, db: Session = Depends(get_db)):
    record = db.query(models.ExtractedRecord).filter(models.ExtractedRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    
    record.status = req.status
    if req.record_data:
        record.record_data = req.record_data
        
    # Update parent document status to match
    doc = db.query(models.Document).filter(models.Document.id == record.document_id).first()
    if doc:
        doc.status = req.status
        
    db.commit()
    return {"message": f"Record and Document {req.status}"}

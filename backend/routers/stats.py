from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
import models

router = APIRouter(prefix="/api/v1/stats", tags=["stats"])

@router.get("/")
def get_stats(db: Session = Depends(get_db)):
    total_documents = db.query(models.Document).count()
    total_projects = db.query(models.Project).count()
    total_templates = db.query(models.Template).count()
    
    pending = db.query(models.ExtractedRecord).filter(models.ExtractedRecord.status == "pending").count()
    approved = db.query(models.ExtractedRecord).filter(models.ExtractedRecord.status == "approved").count()
    rejected = db.query(models.ExtractedRecord).filter(models.ExtractedRecord.status == "rejected").count()
    
    # Calculate avg confidence
    records = db.query(models.ExtractedRecord).filter(models.ExtractedRecord.confidence != None).all()
    avg_conf = sum([r.confidence for r in records]) / len(records) if records else 0.0
    
    total_records = pending + approved + rejected
    stp_rate = approved / total_records if total_records > 0 else 0.0
    
    recent_docs = db.query(models.Document).order_by(models.Document.created_at.desc()).limit(5).all()
    
    return {
        "total_documents": total_documents,
        "total_projects": total_projects,
        "total_templates": total_templates,
        "pending_review_count": pending,
        "approved_count": approved,
        "rejected_count": rejected,
        "avg_confidence": avg_conf,
        "stp_rate": stp_rate,
        "recent_documents": [{"id": d.id, "filename": d.filename, "status": d.status} for d in recent_docs]
    }

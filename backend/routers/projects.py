from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models
import schemas
from typing import List

router = APIRouter(prefix="/api/v1/projects", tags=["projects"])

@router.get("")
@router.get("/")
def get_projects(db: Session = Depends(get_db)):
    projects = db.query(models.Project).all()
    result = []
    for p in projects:
        docs = db.query(models.Document).filter(models.Document.project_id == p.id).all()
        result.append({
            "id": p.id,
            "name": p.name,
            "description": p.description,
            "created_at": p.created_at,
            "document_count": len(docs),
            "status": "Active" if len(docs) > 0 else "Empty"
        })
    return result

@router.post("")
@router.post("/")
def create_project(req: schemas.ProjectCreate, db: Session = Depends(get_db)):
    project = models.Project(name=req.name, description=req.description, industry=req.industry)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project

@router.put("/{project_id}")
def update_project(project_id: int, req: schemas.ProjectUpdate, db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if req.name is not None:
        project.name = req.name
    if req.description is not None:
        project.description = req.description
    if req.industry is not None:
        project.industry = req.industry
    db.commit()
    db.refresh(project)
    return project

@router.delete("/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # We need to manually delete associated documents and their files
    docs = db.query(models.Document).filter(models.Document.project_id == project_id).all()
    import os
    for doc in docs:
        if doc.file_path and os.path.exists(doc.file_path):
            try:
                os.remove(doc.file_path)
            except:
                pass
        
        base_dir = os.path.dirname(doc.file_path) if doc.file_path else "uploads"
        base_name = os.path.basename(doc.file_path).rsplit('.', 1)[0] if doc.file_path else str(doc.id)
        
        # Cleanup raw text and PDFs
        try:
            for ext in ['_raw.txt', '_searchable.pdf', '_converted.pdf']:
                p = os.path.join(base_dir, f"{doc.id}{ext}")
                if os.path.exists(p):
                    os.remove(p)
            
            # Cleanup page images
            for page in doc.pages:
                if page.image_path and os.path.exists(page.image_path):
                    os.remove(page.image_path)
        except:
            pass
            
        db.delete(doc)

    db.delete(project)
    db.commit()
    return {"message": "Project deleted successfully"}

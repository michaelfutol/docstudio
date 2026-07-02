from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models
import schemas
from typing import List

router = APIRouter(prefix="/api/v1/projects", tags=["projects"])

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

@router.post("/")
def create_project(req: schemas.ProjectCreate, db: Session = Depends(get_db)):
    project = models.Project(name=req.name, description=req.description)
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
    db.commit()
    db.refresh(project)
    return project

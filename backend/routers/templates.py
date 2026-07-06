from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models
import schemas

router = APIRouter(prefix="/api/v1/templates", tags=["templates"])

@router.get("/")
def get_templates(db: Session = Depends(get_db)):
    templates = db.query(models.Template).all()
    # Mock some built-in templates if empty
    if not templates:
        t1 = models.Template(name="Questionnaire / Multiple Choice", schema_json={"type": "object"})
        t2 = models.Template(name="Invoice", schema_json={"type": "object"})
        t3 = models.Template(name="Receipt", schema_json={"type": "object"})
        t4 = models.Template(name="General Document", schema_json={"type": "object"})
        db.add_all([t1, t2, t3, t4])
        db.commit()
        # Query again to ensure we get the generated IDs
        templates = db.query(models.Template).all()
    return templates

@router.post("")
@router.post("/")
def create_template(req: schemas.TemplateCreate, db: Session = Depends(get_db)):
    template = models.Template(name=req.name, schema_json=req.schema_json, industry=req.industry, validation_rules=req.validation_rules)
    db.add(template)
    db.commit()
    db.refresh(template)
    return template

@router.put("/{template_id}")
def update_template(template_id: int, req: schemas.TemplateUpdate, db: Session = Depends(get_db)):
    template = db.query(models.Template).filter(models.Template.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    if req.name is not None:
        template.name = req.name
    if req.schema_json is not None:
        template.schema_json = req.schema_json
    if req.industry is not None:
        template.industry = req.industry
    if req.validation_rules is not None:
        template.validation_rules = req.validation_rules
    db.commit()
    db.refresh(template)
    return template

@router.delete("/{template_id}")
def delete_template(template_id: int, db: Session = Depends(get_db)):
    template = db.query(models.Template).filter(models.Template.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    db.delete(template)
    db.commit()
    return {"message": "Template deleted"}

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models
import schemas

router = APIRouter(prefix="/api/v1/templates", tags=["templates"])

BUILT_IN_TEMPLATE_NAMES = {
    "Engineering: Material Schedule",
    "Accounting: Invoice Line Items",
    "Standard Text Extraction",
    "Questionnaire / Multiple Choice",
    "Invoice",
    "Receipt",
    "General Document",
}


def serialize_template(template):
    return {
        "id": template.id,
        "name": template.name,
        "industry": template.industry,
        "schema_json": template.schema_json,
        "validation_rules": template.validation_rules,
        "is_builtin": template.name in BUILT_IN_TEMPLATE_NAMES,
    }

@router.get("")
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
    return [serialize_template(template) for template in templates]

@router.post("")
@router.post("/")
def create_template(req: schemas.TemplateCreate, db: Session = Depends(get_db)):
    if req.name in BUILT_IN_TEMPLATE_NAMES:
        raise HTTPException(status_code=409, detail="A built-in template already uses this name")
    template = models.Template(name=req.name, schema_json=req.schema_definition, industry=req.industry, validation_rules=req.validation_rules)
    db.add(template)
    db.commit()
    db.refresh(template)
    return serialize_template(template)

@router.put("/{template_id}")
def update_template(template_id: int, req: schemas.TemplateUpdate, db: Session = Depends(get_db)):
    template = db.query(models.Template).filter(models.Template.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    if req.name in BUILT_IN_TEMPLATE_NAMES and template.name not in BUILT_IN_TEMPLATE_NAMES:
        raise HTTPException(status_code=409, detail="That name is reserved for a built-in template")
    if req.name is not None:
        template.name = req.name
    if req.schema_definition is not None:
        template.schema_json = req.schema_definition
    if req.industry is not None:
        template.industry = req.industry
    if req.validation_rules is not None:
        template.validation_rules = req.validation_rules
    db.commit()
    db.refresh(template)
    return serialize_template(template)

@router.delete("/{template_id}")
def delete_template(template_id: int, db: Session = Depends(get_db)):
    template = db.query(models.Template).filter(models.Template.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    if template.name in BUILT_IN_TEMPLATE_NAMES:
        raise HTTPException(status_code=409, detail="Built-in templates cannot be deleted")
    db.delete(template)
    db.commit()
    return {"message": "Template deleted"}

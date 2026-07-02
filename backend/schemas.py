from pydantic import BaseModel
from typing import Optional, Dict, Any

class ExtractRequest(BaseModel):
    template_id: int

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class TemplateCreate(BaseModel):
    name: str
    schema_json: Dict[str, Any]
    validation_rules: Optional[Dict[str, Any]] = None

class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    schema_json: Optional[Dict[str, Any]] = None
    validation_rules: Optional[Dict[str, Any]] = None

class PageTextUpdate(BaseModel):
    ocr_json: Dict[str, Any]

class RecordStatusUpdate(BaseModel):
    status: str # 'approved' or 'rejected'
    record_data: Optional[Dict[str, Any]] = None

from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Optional, Dict, Any, Literal
from datetime import datetime

class ExtractRequest(BaseModel):
    template_id: int = Field(gt=0)

class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: Optional[str] = None
    industry: Optional[str] = "General"

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Project name cannot be blank")
        return value

class Project(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    industry: str
    created_at: datetime

class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    industry: Optional[str] = None

    @field_validator("name")
    @classmethod
    def validate_optional_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        value = value.strip()
        if not value:
            raise ValueError("Project name cannot be blank")
        return value

class TemplateCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str = Field(min_length=1, max_length=255)
    schema_definition: Dict[str, Any] = Field(alias="schema_json", serialization_alias="schema_json")
    industry: Optional[str] = "General"
    validation_rules: Optional[Dict[str, Any]] = None

    @field_validator("name")
    @classmethod
    def validate_template_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Template name cannot be blank")
        return value

    @field_validator("schema_definition")
    @classmethod
    def validate_schema_definition(cls, value: Dict[str, Any]) -> Dict[str, Any]:
        if value.get("type") not in {"object", "array"}:
            raise ValueError("Template schema type must be 'object' or 'array'")
        if value["type"] == "object" and not isinstance(value.get("properties", {}), dict):
            raise ValueError("Object template schemas require a properties object")
        if value["type"] == "array" and not isinstance(value.get("items"), dict):
            raise ValueError("Array template schemas require an items schema")
        return value

class TemplateUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    schema_definition: Optional[Dict[str, Any]] = Field(default=None, alias="schema_json", serialization_alias="schema_json")
    industry: Optional[str] = None
    validation_rules: Optional[Dict[str, Any]] = None

    @field_validator("name")
    @classmethod
    def validate_optional_template_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        value = value.strip()
        if not value:
            raise ValueError("Template name cannot be blank")
        return value

    @field_validator("schema_definition")
    @classmethod
    def validate_optional_schema_definition(cls, value: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        if value is None:
            return value
        return TemplateCreate.validate_schema_definition(value)

class PageTextUpdate(BaseModel):
    ocr_json: Dict[str, Any]
    text_content: Optional[str] = None

class RecordStatusUpdate(BaseModel):
    status: Literal["approved", "rejected"]
    record_data: Optional[Dict[str, Any]] = None

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from database import engine, Base
from dotenv import load_dotenv

# Import routers
from routers import projects, documents, templates, records, export, stats

load_dotenv()

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Document Intelligence Studio SaaS API")

# Setup uploads directory
os.makedirs("uploads", exist_ok=True)

# Mount uploads directory to serve images statically
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Configure CORS dynamically from .env or default to *
allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "*")
allowed_origins = [origin.strip() for origin in allowed_origins_env.split(",")] if allowed_origins_env else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(stats.router)
app.include_router(projects.router)
app.include_router(documents.router)
app.include_router(templates.router)
app.include_router(records.router)
app.include_router(export.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to Document Intelligence Studio API"}

@app.on_event("startup")
def startup_tasks():
    from database import SessionLocal
    from sqlalchemy import text
    import models
    db = SessionLocal()
    
    # 1. Run Migrations for SQLite
    try:
        # Check and add 'industry' to projects
        db.execute(text("ALTER TABLE projects ADD COLUMN industry VARCHAR(50) DEFAULT 'General'"))
        db.commit()
    except Exception:
        db.rollback() # Column likely exists
        
    try:
        # Check and add 'industry' to templates
        db.execute(text("ALTER TABLE templates ADD COLUMN industry VARCHAR(50) DEFAULT 'General'"))
        db.commit()
    except Exception:
        db.rollback() # Column likely exists

    # 1.5 Fix existing seed data industries and schema
    try:
        db.execute(text("UPDATE templates SET industry = 'Engineering' WHERE name = 'Questionnaire / Multiple Choice' OR name = 'Engineering: Material Schedule'"))
        db.execute(text("UPDATE templates SET industry = 'Accounting' WHERE name = 'Invoice' OR name = 'Accounting: Invoice Line Items'"))
        db.execute(text("UPDATE templates SET industry = 'General' WHERE name = 'Receipt' OR name = 'General Document' OR name = 'Standard Text Extraction'"))
        
        schema = """{"type": "array", "items": {"type": "object", "properties": {"Description": {"type": "string"}, "Quantity": {"type": "number"}, "Unit Price": {"type": "number"}, "Total Price": {"type": "number"}}}}"""
        db.execute(text("UPDATE templates SET schema_json = :schema WHERE name = 'Accounting: Invoice Line Items'"), {"schema": schema})
        db.commit()
    except Exception as e:
        print(f"Error fixing seed data: {e}")
        db.rollback()

    # 2. Seed Default Templates
    try:
        if db.query(models.Template).filter(models.Template.name == "Engineering: Material Schedule").first() is None:
            templates = [
                models.Template(
                    name="Engineering: Material Schedule",
                    industry="Engineering",
                    schema_json={
                        "type": "object",
                        "properties": {
                            "data": {
                                "type": "array",
                                "description": "A tabular list of materials extracted from the drawing or schedule.",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "Item No": {"type": "string"},
                                        "Description": {"type": "string"},
                                        "Quantity": {"type": "number"},
                                        "Unit": {"type": "string"},
                                        "Dimensions": {"type": "string"},
                                        "Notes": {"type": "string"}
                                    }
                                }
                            }
                        }
                    },
                    validation_rules={"is_tabular": True}
                ),
                models.Template(
                    name="Accounting: Invoice Line Items",
                    industry="Accounting",
                    schema_json={
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "Description": {"type": "string"},
                                "Quantity": {"type": "number"},
                                "Unit Price": {"type": "number"},
                                "Total Price": {"type": "number"}
                            }
                        }
                    },
                    validation_rules={"is_tabular": True}
                ),
                models.Template(
                    name="Standard Text Extraction",
                    industry="General",
                    schema_json={
                        "type": "object",
                        "properties": {
                            "title": {"type": "string", "description": "Document title"},
                            "summary": {"type": "string", "description": "Brief summary of the document"}
                        }
                    },
                    validation_rules={"is_tabular": False}
                )
            ]
            db.bulk_save_objects(templates)
            db.commit()
    except Exception as e:
        print(f"Error seeding templates: {e}")
    finally:
        db.close()

@app.get("/api/health")
def health_check():
    return {"status": "ok"}

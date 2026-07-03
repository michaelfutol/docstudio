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
def seed_default_templates():
    from database import SessionLocal
    import models
    db = SessionLocal()
    try:
        if db.query(models.Template).filter(models.Template.name == "Engineering: Material Schedule").first() is None:
            templates = [
                models.Template(
                    name="Engineering: Material Schedule",
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
                    schema_json={
                        "type": "object",
                        "properties": {
                            "data": {
                                "type": "array",
                                "description": "A list of line items from an invoice or receipt.",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "Description": {"type": "string"},
                                        "Quantity": {"type": "number"},
                                        "Unit Price": {"type": "number"},
                                        "Total Price": {"type": "number"}
                                    }
                                }
                            }
                        }
                    },
                    validation_rules={"is_tabular": True}
                ),
                models.Template(
                    name="Standard Text Extraction",
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

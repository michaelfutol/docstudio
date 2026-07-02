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

@app.get("/api/health")
def health_check():
    return {"status": "ok"}

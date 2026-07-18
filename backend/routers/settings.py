import os
from pathlib import Path

from fastapi import APIRouter

from database import SQLALCHEMY_DATABASE_URL


router = APIRouter(prefix="/api/v1/settings", tags=["settings"])


@router.get("/status")
def get_settings_status():
    uploads_dir = Path("uploads")
    uploads_dir.mkdir(parents=True, exist_ok=True)
    database_driver = SQLALCHEMY_DATABASE_URL.split(":", 1)[0]

    gemini_key = os.getenv("GEMINI_API_KEY")
    openrouter_key = os.getenv("OPENROUTER_API_KEY")

    return {
        "api_status": "connected",
        "database_driver": database_driver,
        "gemini_configured": bool(gemini_key and "YOUR_GEMINI_API_KEY" not in gemini_key),
        "openrouter_configured": bool(openrouter_key and "YOUR_OPENROUTER_API_KEY" not in openrouter_key),
        "uploads_writable": os.access(uploads_dir, os.W_OK),
    }

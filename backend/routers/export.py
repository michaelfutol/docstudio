from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse, Response
from sqlalchemy.orm import Session
from database import get_db
from export_service import export_project_data, export_all_approved, export_by_document

router = APIRouter(prefix="/api/v1", tags=["export"])

@router.get("/projects/{project_id}/export")
def export_project(project_id: int, format: str = "json", db: Session = Depends(get_db)):
    result = export_project_data(db, project_id, format)
    if not result:
        raise HTTPException(status_code=404, detail="No approved records found to export")
    
    if result["type"] == "application/json":
        return JSONResponse(content=result["data"])
    else:
        return Response(
            content=result["data"],
            media_type=result["type"],
            headers={"Content-Disposition": f"attachment; filename={result.get('filename', 'export')}"}
        )

@router.get("/export/all")
def export_all(format: str = "json", db: Session = Depends(get_db)):
    result = export_all_approved(db, format)
    if not result:
        raise HTTPException(status_code=404, detail="No approved records found to export")
    
    if result["type"] == "application/json":
        return JSONResponse(content=result["data"])
    else:
        return Response(
            content=result["data"],
            media_type=result["type"],
            headers={"Content-Disposition": f"attachment; filename={result.get('filename', 'export')}"}
        )

@router.get("/documents/{document_id}/export")
def export_document(document_id: int, format: str = "json", db: Session = Depends(get_db)):
    result = export_by_document(db, document_id, format)
    if not result:
        raise HTTPException(status_code=404, detail="No approved records found for this document")
    
    if result["type"] == "application/json":
        return JSONResponse(content=result["data"])
    else:
        return Response(
            content=result["data"],
            media_type=result["type"],
            headers={"Content-Disposition": f"attachment; filename={result.get('filename', 'export')}"}
        )

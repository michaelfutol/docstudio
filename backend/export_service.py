import csv
import json
import io
from sqlalchemy.orm import Session
import models

def flatten_dict(d, parent_key='', sep='_'):
    """Flatten a nested dictionary for CSV export."""
    items = []
    for k, v in d.items():
        new_key = f"{parent_key}{sep}{k}" if parent_key else k
        if isinstance(v, dict):
            items.extend(flatten_dict(v, new_key, sep=sep).items())
        elif isinstance(v, list):
            items.append((new_key, json.dumps(v)))
        else:
            items.append((new_key, v))
    return dict(items)

def export_project_data(db: Session, project_id: int, format_type: str):
    """
    Export all approved extracted records for a project in the specified format.
    format_type: 'json', 'csv'
    """
    docs = db.query(models.Document).filter(models.Document.project_id == project_id).all()
    doc_ids = [d.id for d in docs]
    
    records = db.query(models.ExtractedRecord).filter(
        models.ExtractedRecord.document_id.in_(doc_ids),
        models.ExtractedRecord.status == 'approved' # Only export approved records
    ).all()

    return _format_records(records, format_type)

def export_all_approved(db: Session, format_type: str):
    """
    Export ALL approved records across the entire platform.
    """
    records = db.query(models.ExtractedRecord).filter(
        models.ExtractedRecord.status == 'approved'
    ).all()

    return _format_records(records, format_type)

def export_by_document(db: Session, document_id: int, format_type: str):
    """
    Export approved records for a single document.
    """
    records = db.query(models.ExtractedRecord).filter(
        models.ExtractedRecord.document_id == document_id,
        models.ExtractedRecord.status == 'approved'
    ).all()

    return _format_records(records, format_type)

def _format_records(records, format_type: str):
    """
    Core formatting logic shared by all export routes.
    """
    if not records:
        return None

    if format_type == 'json':
        data = []
        for r in records:
            data.append({
                "record_id": r.id,
                "document_id": r.document_id,
                "confidence": r.confidence,
                "data": r.record_data
            })
        return {"data": data, "type": "application/json", "filename": "export.json"}
        
    elif format_type == 'csv':
        # Flatten nested JSON for CSV output
        output = io.StringIO()
        
        flattened = []
        all_keys = set()
        for r in records:
            flat = flatten_dict(r.record_data)
            flat['_record_id'] = r.id
            flat['_document_id'] = r.document_id
            flat['_confidence'] = r.confidence
            all_keys.update(flat.keys())
            flattened.append(flat)
        
        # Sort keys for stable column order, put meta keys first
        meta_keys = sorted([k for k in all_keys if k.startswith('_')])
        data_keys = sorted([k for k in all_keys if not k.startswith('_')])
        ordered_keys = meta_keys + data_keys
        
        writer = csv.DictWriter(output, fieldnames=ordered_keys, extrasaction='ignore')
        writer.writeheader()
        for row in flattened:
            writer.writerow(row)
        
        return {"data": output.getvalue(), "type": "text/csv", "filename": "export.csv"}

    return None

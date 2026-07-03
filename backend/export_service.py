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
            data = r.record_data
            if isinstance(data, list):
                # Unroll table rows into CSV rows
                for idx, item in enumerate(data):
                    flat = flatten_dict(item) if isinstance(item, dict) else {"value": item}
                    flat['_record_id'] = f"{r.id}_{idx+1}"
                    flat['_document_id'] = r.document_id
                    flat['_confidence'] = r.confidence
                    all_keys.update(flat.keys())
                    flattened.append(flat)
            else:
                flat = flatten_dict(data) if isinstance(data, dict) else {"value": data}
                # Remove field_confidences clutter
                keys_to_remove = [k for k in flat.keys() if 'field_confidences' in k]
                for k in keys_to_remove:
                    del flat[k]
                
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
        
    elif format_type == 'txt':
        output = io.StringIO()
        for i, r in enumerate(records):
            if i > 0:
                output.write("\n\n" + "="*50 + "\n\n")
            output.write(f"--- Document ID {r.document_id} ---\n\n")
            if isinstance(r.record_data, dict) and "full_transcription" in r.record_data:
                output.write(r.record_data["full_transcription"])
            else:
                output.write(json.dumps(r.record_data, indent=2))
                
        return {"data": output.getvalue(), "type": "text/plain", "filename": "export.txt"}
        
    elif format_type == 'pdf':
        try:
            from PyPDF2 import PdfMerger
            import os
            
            merger = PdfMerger()
            has_pdfs = False
            
            for r in records:
                # Need to find the actual Document path. We can import Session and get it, or assume record.document
                # Since records are queried, let's rely on the router passing db if needed, or query it here.
                # Actually, `r` has a relationship `r.document` if defined in SQLAlchemy models.
                doc = r.document
                pdf_path = doc.file_path
                if os.path.exists(pdf_path) and pdf_path.endswith('.pdf'):
                    merger.append(pdf_path)
                    has_pdfs = True
            
            if not has_pdfs:
                return None
                
            output = io.BytesIO()
            merger.write(output)
            merger.close()
            
            return {"data": output.getvalue(), "type": "application/pdf", "filename": "export.pdf"}
        except Exception as e:
            print(f"Error generating PDF export: {e}")
            return None

    return None

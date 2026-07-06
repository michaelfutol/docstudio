from sqlalchemy import create_engine, text
engine = create_engine("sqlite:///./document_studio.db")
with engine.connect() as conn:
    conn.execute(text("UPDATE templates SET industry = 'Engineering' WHERE id = 1"))
    conn.execute(text("UPDATE templates SET industry = 'Accounting' WHERE id = 2"))
    conn.execute(text("UPDATE templates SET industry = 'General' WHERE id = 3"))
    conn.execute(text("UPDATE templates SET industry = 'General' WHERE id = 4"))
    
    # Fix the schema of Accounting template to match Visual Builder
    schema = """{"type": "array", "items": {"type": "object", "properties": {"Description": {"type": "string"}, "Quantity": {"type": "number"}, "Unit Price": {"type": "number"}, "Total Price": {"type": "number"}}}}"""
    conn.execute(text("UPDATE templates SET schema_json = :schema WHERE id = 2"), {"schema": schema})
    
    conn.commit()
print("Fixed DB!")

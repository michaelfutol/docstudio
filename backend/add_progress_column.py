import sqlite3
import os

def upgrade():
    db_path = os.path.join(os.path.dirname(__file__), 'document_studio.db')
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        cursor.execute("ALTER TABLE documents ADD COLUMN extraction_progress VARCHAR")
        conn.commit()
        print("Successfully added extraction_progress column to documents table.")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e):
            print("Column extraction_progress already exists.")
        else:
            print(f"Error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    upgrade()

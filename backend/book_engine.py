import os
import json
import base64
from sqlalchemy.orm import Session
import fitz  # PyMuPDF
from google import genai
from google.genai import types
import markdown
from xhtml2pdf import pisa
import models

def extract_page_images(pdf_path, output_dir, page_num):
    """
    Extracts embedded images from a specific page in a PDF using PyMuPDF.
    Returns a list of saved image filenames.
    """
    os.makedirs(output_dir, exist_ok=True)
    doc = fitz.open(pdf_path)
    if page_num >= len(doc):
        return []
    
    page = doc[page_num]
    image_list = page.get_images(full=True)
    extracted_images = []
    
    for img_index, img in enumerate(image_list):
        xref = img[0]
        base_image = doc.extract_image(xref)
        image_bytes = base_image["image"]
        image_ext = base_image["ext"]
        
        image_filename = f"page_{page_num}_img_{img_index}.{image_ext}"
        image_filepath = os.path.join(output_dir, image_filename)
        
        with open(image_filepath, "wb") as image_file:
            image_file.write(image_bytes)
            
        extracted_images.append(image_filename)
        
    return extracted_images

def process_recreate_book(db: Session, document_id: int):
    doc = db.query(models.Document).filter(models.Document.id == document_id).first()
    if not doc:
        return
        
    # Update status
    doc.status = "recreating_book"
    doc.extraction_progress = "Initializing Book Recreation Engine..."
    db.commit()
    
    try:
        pages = db.query(models.DocumentPage).filter(models.DocumentPage.document_id == document_id).order_by(models.DocumentPage.page_number).all()
        pdf_path = doc.file_path
        
        api_key = os.getenv("GEMINI_API_KEY")
        client = genai.Client(api_key=api_key)
        
        exports_dir = os.path.join("exports", str(document_id))
        images_dir = os.path.join(exports_dir, "images")
        os.makedirs(images_dir, exist_ok=True)
        
        full_markdown = f"# {doc.filename}\n\n"
        
        total_pages = len(pages)
        for idx, page in enumerate(pages):
            doc.extraction_progress = f"Typesetting page {idx+1} of {total_pages}..."
            db.commit()
            
            # Extract raw images from this page via PyMuPDF
            # Note: PyMuPDF is 0-indexed, our page_number is 1-indexed
            fitz_page_idx = page.page_number - 1
            extracted_img_filenames = []
            if pdf_path and os.path.exists(pdf_path):
                try:
                    extracted_img_filenames = extract_page_images(pdf_path, images_dir, fitz_page_idx)
                except Exception as e:
                    print(f"Image extraction error on page {page.page_number}: {e}")
                    
            # Build the prompt
            prompt = f"""You are a professional book typesetter and Markdown expert. 
Your task is to perfectly transcribe the provided page text into beautiful, readable Markdown.
Preserve all headings, paragraphs, lists, and tables.

Raw Page Text:
{page.text_content}
"""
            if extracted_img_filenames:
                prompt += f"""
IMPORTANT: The following illustrations/diagrams were extracted from this page: {', '.join(extracted_img_filenames)}
Please insert them in the appropriate places in the Markdown using standard image syntax: `![Illustration](filename)`
Make sure you include all of them exactly where they belong based on context.
"""

            # Call AI
            openrouter_key = os.getenv("OPENROUTER_API_KEY")
            if openrouter_key:
                from openai import OpenAI
                or_client = OpenAI(base_url="https://openrouter.ai/api/v1", api_key=openrouter_key)
                response = or_client.chat.completions.create(
                  model="google/gemini-2.5-flash",
                  messages=[{"role": "user", "content": prompt}],
                  temperature=0.2
                )
                md_text = response.choices[0].message.content
            else:
                response = client.models.generate_content(
                    model='gemini-2.5-flash',
                    contents=[prompt],
                    config=types.GenerateContentConfig(
                        temperature=0.2,
                    )
                )
                md_text = response.text
            full_markdown += md_text + "\n\n---\n\n"
            
            # Respect API limits
            import time
            if idx < total_pages - 1:
                time.sleep(5)
                
        # Compilation Step
        doc.extraction_progress = "Compiling Markdown to PDF..."
        db.commit()
        
        # Convert Markdown to HTML
        html_content = markdown.markdown(full_markdown, extensions=['tables', 'fenced_code'])
        
        # Add basic CSS for a beautiful book layout
        css = """
        <style>
            @page { size: A4; margin: 2.5cm; }
            body { font-family: 'Times New Roman', serif; line-height: 1.6; font-size: 12pt; color: #333; }
            h1 { font-size: 24pt; text-align: center; margin-bottom: 2em; page-break-before: always; }
            h2 { font-size: 18pt; margin-top: 1.5em; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
            h3 { font-size: 14pt; margin-top: 1.2em; }
            p { text-align: justify; margin-bottom: 1em; }
            img { max-width: 100%; height: auto; display: block; margin: 20px auto; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 1em; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            hr { border: 0; border-top: 1px solid #eee; margin: 2em 0; }
        </style>
        """
        
        # We need to resolve image paths so xhtml2pdf can find them
        # Convert local filenames to absolute paths
        import re
        for img_name in os.listdir(images_dir):
            abs_path = os.path.abspath(os.path.join(images_dir, img_name))
            # xhtml2pdf prefers absolute paths or specific base URLs
            # Let's replace the markdown filename with the absolute path
            # Need to replace exactly the filename in the src attribute or just direct replace
            html_content = html_content.replace(img_name, abs_path)
            
        full_html = f"<html><head>{css}</head><body>{html_content}</body></html>"
        
        # Write HTML for debugging
        with open(os.path.join(exports_dir, "book.html"), "w", encoding="utf-8") as f:
            f.write(full_html)
            
        # Write Markdown for debugging
        with open(os.path.join(exports_dir, "book.md"), "w", encoding="utf-8") as f:
            f.write(full_markdown)
            
        # Generate PDF
        pdf_out_path = os.path.join(exports_dir, "recreated_book.pdf")
        with open(pdf_out_path, "w+b") as result_file:
            pisa_status = pisa.CreatePDF(
                full_html,
                dest=result_file
            )
            
        if pisa_status.err:
            raise Exception("Failed to compile PDF via xhtml2pdf")
            
        # Done!
        doc.status = "book_recreated"
        doc.extraction_progress = f"Recreation Complete! Saved to {pdf_out_path}"
        db.commit()
        
    except Exception as e:
        print(f"Book Recreation failed: {e}")
        doc.status = "processed"
        doc.extraction_progress = f"Failed to recreate book: {str(e)}"
        db.commit()

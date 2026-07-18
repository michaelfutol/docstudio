from database import SessionLocal
from book_engine import process_recreate_book
from extraction_service import extract_structured_data
from ocr_service import process_document_ocr


def _run_with_session(handler, *args) -> None:
    db = SessionLocal()
    try:
        handler(db, *args)
    finally:
        db.close()


def run_document_ocr(document_id: int) -> None:
    _run_with_session(process_document_ocr, document_id)


def run_extraction(document_id: int, template_id: int) -> None:
    _run_with_session(extract_structured_data, document_id, template_id)


def run_book_recreation(document_id: int) -> None:
    _run_with_session(process_recreate_book, document_id)

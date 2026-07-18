import re
import shutil
from pathlib import Path


def safe_download_name(filename: str, fallback: str = "document") -> str:
    name = Path(filename or fallback).name
    name = re.sub(r"[\r\n\"\\]", "_", name).strip()
    name = name.encode("ascii", "ignore").decode("ascii").strip()
    return name or fallback


def remove_if_file(path: str | Path) -> None:
    candidate = Path(path)
    if candidate.is_file():
        candidate.unlink()


def invalidate_searchable_exports(document) -> None:
    base_dir = Path(document.file_path).parent
    for suffix in ("_searchable.pdf", "_converted_searchable.pdf"):
        remove_if_file(base_dir / f"{document.id}{suffix}")


def cleanup_document_files(document) -> None:
    file_path = Path(document.file_path) if document.file_path else None
    base_dir = file_path.parent if file_path else Path("uploads")

    candidates = []
    if file_path:
        candidates.append(file_path)
    for suffix in (
        "_raw.txt",
        "_searchable.pdf",
        "_converted.pdf",
        "_converted_searchable.pdf",
    ):
        candidates.append(base_dir / f"{document.id}{suffix}")

    for page in list(document.pages):
        if page.image_path:
            candidates.append(Path(page.image_path))

    for candidate in candidates:
        remove_if_file(candidate)

    export_dir = Path("exports") / str(document.id)
    if export_dir.is_dir() and export_dir.parent.resolve() == Path("exports").resolve():
        shutil.rmtree(export_dir)

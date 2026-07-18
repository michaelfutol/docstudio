# FutolDoc AI — Document Intelligence Studio

FutolDoc AI turns PDFs and document images into reviewable text and structured records. It combines a statically deployable Next.js interface with a FastAPI backend, SQLAlchemy persistence, OCR/native-PDF processing, human review, and JSON/CSV/XLSX/TXT/PDF exports.

## Current capabilities

- Project creation, filtering, updating, exporting, and deletion
- PDF and image upload with type, project, empty-file, and size validation
- Native PDF text extraction and page rendering through PyMuPDF
- Optional Gemini transcription for scanned PDF pages
- Editable page transcripts whose corrections feed text and searchable-PDF exports
- Custom object and tabular extraction templates
- Structured extraction through Gemini or OpenRouter
- Deterministic transcription from existing page text when no AI provider is configured
- Review queue with approve/reject workflows
- JSON, CSV, XLSX, TXT, original-PDF merge, searchable-PDF, and typeset-book output
- Live backend/database/storage/provider status page

Structured extraction never fabricates placeholder records. If neither AI provider is configured, provider-dependent work returns an explicit configuration error.

## Architecture

- Frontend: Next.js 16, React 19, TypeScript, Tailwind CSS
- Backend: FastAPI, SQLAlchemy, Pydantic
- Document processing: PyMuPDF, Pillow, pypdf
- AI providers: Google Gemini and OpenRouter
- Database: SQLite by default; PostgreSQL and MySQL drivers are included

## Local development

### Backend

From the repository root:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

On Windows PowerShell, activate the environment with `.venv\Scripts\Activate.ps1`.

### Frontend

In another terminal:

```bash
cd frontend
npm ci
npm run dev
```

The default frontend API URL is `http://localhost:8000/api/v1`.

## Environment variables

Configure secrets only on the backend. Do not use `NEXT_PUBLIC_` variables for API keys.

```dotenv
GEMINI_API_KEY=
OPENROUTER_API_KEY=
DATABASE_URL=sqlite:///./document_studio.db
ALLOWED_ORIGINS=http://localhost:3000
MAX_UPLOAD_MB=50
```

Set the API URL when building the frontend for another environment:

```dotenv
NEXT_PUBLIC_API_URL=https://api.example.com/api/v1
```

Because the frontend is a static export, `NEXT_PUBLIC_API_URL` is fixed at build time.

## Verification

Run the backend workflow suite from the repository root with the virtual environment active:

```bash
python -m unittest discover -s backend/tests -v
```

Verify the frontend:

```bash
cd frontend
npm run lint
npm run build
```

The backend suite exercises project/template CRUD, PDF and image uploads, OCR edits, truthful no-provider behavior, review status validation, every data export format, merged PDFs, searchable PDFs, settings health, protected built-in templates, and cascading cleanup.

## Deployment

- Frontend: deploy the generated `frontend/out` directory to any static host after setting `NEXT_PUBLIC_API_URL`.
- Backend: deploy `backend/` as a Python web service using its Dockerfile or `uvicorn main:app --host 0.0.0.0 --port $PORT`.
- Production: use a managed database and persistent storage for uploaded/generated documents.

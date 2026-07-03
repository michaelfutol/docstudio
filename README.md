# Document Intelligence Studio

*“Don't type it. Don't trace it. Just extract it.”*

**Document Intelligence Studio** is an enterprise-grade SaaS platform that acts as a customizable "AI Data Entry Team." It allows non-technical business users (Accountants, Estimators, Lawyers, Publishers) to define exactly what data they care about in complex, messy documents, and then unleashes a team of AI agents to extract, format, and audit that data instantly.

## The Ultimate Vision

We are not just building a "PDF to Text" tool. We are building an **AI Workforce for Data Entry and Auditing**.

### 🏗️ Construction & Engineering Estimators
*   **The Pain:** Hours spent manually typing out Door Schedules, Material Quantities, and Title Block information from hundreds of architectural PDFs into PlanSwift or Excel just to *start* pricing a job.
*   **The Solution:** Upload a 100-page plan set, select the "Material Schedule" template, and the AI instantly generates a perfect, PlanSwift-ready CSV of every material required.

### 📊 Accounting & Financial Firms
*   **The Pain:** Processing hundreds of vendor invoices and crumpled receipts, manually typing line items into QuickBooks, and checking if the math adds up.
*   **The Solution:** Drop a folder of 50 invoices into the system. The AI extracts every line item, flags any invoice where the subtotal + tax doesn't equal the total (The AI Auditor), and exports a perfect spreadsheet for accounting software.

### 📚 Publishing & Archival (The Book Recreator)
*   **The Pain:** Scanning old, degraded books results in uneditable images or messy text that requires weeks of human proofreading and typesetting.
*   **The Solution:** Upload a scanned book. The "AI Pipeline" runs: Agent 1 extracts the raw text and images. Agent 2 cleans the background and formats the paragraphs. Agent 3 proofreads for OCR errors. The output is a publish-ready PDF.

## The Technological Moat

Anyone can use an AI API, but Document Intelligence Studio provides a defensible workflow:

1.  **Multi-Agent System:** Multiple AI layers (Extractor -> Formatter -> Auditor) guarantee higher accuracy and trustworthiness than a single AI pass.
2.  **Intuitive UI/UX:** A beautiful, split-screen review interface designed specifically for non-technical professionals, rather than developers.
3.  **Industry-Specific Export Formatting:** CSVs and exports that map perfectly to PlanSwift, Bluebeam, Xero, and QuickBooks out of the box.

## Architecture

*   **Frontend:** React (Next.js) with Tailwind CSS and Radix UI components.
*   **Backend:** Python (FastAPI) providing robust API endpoints.
*   **AI Engine:** Google Gemini for zero-shot, highly accurate multimodal data extraction.
*   **Database:** SQLite (dev) / PostgreSQL (prod) via SQLAlchemy ORM.

## Setup & Deployment

### Local Development
1. Clone the repository.
2. Run `npm install` and `npm run dev` in the `/frontend` directory.
3. Create a virtual environment, `pip install -r requirements.txt`, and run `uvicorn main:app --reload` in the `/backend` directory.

### Production Deployment
*   **Frontend:** Built statically (`npm run build`) and deployed to cPanel or Vercel.
*   **Backend:** Deployed to Render as a web service.

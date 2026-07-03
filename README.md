# FutolDoc AI SaaS

An intelligent, AI-powered document extraction and digitization platform. 

This SaaS application allows users to upload raw document images or scanned PDFs, perform high-accuracy OCR to generate searchable PDFs and raw text, and intelligently map the unstructured text into highly structured JSON data formats based on custom templates.

## Features
- **OCR Engine**: Utilizes Tesseract and Poppler for raw text extraction and Searchable PDF generation.
- **AI Extraction**: Employs Large Language Models (LLMs) to map unstructured text into strictly structured JSON based on user-defined templates.
- **Quality Control**: Automated confidence scoring to flag fields that require human review.
- **Hybrid Architecture**: 
  - Frontend: Next.js (Static Export for cPanel hosting)
  - Backend: FastAPI (Dockerized for Render.com)
  - Database: PostgreSQL / MySQL compatibility.

## Tech Stack
- **Frontend**: Next.js, React, TailwindCSS, shadcn/ui
- **Backend**: Python, FastAPI, SQLAlchemy, Tesseract, Poppler
- **AI**: Groq API (Llama 3) / Google Gemini API

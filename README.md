# Conseal — Correction & PII Detection

Conseal is an advanced, AI-powered document redaction and PII (Personally Identifiable Information) detection tool. 

It is designed to automatically flag sensitive information using a state-of-the-art **Two-Tier Detection Model** powered by Gemini, while providing a frictionless manual-correction surface for a human reviewer to resolve false positives, flag missed PII, and export a sanitized document.

## Features

- **Two-Tier AI Detection:** Uses `gemini-flash-lite-latest` to accurately identify potential sensitive information.
- **Smart Fallback Heuristics:** An offline scanner that double-checks the AI's work, highlighting unpunctuated digit runs and standalone capitalized words as "Candidate Misses".
- **Interactive Document Editor:** Click-and-drag to manually redact any text the AI missed. Works seamlessly on both plain text and **fully-rendered PDF files**.
- **"Why wasn't this redacted?" (Safe Explanation):** If the AI leaves text visible, you can query Gemini to explain *why* it deemed the text safe, and force-redact it if you disagree.
- **AI Rationale:** Every flagged item comes with an AI-generated explanation for why it was flagged.
- **File Import:** Upload and extract text from local files (PDF, DOCX, TXT, MD, CSV, HTML, RTF, JSON, XML). The drag-and-drop zone features premium micro-animations and depth cues.
- **Unified Redactions:** We've removed complex categorization (like "PERSON" or "ORG"). All sensitive data is simply flagged for redaction with a single, clear visual style, drastically speeding up review times.
- **Export Redacted Documents:** Download a sanitized document or a true `.pdf` file where all confirmed PII is safely blacked out.
- **Mobile Responsive & Accessible:** Fully responsive design with optimized `<select>` menus, smart idle states, and viewport scaling for flawless mobile usage. Includes a beautiful, high-contrast Dark Mode.

## Getting Started

The repository is split into two parts: a Next.js frontend and a FastAPI Python backend.

**Backend Setup:**
```bash
cd backend
python -m venv venv
venv\Scripts\activate  # or source venv/bin/activate on Mac/Linux
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000 --host 0.0.0.0
```

**Frontend Setup:**
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000 in your browser.

## API Keys

Conseal uses Google's Gemini models for PII detection and text analysis. You need to add your API key to a `.env.local` file:

You need to add your API key to a `.env.local` file inside the `frontend` folder. The Python backend is configured to automatically read from this file.

```env
# frontend/.env.local
GEMINI_API_KEY=your_google_ai_studio_key_here
```

*Note: If no API key is provided, the app will gracefully fall back to a cached detection run (`lib/sample-detection.ts`) so you can still test the UI and correction workflows.*

## Deployment

Conseal is fully configured for modern deployment:
1. **Backend**: Push to GitHub and deploy to Render using the included `render.yaml` infrastructure-as-code file. Ensure you add `GEMINI_API_KEY` to your Render environment variables.
2. **Frontend**: Import the `frontend` folder into your Vercel Dashboard. Add the Vercel URL to your backend CORS settings, and set `BACKEND_URL` in Vercel to point to your live Render API.

## Architecture

- `backend/routes/detect.py` — The core Python detection engine. Prompts Gemini with the detection prompt and maps responses to UI spans.
- `backend/routes/explain_safe.py` — On-demand AI explainer for un-flagged text.
- `backend/routes/extract_text.py` — Handles server-side document parsing via Python libraries like `pdfplumber` and `python-docx`.
- `backend/routes/redact_pdf.py` — Native Python PDF redaction using `PyMuPDF` for true visual redaction.
- `frontend/components/PDFRedactViewer.tsx` — Complex frontend PDF renderer that uses `pdfjs-dist` to draw the PDF and map visual text blocks to native DOM elements for precise text selection.
- `frontend/components/DocumentView.tsx` — The interactive document editor for plain text files.
- `frontend/components/ReviewQueue.tsx` — A risk-ranked sidebar that groups redactions by confidence level for rapid review.

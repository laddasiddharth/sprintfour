# Conseal — Correction & PII Detection

Conseal is an advanced, AI-powered document redaction and PII (Personally Identifiable Information) detection tool. 

It is designed to automatically flag sensitive information using a state-of-the-art **Two-Tier Detection Model** powered by Gemini, while providing a frictionless manual-correction surface for a human reviewer to resolve false positives, flag missed PII, and export a sanitized document.

## Features

- **Two-Tier AI Detection:** Uses `gemini-flash-lite-latest` to accurately identify:
  - **Tier 1 (Direct Identifiers):** Names, Emails, Phone Numbers, SSNs, Addresses, Account Numbers, Financial Data, and URLs.
  - **Tier 2 (Contextual Identifiers):** Organizations and Job Titles.
- **Smart Fallback Heuristics:** An offline scanner that double-checks the AI's work, highlighting unpunctuated digit runs (e.g., hidden phone numbers) and standalone capitalized words (e.g., bare first names) as "Candidate Misses".
- **Interactive Document Editor:** Click-and-drag to manually redact any text the AI missed. A sleek contextual popup will instantly appear directly above your selection (similar to Notion or Medium) for rapid categorization.
- **"Why wasn't this redacted?" (Safe Explanation):** If the AI leaves text visible, you can query Gemini to explain *why* it deemed the text safe, and force-redact it directly from the modal if you disagree.
- **AI Rationale:** Every flagged item comes with an AI-generated explanation for why it was flagged.
- **File Import:** Upload and extract text from local files (PDF, DOCX, TXT, MD, CSV, HTML, RTF, JSON, XML). The drag-and-drop zone features premium micro-animations and depth cues.
- **Export Redacted Documents:** Download a sanitized, multi-page `.pdf` file with automatic text-wrapping, where all confirmed PII is safely replaced with bracketed tags (e.g., `[NAME]`, `[EMAIL]`).
- **Inline Confidence Scores:** AI confidence percentages (e.g., `100%`) are displayed directly on PII tags in the document viewer, giving instant visibility into the model's certainty without extra clicks.
- **Mobile Responsive & Accessible:** Fully responsive design with optimized `<select>` menus, smart idle states, and viewport scaling for flawless mobile usage. Includes a beautiful, high-contrast Dark Mode.

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:3000 in your browser.

## API Keys

Conseal uses Google's Gemini models for PII detection and text analysis. You need to add your API key to a `.env.local` file:

```env
GEMINI_API_KEY=your_google_ai_studio_key_here
```

*Note: If no API key is provided, the app will gracefully fall back to a cached detection run (`lib/sample-detection.ts`) so you can still test the UI and correction workflows.*

## Deployment

Conseal is fully configured for zero-config deployment on Vercel. 
1. Push your code to GitHub.
2. Import the repository in your Vercel Dashboard.
3. Add your `GEMINI_API_KEY` to the Vercel Environment Variables.
4. Deploy! The `.gitignore` and `eslint` configurations are fully locked down for a flawless production build.

## Architecture

- `app/api/detect/route.ts` — The core detection engine. Prompts Gemini with the two-tier prompt and maps responses to UI tags.
- `app/api/explain/route.ts` & `app/api/explain-safe/route.ts` — On-demand AI explainers for flagged and un-flagged text.
- `app/api/extract-text/route.ts` — Handles server-side document parsing and text extraction for uploaded files.
- `lib/heuristics.ts` — Offline backup scanner that aggressively highlights potentially missed identifiers for human review.
- `lib/segments.ts` — The rendering engine that seamlessly merges AI suggestions, manual overrides, and heuristic candidates into a single interactive text view.
- `components/DocumentView.tsx` — The interactive document editor with selection tracking.
- `components/ReviewQueue.tsx` — A risk-ranked sidebar that groups redactions by confidence level for rapid review.

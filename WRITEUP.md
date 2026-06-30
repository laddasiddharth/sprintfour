# Conseal — Correction (Writeup)

## The Problem
Sam's failure mode isn't carelessness; it's trust. When a tool is "usually right," users stop double-checking. This leads to dangerous under-redaction (missed PII) or annoying over-redaction. The goal was to build an interface that actively directs Sam's limited attention to where a careless glance costs the most.

## Our Approach
We split corrections into clear risk profiles:
- **Possible Misses:** High risk. Ranked at the top of the queue. We use a lightweight heuristic pass to catch unpunctuated digits or bare capitalized names that the primary detector might have ignored.
- **Low-Confidence Redactions:** Medium risk. Requires a quick human verify.
- **High-Confidence Redactions:** Low risk. Mostly collapsed to save mental effort.

## Recent UI & UX Enhancements
To ensure a premium, production-ready experience, we recently overhauled the application's usability and responsiveness:

1. **Intuitive Document Layout:** Moved the color-coded legend to the top of the document view for instant context before reading.
2. **Confidence Scores at a Glance:** The AI's confidence percentage (e.g., `98%`) is now displayed directly on the tags within the document, removing the need to click to see the AI's certainty.
3. **Flawless Mobile Responsiveness:** Added global viewport meta tags, fixed layout constraints, and allowed horizontal text to wrap gracefully. The UI now looks native and scales perfectly down to mobile screens.
4. **Unified Redaction Strategy:** Eliminated unnecessary PII categories (like distinguishing between "ORG" and "PERSON"). All sensitive data is now treated uniformly, drastically reducing cognitive load during review.
5. **Accessible Dark Mode:** Overhauled the dark mode color palette, specifically tweaking neutral text colors for high-contrast, effortless readability against dark backgrounds. 
6. **Robust Python Backend:** Split the architecture to move heavy document processing (like PDF extraction and visual redaction) to a high-performance Python FastAPI backend, while keeping the UI snappy in Next.js.
7. **True Visual PDF Redaction:** Built a custom PDF renderer that allows native text selection on original PDFs, and securely blacks out pixels on the final exported document using PyMuPDF.
8. **Premium UI Micro-Animations:** Replaced static layouts with elegant typography gradients, tactile button hover states, and smooth drag-and-drop depth cues, making the tool feel fast, modern, and satisfying to use.

## What's Next?
Given more time, we would implement keyboard-only triage (so Sam never has to reach for the mouse) and multi-document batching to improve his throughput even further.

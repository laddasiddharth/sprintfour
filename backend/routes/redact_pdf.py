"""
POST /api/redact-pdf-export

Accepts:
  - file: UploadFile  — the original PDF
  - redactions: str   — JSON array of { text: string, type: string }

Uses PyMuPDF to search for PII text on each page, draw permanent black
rectangles over them, and remove the underlying text data.
Returns the redacted PDF as a download.
"""

import io
import json
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import StreamingResponse

router = APIRouter()


@router.post("/redact-pdf-export")
async def redact_pdf_export(
    file: UploadFile = File(...),
    redactions: str = Form(...),
):
    content = await file.read()

    try:
        redaction_list: list[dict] = json.loads(redactions)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON in 'redactions' field.")

    if not redaction_list:
        # Nothing to redact — return original unchanged
        return StreamingResponse(
            io.BytesIO(content),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="redacted-{file.filename}"'
            },
        )

    # Sort by length descending to avoid partial-match issues
    sorted_redactions = sorted(redaction_list, key=lambda r: len(r.get("text", "")), reverse=True)

    try:
        import fitz  # PyMuPDF

        doc = fitz.open(stream=content, filetype="pdf")

        for page in doc:
            for r in sorted_redactions:
                pii_text = r.get("text", "").strip()
                if not pii_text:
                    continue

                # search_for returns a list of Rect objects
                areas = page.search_for(pii_text)
                for area in areas:
                    # add_redact_annot: fill=(0,0,0) = solid black
                    page.add_redact_annot(area, fill=(0, 0, 0))

            # apply_redactions: burns black bars AND removes underlying text data
            page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE)

        out = io.BytesIO()
        doc.save(out, garbage=4, deflate=True)
        doc.close()

        filename = file.filename or "document.pdf"
        return StreamingResponse(
            io.BytesIO(out.getvalue()),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="redacted-{filename}"'
            },
        )

    except ImportError:
        raise HTTPException(
            status_code=500,
            detail="PyMuPDF is not installed. Run: pip install PyMuPDF",
        )
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Failed to redact PDF: {err}")

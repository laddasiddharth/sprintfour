import os
from google import genai
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class ExplainRequest(BaseModel):
    text: str
    type: str
    context: str


@router.post("/explain")
async def explain_pii(req: ExplainRequest):
    api_key = os.environ.get("GEMINI_API_KEY")

    if not api_key:
        return {
            "explanation": (
                f'"{req.text}" was flagged as a {req.type} because it appears to identify '
                f"a specific individual and may be considered personally identifiable information "
                f"(PII) under privacy regulations."
            ),
            "shouldRedact": True,
            "error": True,
        }

    try:
        prompt = f"""You are a privacy expert reviewing a document for PII redaction.

The following text was flagged as a potential "{req.type}":
"{req.text}"

It appears in this context:
"...{req.context}..."

In 1-2 short sentences, explain:
1. Whether this is genuinely PII that should be redacted before the document is shared externally.
2. Why or why not, using plain language a non-expert reviewer would understand.

Be direct and specific. Do not use bullet points. Do not start with "I"."""

        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model="gemini-flash-lite-latest",
            contents=prompt,
        )
        explanation = response.text.strip()
        return {"explanation": explanation, "shouldRedact": True}

    except Exception as err:
        return {
            "explanation": (
                f'"{req.text}" was flagged as a {req.type}. This type of information can identify '
                f"a specific individual and is typically redacted before documents are shared externally."
            ),
            "shouldRedact": True,
            "error": True,
        }

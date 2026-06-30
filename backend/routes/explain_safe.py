import os
from google import genai
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class ExplainSafeRequest(BaseModel):
    text: str
    context: str


@router.post("/explain-safe")
async def explain_safe(req: ExplainSafeRequest):
    api_key = os.environ.get("GEMINI_API_KEY")

    if not api_key:
        return {
            "explanation": (
                f'"{req.text}" was evaluated by the tool but not flagged. It likely appears to be '
                f"a generic term, a business name, or lacks enough context to be confidently "
                f"identified as a person's private information."
            ),
            "error": True,
        }

    try:
        prompt = f"""You are a privacy expert reviewing a document for PII redaction.

The following text was left VISIBLE (not redacted):
"{req.text}"

It appears in this context:
"...{req.context}..."

The user is worried this might be sensitive PII that was missed.
In 1-2 short sentences, explain why a PII detector might have considered this "safe" to leave visible. For example, is it a case citation? A generic business term? Or just ordinary vocabulary?

Be direct and specific. Do not use bullet points. Do not start with "I"."""

        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model="gemini-flash-lite-latest",
            contents=prompt,
        )
        explanation = response.text.strip()
        return {"explanation": explanation}

    except Exception as err:
        return {
            "explanation": (
                f'"{req.text}" was not flagged as PII. It likely appears to be a generic term or '
                f"business information that does not identify a specific private individual."
            ),
            "error": True,
        }

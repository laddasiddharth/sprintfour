import os
from dotenv import load_dotenv

# Load from parent directory's .env.local (Next.js convention) first,
# then from local .env if it exists
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", "frontend", ".env.local"))
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import detect, explain, explain_safe, extract_text, redact_doc, redact_pdf

app = FastAPI(title="Conseal PII API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(detect.router, prefix="/api")
app.include_router(explain.router, prefix="/api")
app.include_router(explain_safe.router, prefix="/api")
app.include_router(extract_text.router, prefix="/api")
app.include_router(redact_doc.router, prefix="/api")
app.include_router(redact_pdf.router, prefix="/api")


@app.get("/")
def root():
    return {"status": "ok", "service": "Conseal PII API"}

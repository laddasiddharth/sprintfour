@echo off
echo Starting Conseal Python Backend...
echo.
cd /d "%~dp0"

REM Install dependencies (idempotent)
python -m pip install -r requirements.txt --quiet

echo.
echo Backend running at http://localhost:8000
echo Press Ctrl+C to stop.
echo.
python -m uvicorn main:app --reload --port 8000 --host 0.0.0.0

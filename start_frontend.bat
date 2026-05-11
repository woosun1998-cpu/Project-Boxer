@echo off
cd /d "%~dp0"
start "" cmd /c "cd /d \"%~dp0backend\" && py -m uvicorn main:app --reload"
timeout /t 4 /nobreak >nul
start "" "http://127.0.0.1:8000/index.html"

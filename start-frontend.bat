@echo off
REM Legacy frontend launcher
chcp 65001 >nul
set "ROOT=%~dp0"
cd /d "%ROOT%frontend" || exit /b 1
start "" "http://localhost:5500/index.html"
echo [Boxer] frontend static server starting on port 5500.
echo [Boxer] Browser URL: http://localhost:5500/index.html
echo.
py -m http.server 5500
pause

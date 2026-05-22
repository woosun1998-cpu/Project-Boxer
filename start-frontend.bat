@echo off
REM Legacy frontend launcher
chcp 65001 >nul
set "ROOT=%~dp0"
cd /d "%ROOT%" || exit /b 1
start "" "http://localhost:5500/index.html"
echo [Boxer] frontend static server on port 5500 (Range/206 for mp4).
echo [Boxer] Browser URL: http://localhost:5500/index.html
echo.
node scripts\serve-frontend.cjs
pause

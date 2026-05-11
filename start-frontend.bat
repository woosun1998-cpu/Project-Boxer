@echo off
REM Boxer 프론트 정적 서버 (권장: frontend 폴더를 루트로)
chcp 65001 >nul
set "ROOT=%~dp0"
cd /d "%ROOT%frontend" || exit /b 1
echo [Boxer] 브라우저에서 http://localhost:5500/index.html 을 여세요.
echo.
py -m http.server 5500
pause

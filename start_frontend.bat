@echo off
REM Legacy alias for the frontend launcher.
REM Serve the static frontend from the frontend folder and open the correct URL.
chcp 65001 >nul
set "ROOT=%~dp0"
cd /d "%ROOT%frontend" || exit /b 1
start "" "http://localhost:5500/index.html"
echo [Boxer] frontend 정적 서버를 5500 포트에서 실행합니다.
echo [Boxer] 브라우저에서 http://localhost:5500/index.html 을 여세요.
echo.
py -m http.server 5500

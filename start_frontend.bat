@echo off
REM Legacy alias for the frontend launcher.
REM Serve the static frontend from the frontend folder and open the correct URL.
chcp 65001 >nul
set "ROOT=%~dp0"
cd /d "%ROOT%" || exit /b 1
start "" "http://localhost:5500/index.html"
echo [Boxer] frontend 정적 서버를 5500 포트에서 실행합니다 (Range/206 지원).
echo [Boxer] 브라우저: http://localhost:5500/index.html
echo [Boxer] 대용량 mp4 재생 시 py -m http.server 대신 이 스크립트를 사용하세요.
echo.
node scripts\serve-frontend.cjs

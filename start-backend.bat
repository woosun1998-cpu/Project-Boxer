@echo off
REM Boxer 백엔드 실행 (FastAPI + Uvicorn)
REM 사용 전: MySQL 실행, backend\.env 설정
chcp 65001 >nul
set "ROOT=%~dp0"
cd /d "%ROOT%backend" || exit /b 1

if not exist ".env" (
  echo [Boxer] backend\.env 가 없습니다.
  echo [Boxer] MySQL 접속 정보가 필요합니다. 아래 예시대로 backend\.env 를 만들어주세요:
  echo.
  echo   DB_HOST=localhost
  echo   DB_PORT=3306
  echo   DB_NAME=boxer_db
  echo   DB_USER=root
  echo   DB_PASSWORD=^<YOUR_MYSQL_PASSWORD^>
  echo.
  echo [Boxer] 만든 후 다시 start-backend.bat 를 실행하세요.
  pause
  exit /b 1
)

findstr /C:"YOUR_PASSWORD" ".env" >nul 2>nul
if %errorlevel%==0 (
  echo [Boxer] backend\.env 에 아직 YOUR_PASSWORD 가 남아 있습니다.
  echo [Boxer] DB_PASSWORD 를 실제 MySQL 비밀번호로 바꿔주세요.
  pause
  exit /b 1
)

findstr /C:"DB_PASSWORD=CHANGE_ME" ".env" >nul 2>nul
if %errorlevel%==0 (
  echo [Boxer] backend\.env 의 DB_PASSWORD=CHANGE_ME 를 실제 MySQL 비밀번호로 바꿔주세요.
  pause
  exit /b 1
)

if not exist "venv\Scripts\activate.bat" (
  echo [Boxer] 가상환경 생성 중...
  py -m venv venv
)

call venv\Scripts\activate.bat
pip install -r requirements.txt -q
python scripts\init_db.py

set "UVICORN_PORT=8000"
for /f "tokens=2 delims==" %%p in ('findstr /B /C:"PORT=" ".env" 2^>nul') do set "UVICORN_PORT=%%p"

echo.
echo [Boxer] API: http://localhost:%UVICORN_PORT%/docs
echo [Boxer] frontend js/core/api.js 의 BOXER_API_PORT 가 같아야 로그인 등 API 가 동작합니다.
echo.
py -m uvicorn main:app --reload --host 0.0.0.0 --port %UVICORN_PORT%
pause

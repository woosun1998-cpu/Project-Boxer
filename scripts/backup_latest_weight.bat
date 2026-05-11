@echo off
REM 최신 학습 가중치를 자동으로 찾아 안전 백업합니다.
REM 무엇: runs/detect/runs/obstacle/*/weights/best.pt 중 가장 최신 파일 백업
REM 왜: 학습 직후 실수/병합 충돌로 파일이 사라져도 복구 가능하게 하기 위해

chcp 65001 >nul
setlocal enabledelayedexpansion

set "ROOT=%~dp0.."
set "PY=%ROOT%\backend\venv\Scripts\python.exe"
set "SCRIPT=%ROOT%\scripts\secure_model_backup.py"
set "LATEST="

if not exist "%PY%" (
  echo [백업] Python 실행 파일이 없습니다: %PY%
  exit /b 1
)

if not exist "%SCRIPT%" (
  echo [백업] 백업 스크립트가 없습니다: %SCRIPT%
  exit /b 1
)

for /f "delims=" %%F in ('dir /b /s /a:-d "%ROOT%\runs\detect\runs\obstacle\*\weights\best.pt" ^| sort /R') do (
  if not defined LATEST set "LATEST=%%F"
)

if "%LATEST%"=="" (
  echo [백업] best.pt 파일을 찾지 못했습니다.
  exit /b 1
)

echo [백업] 최신 가중치: %LATEST%
"%PY%" "%SCRIPT%" ^
  --source "%LATEST%" ^
  --backup-root "%ROOT%\model_backups" ^
  --tag "latest" ^
  --notes "학습 직후 자동 백업" ^
  --copy-to-models "%ROOT%\models\weights\latest-best.pt"

if errorlevel 1 (
  echo [백업] 실패
  exit /b 1
)

echo [백업] 완료
endlocal

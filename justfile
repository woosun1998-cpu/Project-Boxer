set windows-shell := ["powershell.exe", "-NoLogo", "-NoProfile", "-Command"]
set dotenv-load := true
set dotenv-path := "./backend/.env"

ROOT := justfile_directory()

default:
    @just --list

# ─────────────────────────────
# Frontend — frontend 폴더를 루트로 http.server 5500
# ─────────────────────────────
[unix]
start-frontend:
    #!/usr/bin/env bash
    set -eu
    echo "[Boxer] 브라우저에서 http://localhost:5500/index.html 을 여세요."
    cd "{{ROOT}}/frontend"
    python3 -m http.server 5500

[windows]
start-frontend:
    #!powershell.exe
    $ErrorActionPreference = "Stop"
    Write-Host "[Boxer] 브라우저에서 http://localhost:5500/index.html 을 여세요."
    Set-Location "{{ROOT}}\frontend"
    py -m http.server 5500

# ─────────────────────────────
# Backend — FastAPI + Uvicorn
# 사용 전: MySQL 실행, backend/.env 설정
# ─────────────────────────────
[unix]
start-backend:
    #!/usr/bin/env bash
    set -eu
    cd "{{ROOT}}/backend"

    # .env 없으면 알리고 종료
    if [ ! -f .env ]; then
      echo "[Boxer] backend/.env 가 없습니다."
      echo "[Boxer] MySQL 접속 정보가 필요합니다. 아래 예시대로 backend/.env 를 만들어주세요:"
      echo
      echo "  DB_HOST=localhost"
      echo "  DB_PORT=3306"
      echo "  DB_NAME=boxer_db"
      echo "  DB_USER=root"
      echo "  DB_PASSWORD=<YOUR_MYSQL_PASSWORD>"
      echo
      exit 1
    fi

    # 비번 기본값이면 혼냄
    if grep -q "YOUR_PASSWORD" .env; then
      echo "[Boxer] backend/.env 에 아직 YOUR_PASSWORD 가 남아 있습니다."
      exit 1
    fi
    if grep -q "DB_PASSWORD=CHANGE_ME" .env; then
      echo "[Boxer] backend/.env 의 DB_PASSWORD=CHANGE_ME 를 실제 비밀번호로 바꿔주세요."
      exit 1
    fi

    # 가상환경 (.venv 우선, 없으면 venv, 둘 다 없으면 .venv 생성)
    if [ -f .venv/bin/activate ]; then
      source .venv/bin/activate
    elif [ -f venv/bin/activate ]; then
      source venv/bin/activate
    else
      echo "[Boxer] 가상환경 생성 중..."
      python3 -m venv .venv
      source .venv/bin/activate
    fi

    # pip 없으면 uv pip 로 폴백
    if command -v pip >/dev/null 2>&1; then
      pip install -r requirements.txt -q
    elif command -v uv >/dev/null 2>&1; then
      uv pip install -r requirements.txt -q
    else
      echo "[Boxer] pip 과 uv 둘 다 없습니다. 하나는 설치해 주세요."
      exit 1
    fi

    # PORT 는 dotenv-load 로 자동 주입 (없으면 8000)
    UVICORN_PORT="${PORT:-8000}"
    echo
    echo "[Boxer] API: http://localhost:${UVICORN_PORT}/docs"
    echo "[Boxer] frontend js/core/api.js 의 BOXER_API_PORT 가 같아야 로그인 등 API 가 동작합니다."
    echo
    python -m uvicorn main:app --reload --host 0.0.0.0 --port "${UVICORN_PORT}"

[windows]
start-backend:
    #!powershell.exe
    $ErrorActionPreference = "Stop"
    Set-Location "{{ROOT}}\backend"

    if (-not (Test-Path .env)) {
      Write-Host "[Boxer] backend\.env 가 없습니다."
      Write-Host "[Boxer] MySQL 접속 정보가 필요합니다. 아래 예시대로 backend\.env 를 만들어주세요:"
      Write-Host ""
      Write-Host "  DB_HOST=localhost"
      Write-Host "  DB_PORT=3306"
      Write-Host "  DB_NAME=boxer_db"
      Write-Host "  DB_USER=root"
      Write-Host "  DB_PASSWORD=<YOUR_MYSQL_PASSWORD>"
      Write-Host ""
      exit 1
    }

    if (Select-String -Path .env -Pattern "YOUR_PASSWORD" -Quiet) {
      Write-Host "[Boxer] backend\.env 에 아직 YOUR_PASSWORD 가 남아 있습니다."
      exit 1
    }
    if (Select-String -Path .env -Pattern "DB_PASSWORD=CHANGE_ME" -Quiet) {
      Write-Host "[Boxer] backend\.env 의 DB_PASSWORD=CHANGE_ME 를 실제 비밀번호로 바꿔주세요."
      exit 1
    }

    # 가상환경 (.venv 우선, 없으면 venv, 둘 다 없으면 .venv 생성)
    if (Test-Path .venv\Scripts\Activate.ps1) {
      & .venv\Scripts\Activate.ps1
    } elseif (Test-Path venv\Scripts\Activate.ps1) {
      & venv\Scripts\Activate.ps1
    } else {
      Write-Host "[Boxer] 가상환경 생성 중..."
      py -m venv .venv
      & .venv\Scripts\Activate.ps1
    }

    # pip 없으면 uv pip 로 폴백
    if (Get-Command pip -ErrorAction SilentlyContinue) {
      pip install -r requirements.txt -q
    } elseif (Get-Command uv -ErrorAction SilentlyContinue) {
      uv pip install -r requirements.txt -q
    } else {
      Write-Host "[Boxer] pip 과 uv 둘 다 없습니다. 하나는 설치해 주세요."
      exit 1
    }

    # PORT 는 dotenv-load 로 자동 주입 (없으면 8000)
    $UvicornPort = if ($env:PORT) { $env:PORT } else { "8000" }
    Write-Host ""
    Write-Host "[Boxer] API: http://localhost:$UvicornPort/docs"
    Write-Host "[Boxer] frontend js/core/api.js 의 BOXER_API_PORT 가 같아야 로그인 등 API 가 동작합니다."
    Write-Host ""
    python -m uvicorn main:app --reload --host 0.0.0.0 --port $UvicornPort

# ─────────────────────────────
# Database — MySQL (docker compose)
# backend/docker/docker-compose.yml 의 db 서비스만 기동
# ─────────────────────────────
[unix]
db-up:
    #!/usr/bin/env bash
    set -eu
    cd "{{ROOT}}/backend/docker"
    docker compose --env-file ../.env up -d db
    echo "[Boxer] MySQL: localhost:${DB_PORT:-3306} (db=${DB_NAME:-boxer_db})"

[unix]
db-down:
    #!/usr/bin/env bash
    set -eu
    cd "{{ROOT}}/backend/docker"
    docker compose down

# ─────────────────────────────
# DB 초기화 — scripts/init_db.py 실행 (Windows 전용)
# unix 는 docker compose 가 schema.sql/seed.sql 을 자동 적용하므로 불필요
# 사용 전: venv 준비 (start-backend 한 번 돌리면 생성됨), DB 기동
# ─────────────────────────────
[windows]
db-init:
    #!powershell.exe
    $ErrorActionPreference = "Stop"
    Set-Location "{{ROOT}}\backend"

    if (Test-Path .venv\Scripts\Activate.ps1) {
      & .venv\Scripts\Activate.ps1
    } elseif (Test-Path venv\Scripts\Activate.ps1) {
      & venv\Scripts\Activate.ps1
    } else {
      Write-Host "[Boxer] 가상환경이 없습니다. 먼저 'just start-backend' 로 venv 를 만들어주세요."
      exit 1
    }

    python scripts\init_db.py

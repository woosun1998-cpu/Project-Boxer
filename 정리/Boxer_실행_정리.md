# Boxer 프로젝트 실행 정리

## 1) 기본 정보
- 프로젝트 루트: `C:\Users\EZ\Boxer`
- 백엔드 루트: `C:\Users\EZ\Boxer\backend`
- 백엔드 포트: `8000`
- 권장 Python 버전: `3.11` 또는 `3.12`
- 소스·문서는 **UTF-8**로 저장 (한글 깨짐 방지). 루트에 `.editorconfig` 참고.
- 원클릭 실행: 프로젝트 루트의 `start-backend.bat`, `start-frontend.bat` (콘솔에서 한글 깨지면 `chcp 65001`)

---

## 2) 로컬 실행 (Windows, 권장)

### 2-1. 백엔드 폴더 이동
```powershell
cd C:\Users\EZ\Boxer\backend
```

### 2-2. 가상환경 생성 및 활성화
```powershell
python -m venv venv
.\venv\Scripts\activate
```

### 2-3. 패키지 설치
```powershell
pip install -r requirements.txt
```

### 2-4. 환경변수 파일(`.env`) 확인
`backend/.env` 파일에 아래 값이 실제 환경과 맞는지 확인:
- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `DATABASE_URL`
- `JWT_SECRET_KEY`
- `GEMINI_API_KEY` (AI 코칭 기능 사용할 때)

### 2-5. DB 초기화 스크립트 실행
```powershell
python scripts/init_db.py
```

### 2-6. FastAPI 서버 실행
```powershell
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 2-7. 접속 확인
- Swagger: <http://localhost:8000/docs>
- 헬스체크: <http://localhost:8000/api/health>
- DB 헬스체크: <http://localhost:8000/api/health/db>

---

## 3) 프론트엔드 실행 (정적 파일)

프론트는 정적 HTML/CSS/JS 구조이므로 `frontend` 폴더를 로컬 서버로 열면 됩니다.

예시(파이썬 내장 서버):
```powershell
cd C:\Users\EZ\Boxer\frontend
python -m http.server 5500
```

접속:
- <http://localhost:5500/index.html>

주의 (404 방지):
- **`frontend` 폴더에서 서버를 띄운 경우** 주소는 `/index.html`, `/sparring.html` 처럼 **파일 이름만** 쓰면 됩니다.
- 예: `http://localhost:5500/sparring.html` (O) — `http://localhost:5500/frontend/sparring.html` (X)

추가:
- 프론트 API 호출 대상은 백엔드 `http://localhost:8000` 이어야 합니다.
- 백엔드 서버가 먼저 실행 중이어야 주요 기능(로그인/튜토리얼/게임 API)이 동작합니다.

---

## 4) Docker로 한 번에 실행

### 4-1. Docker 폴더 이동
```powershell
cd C:\Users\EZ\Boxer\backend\docker
```

### 4-2. 컨테이너 실행
```powershell
docker compose up --build
```

백그라운드 실행:
```powershell
docker compose up -d --build
```

### 4-3. 중지
```powershell
docker compose down
```

---

## 5) 자주 발생하는 문제

### DB 연결 오류
- MySQL이 실행 중인지 확인
- `backend/.env`의 `DB_PASSWORD`, `DATABASE_URL` 확인
- 로컬 MySQL과 Docker MySQL을 동시에 사용할 때 포트 충돌 여부 확인

### 포트 충돌
- `8000`, `3306`, `5500` 포트가 이미 사용 중인지 확인
- 충돌 시 점유 프로세스를 종료하거나 포트를 변경

### 모듈 설치 오류
- 가상환경 활성화 후 `pip install -r requirements.txt` 재실행
- Python 버전이 너무 최신(예: 3.14+)이면 3.11/3.12로 재시도 권장

---

## 6) 가장 빠른 실행 순서 (요약)

```powershell
cd C:\Users\EZ\Boxer\backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
python scripts/init_db.py
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

추가 터미널:
```powershell
cd C:\Users\EZ\Boxer\frontend
python -m http.server 5500
```

---

## 7) 다른 PC(팀원)에서 실행할 때

### 7-1. 경로만 본인 PC 기준으로 바꾸기
문서에 있는 `C:\Users\EZ\Boxer` 경로는 예시입니다.  
팀원은 프로젝트를 내려받은 실제 경로로 `cd` 명령만 바꿔서 실행하면 됩니다.

예시:
- 원문: `cd C:\Users\EZ\Boxer\backend`
- 팀원 PC: `cd D:\work\boxer\backend`

- 원문: `cd C:\Users\EZ\Boxer\frontend`
- 팀원 PC: `cd D:\work\boxer\frontend`

### 7-2. 공통 확인 사항
- Python 버전: `3.11` 또는 `3.12`
- 가상환경 생성/활성화 후 `pip install -r requirements.txt`
- `backend/.env` 값 확인:
  - `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
  - `DATABASE_URL`
  - `JWT_SECRET_KEY`
  - `GEMINI_API_KEY` (필요 시)

### 7-3. 실행 순서 (팀원용 요약)
```powershell
cd [본인_프로젝트_경로]\backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
python scripts/init_db.py
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

추가 터미널:
```powershell
cd [본인_프로젝트_경로]\frontend
python -m http.server 5500
```

접속:
- 백엔드 Swagger: <http://localhost:8000/docs>
- 프론트: <http://localhost:5500/index.html>

# Boxer 실행 점검 결과

점검일: 2026-04-16

## 현재 실행 상태
- 백엔드(FastAPI): 실행 중
- 프론트엔드(정적 서버): 실행 중
- 백엔드 헬스체크: 정상(200)
- DB 헬스체크: 정상(200)
- 프론트 index 페이지: 정상(200)

## 실제 점검 항목
아래 URL 응답을 직접 확인함:

1. `http://localhost:8000/api/health` → `200`
2. `http://localhost:8000/api/health/db` → `200`
3. `http://localhost:5500/index.html` → `200`

## 현재 사용 중인 실행 명령

### 백엔드
```powershell
cd C:\Users\EZ\Boxer\backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
python scripts/init_db.py
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 프론트엔드
```powershell
cd C:\Users\EZ\Boxer\frontend
python -m http.server 5500
```

## 접속 주소
- Swagger: <http://localhost:8000/docs>
- API Health: <http://localhost:8000/api/health>
- Frontend: <http://localhost:5500/index.html>

## 참고
- 서버 중지 시 현재 실행 중인 터미널에서 `Ctrl + C` 입력
- 재실행 시 백엔드 먼저, 프론트엔드 나중 순서 권장

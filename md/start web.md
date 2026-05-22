# Boxer 웹 실행 방법

이 문서는 Boxer 프로젝트를 웹에서 띄우는 방법을 정리한 안내서입니다.

## 1. 백엔드 실행

백엔드는 FastAPI로 실행합니다.

```powershell
cd backend
py -m pip install -r requirements.txt
py scripts\init_db.py
uvicorn main:app --reload
```

- 백엔드 주소: `http://127.0.0.1:8000`
- 확인용 주소: `http://127.0.0.1:8000/`
- API 문서: `http://127.0.0.1:8000/docs`

## 2. 프런트엔드 실행

프런트엔드는 정적 서버로 띄웁니다.

```powershell
cd ..
py -m http.server 5500
```

브라우저에서 아래 주소로 접속합니다.

- `http://127.0.0.1:5500/frontend/index.html`
- `http://127.0.0.1:5500/frontend/tutorial.html`
- `http://127.0.0.1:5500/frontend/sparring.html`

## 3. DB 확인

백엔드는 MySQL을 사용하므로 `backend/.env`의 DB 정보가 맞아야 합니다.

- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`

MySQL 서버가 꺼져 있으면 먼저 실행해야 합니다.

## 4. 자주 막히는 부분

- `uvicorn` 실행이 안 되면 `backend` 폴더에서 실행했는지 확인합니다.
- 화면은 뜨는데 데이터가 안 나오면 백엔드 주소와 CORS 설정을 확인합니다.
- 이미지나 영상이 안 나오면 `frontend/assets`와 `frontend/image` 경로를 확인합니다.

## 5. 진짜 웹에 올릴 때

로컬 실행이 아니라 외부 웹에 배포하려면 보통 이렇게 나눕니다.

- 프런트엔드: GitHub Pages 같은 정적 호스팅
- 백엔드: Render, Railway, Fly.io, VPS 같은 서버

이 경우 프런트엔드의 API 주소를 배포된 백엔드 주소로 바꿔야 합니다.
또한 `backend/.env`의 `CORS_ORIGINS`도 배포 도메인에 맞게 수정해야 합니다.

## 6. 실행 순서 요약

1. MySQL 실행
2. `backend`에서 백엔드 실행
3. 프로젝트 루트에서 정적 서버 실행
4. 브라우저에서 `frontend/index.html` 접속

# Home PC Setup Checklist

집 PC에서 처음 세팅할 때는 아래 1~10 순서대로 진행하면 됩니다.

1. GitHub에서 프로젝트 받기
```powershell
git clone https://github.com/soypark7777-creator/boxer.git
cd boxer
git checkout main
git pull origin main
```

2. Python 설치 확인
```powershell
py --version
```

3. MySQL 설치 및 실행 확인
- 집 PC에도 MySQL 서버가 켜져 있어야 함

4. 백엔드 패키지 설치
```powershell
cd backend
py -m pip install -r requirements.txt
```

5. `.env` 만들기
- `backend/.env.example` 를 참고해서 `backend/.env` 생성
- 집 PC MySQL 정보로 `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` 입력

6. DB 초기화
```powershell
py .\scripts\init_db.py
```

7. 추가 SQL 적용
- 튜토리얼 영상 경로 반영
- 스파링 영상 목록 반영

실행 파일:
```text
backend/app/db/update_tutorial_video_urls.sql
backend/app/db/seed_sparring_videos.sql
```

8. 백엔드 서버 실행
```powershell
py -m uvicorn main:app --reload
```

9. 프론트 서버 실행
프로젝트 루트의 새 터미널에서:
```powershell
py -m http.server 5500
```

10. 최종 확인
- `http://127.0.0.1:5500/frontend/index.html`
- `http://127.0.0.1:5500/frontend/tutorial.html`
- `http://127.0.0.1:5500/frontend/sparring.html`

## 꼭 확인할 것

- `frontend/assets/videos/` 안의 mp4 파일들이 GitHub에서 같이 받아졌는지 확인
- MySQL 계정/비밀번호가 `backend/.env` 와 같은지 확인
- 스파링 전투 영상이 안 뜨면 `attack_videos` DB 등록 여부 확인

## 참고 문서

- [TODAY_HANDOFF.md](c:/Users/User/Desktop/PROJECT/실버 운동앱/luma_pose_video_vscode/boxer/TODAY_HANDOFF.md)
- [backend/API_VIDEO_SAMPLES.md](c:/Users/User/Desktop/PROJECT/실버 운동앱/luma_pose_video_vscode/boxer/backend/API_VIDEO_SAMPLES.md)

# Boxer 개선 우선순위 · 영상 정확도 · UI · 배포

작성 기준: 로컬 실행 안정화 → 기능 품질 → 상용 수준 운영.

---

## 우선순위 1 — 반드시 먼저 (동작 보장)

1. **UTF-8 통일**  
   - 에디터에서 모든 소스·문서를 UTF-8(무 BOM 권장)로 저장.  
   - 저장소 루트 `.editorconfig`, `.gitattributes`로 줄바꿈·인코딩 습관 통일.

2. **프론트 실행 방식 고정**  
   - `frontend` 폴더에서 `py -m http.server 5500` 후 `http://localhost:5500/index.html`  
   - 링크는 상대 경로(`sparring.html` 등)로 통일해 두었음.

3. **백엔드·DB**  
   - MySQL 가동, `backend/.env`의 접속 정보 일치.  
   - `python scripts/init_db.py` 후 `uvicorn` 실행.

4. **CORS**  
   - `localhost` / `127.0.0.1` 혼용에 대비해 백엔드 `CORS_ORIGINS`에 둘 다 허용.

---

## 우선순위 2 — 짧은 주기로 (품질)

1. **깨진 한글 문자열 정리**  
   - 과거 인코딩 깨짐이 남은 HTML/주석은 파일 단위로 복구.  
   - UI에 보이는 문구부터 우선(버튼·라벨·타이틀).

2. **에셋 404**  
   - `index.html` 등에서 참조하는 이미지가 실제 `frontend/assets/images/`에 있는지 확인.  
   - 없으면 이미지 추가 또는 HTML에서 참조 제거/대체.

3. **API·프론트 계약**  
   - 응답 형식 `{ success, data }` unwrap 등 `api.js`와 페이지 코드 일치 여부 점검.

---

## 우선순위 3 — 영상·판정 정확도 (데이터 + 알고리즘)

준비해 둔 영상이 많을 때 **효과가 큰 순서**입니다.

1. **DB 메타데이터 정밀화** (`attack_timestamps`)  
   - `impact_time`, `dodge_window_ms`, `hitbox_radius`를 영상마다 튜닝.  
   - 클립별로 “맞는 타이밍”이 다르므로, 샘플링 도구(간단한 로컬 HTML/스크립트)로 타임스탬프를 찍어 저장하는 워크플로를 두면 좋음.

2. **난이도별 기본값**  
   - 쉬움/보통/어려움에 따라 `dodge_window_ms`·히트박스 크기를 다르게.

3. **포즈 추적 안정화**  
   - 조명·카메라 각도·배경 단순화 가이드를 UI에 짧게 표시.  
   - MediaPipe 설정(모델 복잡도, `minDetectionConfidence` 등)을 `PoseTracker.js`에서 조절.

4. **통계 기반 보정 (중장기)**  
   - 라운드 결과(`round_results`)를 모아 평균 반응시간·오판 패턴을 분석해 타임윈도우 자동 제안.

---

## 우선순위 4 — UI 다듬기

1. **디자인 토큰 일관성** (`css/global.css` 변수만 사용).  
2. **로딩·에러 토스트** — 네트워크 실패 시 사용자에게 원인 요약.  
3. **접근성** — 버튼 포커스, 대비, 키보드 조작(선택).

---

## 우선순위 5 — 상용 배포에 가깝게 (운영)

1. **Docker** — `backend/docker`의 `docker compose`로 API+DB 일원화.  
2. **Nginx** — 정적 파일 + `/api` 리버스 프록시 + HTTPS.  
3. **비밀 관리** — 프로덕션에서는 환경 변수·시크릿 매니저.  
4. **로깅·헬스체크** — 이미 `/api/health` 활용, 추후 구조화 로그.  
5. **비용 발생 항목** — 호스팅, 도메인, SSL, 외부 API 요금은 **직접 선택·결제** 필요.

---

## 참고 스크립트 (`scripts/`)

- `fix_frontend_paths.py` — 절대 경로 `/frontend/` 를 상대 경로로 맞출 때 참고용.  
- 기타 `fix_*.py` — 일회성 복구용 (필요 시에만 실행).

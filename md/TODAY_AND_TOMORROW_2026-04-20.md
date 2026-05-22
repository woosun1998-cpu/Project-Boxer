# BOXER V2 작업 정리

작성일: 2026-04-20

## 오늘 한 일

### 1. 로그인 / 회원가입 연결 점검
- `frontend/index.html`의 로그인, 회원가입 모달을 단일 문서로 정리했습니다.
- `frontend/js/core/api.js`를 8000 / 8001 포트 자동 탐색 방식으로 바꿔서, 실행 중인 백엔드 포트가 달라도 연결 시도되도록 정리했습니다.
- `backend/app/services/auth_service.py`에 회원가입 저장 시 `commit()`을 넣어서 DB 반영이 확정되도록 보완했습니다.
- 로그인 후 세션 확인 흐름도 다시 타도록 정리했습니다.

### 2. index.html 하단 이동 동작 수정
- `index.html` 하단 카드 중 스파링 이동은 `sparring.html`로 연결되도록 다시 점검했습니다.
- `sparring.hml` 같은 오타성 경로가 없도록 링크를 확인했습니다.
- 홈 화면의 카드 흐름을 `tutorial.html / sparring.html / shop.html`로 맞췄습니다.

### 3. index 화면 자산 정리
- `boxer/woosunshin` 브랜치에서 홈 화면 관련 자산을 가져와 반영했습니다.
- 적용한 주요 파일:
  - `frontend/index.html`
  - `frontend/css/index.css`
  - `frontend/js/core/api.js`
  - `frontend/image/*`
- 홈 화면이 단순 HTML만이 아니라 CSS와 이미지까지 함께 있어야 제대로 보인다는 점을 기준으로 정리했습니다.

### 4. 관리자 페이지 점검
- 관리자 페이지의 DB 사용자 관리, 튜토리얼, 스파링 영상, 시드 SQL 흐름을 계속 점검했습니다.
- 타임스탬프 저장이 `impact_time = 0`도 허용되도록 바뀐 상태를 유지했습니다.
- `timestamp_count`가 0이면 sparring에서 반응할 공격이 없다는 점을 다시 확인했습니다.
- 관리자 페이지에서 목록과 상세 편집이 더 연결되도록 정리된 상태를 유지했습니다.

### 5. sparring / tutorial / shop UI 작업 유지
- `sparring.html`의 시작 화면 로고, 문구, 배경 구조를 계속 정리했습니다.
- `tutorial.html`, `tutorial2.html`은 레벨 선택 허브와 학습 페이지 구조로 정리했습니다.
- `shop.html`은 Hero 배경과 카드 비주얼을 계속 조정했습니다.

### 6. 데이터 체크
- DB 서비스 기준으로 `timestamp_count`가 실제로 갱신되는 것을 확인했습니다.
- `SessionService.list_videos()`와 `SessionService.get_video()`에서 timestamps가 내려오는 흐름을 다시 확인했습니다.
- 관리자 저장 후 데이터가 반영되는 흐름을 검증했습니다.

## 오늘 확인된 핵심 문제

### 1. 로그인 / 회원가입 실패 원인
- 프런트가 바라보는 API 포트와 실제 실행 중인 백엔드 포트가 다를 수 있습니다.
- 백엔드 회원가입 저장이 `commit()` 없이 끝나는 경우 DB 반영이 안 될 수 있습니다.
- 그래서 포트 자동 탐색과 DB commit 확정을 같이 넣었습니다.

### 2. index.html 중복 문서 문제
- 파일 안에 HTML 문서가 여러 번 붙어 있어서, 화면과 스크립트가 꼬일 수 있었습니다.
- 이 부분을 단일 문서로 정리했습니다.

### 3. sparring 반영 문제
- `timestamp_count = 0`이면 sparring에 반영할 공격이 없습니다.
- 관리자에서 영상은 보여도 타임스탬프가 저장되지 않으면 게임에는 나타나지 않습니다.

## 내일 할 일

### 1. 로그인 / 회원가입 실사용 테스트
- 브라우저에서 회원가입을 실제로 한 번 더 테스트합니다.
- 로그인 후 토큰 저장과 `users/me` 조회가 바로 되는지 확인합니다.
- 백엔드가 8000 또는 8001 중 어느 포트로 떠 있는지 실제 실행 상태를 맞춰 봅니다.

### 2. index 화면 최종 점검
- `index.html` 첫 화면의 카드 이동이 모두 정상인지 확인합니다.
- 홈 버튼에서 `sparring.html` 이동이 정확한지 다시 검증합니다.
- 이미지 경로와 CSS 반영 상태를 한 번 더 확인합니다.

### 3. 관리자 페이지 타임스탬프 검증
- 스파링 영상 DB 관리에서 실제 타임스탬프가 저장되는지 확인합니다.
- `timestamp_count`가 0일 때와 1 이상일 때의 화면 표시를 구분합니다.
- 목록 새로고침 없이도 즉시 갱신되는지 다시 점검합니다.

### 4. 튜토리얼 / 스파링 연결 확인
- `tutorial.html -> tutorial2.html -> sparring.html` 흐름을 다시 확인합니다.
- 각 페이지의 네비게이션과 카드 링크가 끊기지 않는지 점검합니다.

### 5. DB 연결 보강 필요 여부 확인
- 아직 반영이 약한 부분이 있으면 `backend/app/services/auth_service.py`, `backend/app/routers/admin_videos.py`, `backend/app/services/session_service.py`를 다시 확인합니다.
- 필요하면 관리자용 데이터 갱신 API를 더 명확하게 분리합니다.

## 참고 파일

- `frontend/index.html`
- `frontend/css/index.css`
- `frontend/js/core/api.js`
- `backend/app/services/auth_service.py`
- `backend/app/services/session_service.py`
- `backend/app/routers/admin_videos.py`
- `md/BOXER_V2_RUNTIME_CHECKLIST.md`
- `md/BOXER_V2_RUNTIME_AUDIT_2026-04-20.md`

## 메모

- 홈 화면은 `index.html`만으로 끝나지 않고 CSS, JS, 이미지가 같이 맞아야 합니다.
- 로그인 / 회원가입은 프론트와 백엔드의 포트와 저장 커밋이 함께 맞아야 정상 동작합니다.
- sparring 반영 여부는 영상이 아니라 `timestamps` 데이터 존재 여부가 기준입니다.

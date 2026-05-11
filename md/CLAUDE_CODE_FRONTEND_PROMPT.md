# CLAUDE_CODE_FRONTEND_PROMPT.md

아래 내용을 Claude Code에 그대로 전달해서 프런트엔드 작업을 시작하면 됩니다.

---

당신은 이제 `Boxer` 프로젝트의 프런트엔드 작업을 맡습니다.

작업 전 반드시 아래 문서를 먼저 읽고 시작하세요.

1. `CLAUDE.md`
2. `FRONTEND.md`
3. `FRONTEND_HANDOFF.md`
4. 필요하면 `backend/API_EXAMPLES.md`

## 프로젝트 현재 상태

- 백엔드는 이미 구현되어 있음
- FastAPI 서버는 동작 중임
- Swagger 문서가 열림
- DB 연결 확인 완료
- `GET /api/health/db` 응답이 정상 확인됨
- 이제 프런트엔드를 실제로 연결하면 됨

백엔드 로컬 주소:

```text
http://localhost:8000
```

JWT 방식:

- 로그인 성공 후 받은 토큰을 저장
- 모든 보호 API는 `Authorization: Bearer <token>` 방식 사용
- localStorage 키는 `boxer_token` 사용 권장

## 프런트엔드 작업 목표

프런트엔드를 아래 순서대로 구현하세요.

1. 로그인 페이지
2. 회원가입 페이지
3. 공통 API helper
4. 현재 사용자 정보 복구 로직
5. 대시보드 페이지
6. 튜토리얼 목록 페이지
7. 튜토리얼 상세/완료 처리
8. 스파링 세션 시작 흐름

가능하면 여기까지 우선 완성하고, 이후 통계/상점/코칭으로 확장하세요.

## 반드시 지켜야 할 구현 방향

- 기존 문서의 구조와 톤을 유지하세요
- 프런트는 백엔드 API와 실제 연결되도록 구현하세요
- mock 데이터보다 실제 API 호출을 우선하세요
- fetch 호출은 공통 helper로 모으세요
- 인증 토큰 관리는 한 곳에서 처리하세요
- 로그인 안 된 상태에서 보호 페이지 접근 시 로그인 페이지로 보내세요
- 에러 메시지는 사용자 친화적으로 보여주세요
- 초보자도 흐름을 이해할 수 있게 파일 구조를 너무 복잡하게 만들지 마세요

## 최소 연결 대상 API

### 인증

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/users/me`

### 사용자

- `PUT /api/users/me`
- `GET /api/users/me/progress`

### 튜토리얼

- `GET /api/tutorials`
- `GET /api/tutorials/{tutorial_id}`
- `POST /api/tutorials/{tutorial_id}/complete`

### 세션

- `POST /api/sessions`

### 상태 확인

- `GET /api/health`
- `GET /api/health/db`

## 추천 구현 세부사항

### 1. 공통 API 파일

예:

- `js/core/api.js`

역할:

- base URL 관리
- JSON 요청/응답 처리
- `Authorization` 헤더 자동 첨부
- 401 처리
- 공통 에러 처리

### 2. 인증 관리 파일

예:

- `js/core/auth.js`

역할:

- token 저장/삭제
- 현재 로그인 상태 확인
- 현재 사용자 정보 불러오기
- 로그아웃 처리

### 3. 로그인 페이지

필수 기능:

- email/password 입력
- 로그인 성공 시 token 저장
- 대시보드로 이동

### 4. 회원가입 페이지

필수 기능:

- username/email/password 입력
- 성공 시 로그인 페이지 또는 자동 로그인

### 5. 대시보드 페이지

최소 표시 권장:

- 사용자 이름
- 사용자 tier
- 사용자 coins
- 진행도 일부
- 튜토리얼 화면 이동 버튼

데이터 출처:

- `/api/users/me`
- `/api/users/me/progress`

### 6. 튜토리얼 목록 페이지

표시 권장:

- 제목
- 난이도
- 프리미엄 여부
- 보상 정보

데이터 출처:

- `/api/tutorials`

### 7. 튜토리얼 완료 처리

완료 버튼 클릭 시:

- `/api/tutorials/{tutorial_id}/complete` 호출
- 정확도/시도 횟수 전달
- 결과 메시지 표시

## 테스트 순서

아래 순서대로 연결을 검증하세요.

1. `/api/health`
2. `/api/auth/login`
3. token 저장
4. `/api/users/me`
5. `/api/tutorials`
6. `/api/users/me/progress`

## 요청 예시는 이 파일 참고

`backend/API_EXAMPLES.md`

## 작업 스타일 요청

- 파일을 무작정 많이 만들지 말고 읽기 쉽게 구성하세요
- 실제로 브라우저에서 바로 확인 가능한 흐름을 우선 완성하세요
- 너무 추상적인 구조보다 동작하는 화면을 먼저 만드세요
- UI는 문서의 방향성을 따르되 너무 밋밋하지 않게 만드세요
- 작업이 끝나면 어떤 페이지를 만들었는지, 어떤 API가 연결됐는지, 무엇이 아직 남았는지 정리해 주세요

## 최종 목표

이번 프런트 작업의 1차 목표는 아래입니다.

- 로그인 가능
- 회원가입 가능
- 로그인 후 사용자 정보 표시 가능
- 튜토리얼 목록 표시 가능
- 튜토리얼 완료 요청 가능

이 목표를 우선 달성한 뒤 나머지 기능으로 확장하세요.

---

짧게 말하면:

`문서를 읽고, 실제 백엔드 API를 붙여서, 로그인 -> 사용자 정보 -> 튜토리얼 목록까지 동작하는 프런트엔드를 먼저 완성하세요.`


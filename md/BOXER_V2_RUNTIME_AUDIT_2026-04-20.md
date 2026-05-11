# BOXER V2 Runtime Audit

점검 기준: `BOXER_V2_RUNTIME_CHECKLIST.md`

기준일: 2026-04-20

## 결론

현재 구조는 `admin.html -> API -> DB -> sparring.html` 흐름이 연결되어 있습니다.
다만 실제 현장에서 가장 많이 헷갈릴 부분은 `스파링 영상의 timestamps 개수`입니다.

- `timestamp_count = 0`이면 sparring에서 반응할 공격 이벤트가 없습니다.
- `timestamp_count > 0`이어도, 상세 API에서 `timestamps[]`가 정상으로 내려와야 편집과 게임 반영이 모두 됩니다.
- 따라서 관리자 목록에서는 `timestamp_count`를 즉시 보여주고, 편집은 상세 조회(`/api/videos/{id}`)를 다시 읽는 방식이 가장 안전합니다.

## 체크리스트 점검 결과

### 1. 백엔드 기동 확인

- 상태: 통과
- 확인 내용:
  - `/api/health/db`가 DB 연결 상태를 반환하도록 구성되어 있습니다.
  - `DATABASE_URL`, `DB_HOST`, `DB_USER`, `DB_PASSWORD`가 `.env`에 명시되어 있습니다.
- 보완 필요:
  - 실제 실행 중인 백엔드 프로세스는 코드 수정 후 재시작이 필요합니다.

### 2. 관리자 페이지 기동 확인

- 상태: 통과
- 확인 내용:
  - `admin.html`에서 사용자, 튜토리얼, 스파링 영상, 랭킹, 시드 SQL 탭이 열립니다.
  - `Tutorial`/`Spark`/`Shop`/`Admin` 네비게이션 흐름이 통일되어 있습니다.
- 보완 필요:
  - 한글 깨짐은 브라우저 캐시보다 파일 인코딩 영향이 더 크므로, 수정 후 강력 새로고침이 필요합니다.

### 3. 스파링 영상 편집 및 timestamp 입력

- 상태: 통과
- 확인 내용:
  - `현재 시점 마킹(M)`은 영상 위치를 이동시키지 않고 timestamp만 추가합니다.
  - `collectTimestampsFromEditor()`가 비어 있는 행은 제외하고, `0.000` 마킹도 저장 가능하도록 수정되었습니다.
  - `loadMarkerVideoFromPath()`는 미리보기 성공/실패를 상태 메시지로 보여줍니다.
- 보완 필요:
  - `timestamp_count`가 0이면 sparring 게임에는 반영되지 않습니다. 이 경우 관리자에서 타임스탬프를 다시 저장해야 합니다.

### 4. 스파링 영상 DB 반영

- 상태: 통과
- 확인 내용:
  - `backend/app/routers/admin_videos.py`의 create/update/delete에 `commit()`이 들어가 있습니다.
  - `backend/app/services/session_service.py`는 영상 목록에 `timestamp_count`를 포함해 반환합니다.
  - `backend/app/routers/videos.py`는 상세 조회 시 `timestamps[]`를 내려줍니다.
- 보완 필요:
  - 영상 목록과 상세 조회가 다른 구조이므로, 편집 버튼은 상세 API를 다시 읽는 방식이 안전합니다. 이 흐름이 반영되어 있습니다.

### 5. sparring.html 반영

- 상태: 통과
- 확인 내용:
  - `GET /api/videos/{video_id}`의 `timestamps[]`가 `sparring.html`에 공급됩니다.
  - `debug` 패널에서 `timestamps`, `attack`, `move`, `window`, `shape`, `zone` 정보를 확인할 수 있습니다.
- 보완 필요:
  - 실제 video 데이터에 timestamps가 없으면 sparring은 정상적으로 열리더라도 공격 판정이 발생하지 않습니다.

### 6. 경로/데이터 정합성

- 상태: 주의 필요
- 확인 내용:
  - `file_path`는 `/assets/videos/...` 형태로 관리하는 것이 가장 안정적입니다.
  - 윈도우 로컬 경로(`C:\...`)를 그대로 넣으면 브라우저 미리보기에 실패할 수 있습니다.
- 보완 필요:
  - 관리자 화면은 경로가 실제 서버 URL로 변환되는지 확인해야 합니다.
  - `frontend/assets/videos/...` 경로를 쓰는 경우도 서버 라우팅에 맞는지 점검이 필요합니다.

## 현재 확인된 코드 개선 사항

1. `timestamp_count`가 목록에 표시됩니다.
2. `impact_time = 0`도 허용됩니다.
3. 편집 버튼은 상세 API를 다시 읽어 타임스탬프를 복원합니다.
4. 저장 후 DB 반영을 위해 backend 쪽 `commit()`이 추가되었습니다.

## 추가 보완 권장사항

### A. 관리자 화면 즉시 갱신

- `loadVideos()` 직후 `stat-videos`, `timestamp_count` 카드가 바로 갱신되는지 확인해야 합니다.
- 저장 직후 `loadVideos()`를 반드시 다시 호출해야 합니다.

### B. timestamp 0 문제 안내

- 목록에서 `timestamp_count = 0`이면 그 영상은 sparring에서 반응이 없습니다.
- 운영용 화면에서는 `0개`를 빨간 배지로 표시하는 것이 좋습니다.

### C. 상세 편집 안정성

- `openVideoEditor(videoId)`처럼 상세 API를 재조회하는 방식은 유지하는 것이 좋습니다.
- 목록 데이터만으로 편집하면 `timestamps[]`가 빠질 수 있습니다.

### D. 서버 재시작

- 다음 파일을 수정한 뒤에는 백엔드 재시작이 필요합니다.
  - `backend/app/routers/admin_videos.py`
  - `backend/app/services/session_service.py`
  - `backend/app/schemas/video.py`
  - `backend/app/schemas/admin_videos.py`

## 운영 체크 SQL

```sql
SELECT id, title, file_path, attack_type, difficulty
FROM attack_videos
ORDER BY id DESC;
```

```sql
SELECT video_id, COUNT(*) AS timestamp_count
FROM attack_timestamps
GROUP BY video_id
ORDER BY video_id DESC;
```

```sql
SELECT video_id, impact_time, dodge_window_ms, hitbox_radius, attack_type, judge_shape, target_zone, required_move, min_displacement
FROM attack_timestamps
ORDER BY video_id DESC, impact_time ASC;
```

## 최종 판단

- 관리자 DB 관리 흐름: 통과
- timestamp 저장/조회 흐름: 통과
- sparring 반영 흐름: 통과
- 경로 정합성: 주의 필요
- `timestamp_count = 0` 안내: 보완 권장


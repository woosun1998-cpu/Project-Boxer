# Boxer_v2 실제 동작 점검 체크리스트

이 문서는 `Boxer_v2` 기준으로 백엔드, 관리자 페이지, 스파링 게임이 실제로 이어지는지 순서대로 확인하기 위한 점검표입니다.

## 0. 점검 전 준비

- 작업 폴더가 `Boxer_v2`인지 확인한다.
- 브라우저 캐시를 한 번 비우거나 시크릿 창을 사용한다.
- 백엔드와 프런트엔드를 각각 따로 실행한다.

## 1. 백엔드 기동 확인

1. `backend`에서 서버를 실행한다.
2. `GET /api/health`가 정상 응답하는지 확인한다.
3. `GET /api/videos`가 목록을 반환하는지 확인한다.
4. `GET /api/videos/{video_id}`가 `timestamps`를 포함해 내려오는지 확인한다.
5. `GET /api/admin/videos` 관련 경로가 있으면 401/403이 예상대로 처리되는지 확인한다.

## 2. 관리자 페이지 점검

1. `http://localhost:5501/admin.html`을 연다.
2. 서버 상태 배너가 정상 상태로 바뀌는지 확인한다.
3. 스파링 영상 목록이 로드되는지 확인한다.
4. `영상 추가` 또는 `수정`을 눌러 입력 폼이 열린다.
5. `파일 경로`, `공격 타입`, `난이도`, `길이`가 정상 입력되는지 확인한다.
6. `Timestamp Marking Station`에서 영상 미리보기가 뜨는지 확인한다.
7. `영상 불러오기` 버튼으로 `vid-path`와 미리보기 영상이 같은 파일로 맞춰지는지 확인한다.
8. `현재 시점 마킹` 버튼과 `M` 키가 같은 동작을 하는지 확인한다.
9. `이전 프레임`, `다음 프레임`, `재생/정지`가 동작하는지 확인한다.
10. `초급/중급/상급/프로 프리셋`이 `dodge_window_ms`, `hitbox_radius`, `required_move`, `target_zone`에 반영되는지 확인한다.
11. `timestamps JSON 미리보기`가 실제 입력값과 일치하는지 확인한다.
12. `저장하기`를 눌렀을 때 `POST /api/admin/videos` 또는 `PUT /api/admin/videos/{id}`가 성공하는지 확인한다.

## 3. 관리자 저장 결과 확인

1. 저장 후 영상 목록에 방금 만든 항목이 보이는지 확인한다.
2. 목록의 타임스탬프 개수가 실제 입력 개수와 같은지 확인한다.
3. 다시 편집해서 기존 timestamps가 그대로 불러와지는지 확인한다.
4. `삭제`가 정상 동작하는지 확인한다.

## 4. 스파링 화면 점검

1. `http://localhost:5501/sparring.html`을 연다.
2. 시작 화면에서 난이도 선택과 클립 선택 UI가 보이는지 확인한다.
3. 선택한 난이도에 맞는 영상만 노출되는지 확인한다.
4. `1`, `2`, `3` 키로 영상 클립이 바뀌는지 확인한다.
5. `Fight` 또는 시작 동작 후 공격 영상이 재생되는지 확인한다.
6. `GET /api/videos/{video_id}`의 `timestamps`가 실제로 `BoxingVideoPlayer`에 전달되는지 확인한다.
7. `debug` 패널의 `timestamps`, `attack`, `move`, `window`, `shape`, `zone` 값이 영상과 맞는지 확인한다.
8. `pendingJudge` 상태가 뜨는지 확인한다.
9. 회피 성공 시 점수, 콤보, 회피율이 갱신되는지 확인한다.
10. 회피 실패 시 HP 감소와 결과 표기가 갱신되는지 확인한다.

## 5. 경로/데이터 점검

1. 관리자에 입력한 `file_path`가 실제 파일과 일치하는지 확인한다.
2. `attack_videos.file_path`가 `/assets/videos/...` 형식으로 저장되는지 확인한다.
3. 프런트에서 실제 재생 경로가 `/frontend/assets/videos/...`로 해석되는지 확인한다.
4. `attack_type`, `difficulty`, `required_move`, `judge_shape`, `target_zone` 값이 소문자 규칙으로 유지되는지 확인한다.
5. `impact_time > 0`인 timestamp만 저장되는지 확인한다.

## 6. 이상 징후 체크

- 영상이 안 뜨면 `normalizeMediaPath` 또는 `normalizeVideoSrc` 경로를 먼저 본다.
- `timestamps`가 0개면 관리자 저장이 실패했는지 확인한다.
- `pendingJudge`가 안 뜨면 영상 상세 응답의 timestamps를 먼저 확인한다.
- 점수는 오르는데 판정이 이상하면 `HitboxJudge.js`와 `pendingJudge` 메타값을 본다.
- 관리자에서 저장했는데 스파링에서 다른 영상이 나오면 `file_path`와 `difficulty` 매핑을 먼저 본다.

## 7. 권장 실행 순서

1. 백엔드 기동
2. 관리자 영상 1개 저장
3. 관리자에서 저장된 timestamps 재열기
4. 스파링 화면에서 해당 영상 선택
5. 공격 타이밍과 판정 확인
6. 결과값과 DB 저장 확인

## 8. 확인용 쿼리

```sql
SELECT id, title, file_path, attack_type, difficulty
FROM attack_videos
ORDER BY id DESC;
```

```sql
SELECT video_id, impact_time, dodge_window_ms, hitbox_radius, attack_type, judge_shape, target_zone, required_move, min_displacement
FROM attack_timestamps
ORDER BY video_id DESC, impact_time ASC;
```

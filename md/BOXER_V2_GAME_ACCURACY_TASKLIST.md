# Boxer_v2 게임 정확성 작업리스트

이 문서는 `Boxer_v2`의 스파링 판정 정확도를 높이기 위한 작업 우선순위 목록입니다.

## 목표

- 관리자에서 입력한 `timestamps`가 경기 로직에 그대로 반영되게 한다.
- `attack_type`, `judge_shape`, `required_move`, `target_zone`, `min_displacement`가 실제 판정에 영향을 주게 한다.
- 난이도별 판정 강도와 허용 오차를 일관되게 유지한다.
- 점수, 콤보, HP, 판정 라벨이 서로 모순되지 않게 한다.

## P0. 바로 해야 할 핵심 작업

1. `admin.html`의 timestamp 편집 결과가 `POST /api/admin/videos`와 `PUT /api/admin/videos/{id}`로 정확히 전송되는지 고정한다.
2. `GET /api/videos/{video_id}` 응답의 `timestamps`가 `sparring.html`의 `videoPlayer`로 정확히 들어가는지 확인한다.
3. `normalizeMediaPath`와 `normalizeVideoSrc` 경로 규칙을 하나로 정리한다.
4. `HitboxJudge.js`의 판정 기준과 `sparring.html`의 `pendingJudge` 메타 구조를 맞춘다.
5. `judge_shape`, `required_move`, `min_displacement`가 실제 점수 계산에 반영되는지 확인한다.

## P1. 정확도 개선 작업

1. 난이도별 기본값을 하나의 소스에서 관리한다.
2. `beginner / intermediate / advanced / pro` 프리셋이 관리자와 게임에서 동일한 값을 쓰도록 맞춘다.
3. `jab / straight / hook / uppercut / mixed`별 기본 `target_zone`과 `required_move`를 명확히 분리한다.
4. `accuracy_score`와 `judge_label` 산식을 점검한다.
5. `reaction_ms`가 실제 경과 시간과 너무 어긋나지 않는지 확인한다.
6. `dodge_window_ms`와 `hitbox_radius`의 단위와 범위를 문서화한다.

## P2. 데이터 구조 정리

1. `attack_videos`와 `attack_timestamps` 스키마를 최종 확정한다.
2. `attack_timestamps`에 들어가는 필드를 다음 기준으로 정리한다.
   - `impact_time`
   - `dodge_window_ms`
   - `hitbox_radius`
   - `attack_type`
   - `judge_shape`
   - `target_zone`
   - `required_move`
   - `min_displacement`
3. 세션 결과 테이블에 다음 결과값을 유지한다.
   - `attack_type`
   - `dodge_direction`
   - `accuracy_score`
   - `judge_label`
   - `earned_score_per_attack`
   - `reaction_ms`
   - `outcome`

## P3. 관리자 도구 개선

1. timestamp 편집기에서 누락값이 생기면 자동 보정한다.
2. `Add`, `Delete`, `Reset`, `Load video` 동작을 모두 이벤트 기반으로 고정한다.
3. 유효성 검사를 저장 직전에 한 번 더 실행한다.
4. 프리셋 버튼이 실제 수치값을 덮어쓰는지 확인한다.
5. JSON 미리보기가 실제 저장 payload와 항상 일치하게 유지한다.

## P4. 게임 판정 개선

1. `pendingJudge`에 가능한 한 많은 상황 정보를 넣는다.
2. `HitboxJudge`가 단순 노즈 좌표만 보지 않게 유지한다.
3. `referenceLandmarks` 기반 비교가 실제로 작동하는지 확인한다.
4. `pose`가 없는 경우의 fallback을 점검한다.
5. `DODGE`와 `HIT`가 결과적으로 UI, 점수, 세션 저장에 일관되게 반영되는지 확인한다.

## P5. 테스트 항목

1. 관리자에서 영상 1개 저장
2. 저장된 영상의 상세 조회
3. timestamps 개수 확인
4. `beginner + jab` 실제 판정
5. `intermediate + straight` 실제 판정
6. `advanced + hook` 실제 판정
7. `pro + mixed` 실제 판정
8. `required_move`를 바꿨을 때 판정이 바뀌는지 확인
9. `hitbox_radius`를 바꿨을 때 판정 난이도가 바뀌는지 확인
10. `dodge_window_ms`를 바꿨을 때 반응 판정이 바뀌는지 확인

## P6. 문서화할 내용

1. 경로 규칙
2. 영상 파일명 규칙
3. 난이도별 프리셋 값
4. 공격 타입별 기본 판정 값
5. 관리자 입력과 게임 판정의 매핑표

## 추천 순서

1. 경로 정리
2. timestamps 저장/불러오기 검증
3. 판정 메타 정리
4. 난이도 프리셋 통일
5. 점수/HP/콤보 정합성 확인
6. 회귀 테스트 문서화


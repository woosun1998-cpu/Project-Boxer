# 관리자 영상 타임스탬프 수정 항목

## 목적

복싱 게임에서 영상을 재생하면서 공격이 들어오는 시점을 기준으로 진행을 맞추기 위해, 관리자 모드에서 영상별 `timestamps`를 직접 기록하고 수정할 수 있게 만든다.

핵심 기준은 `impact_time`이다.

- `impact_time`: 실제 공격이 닿는 순간
- `dodge_window_ms`: 그 시점을 기준으로 판정 가능한 시간 범위
- `hitbox_radius`: 판정 반경
- `required_move`: 플레이어가 해야 할 회피 동작
- `target_zone`: 공격이 들어오는 부위

## 현재 상태 정리

현재 프로젝트에는 영상 등록과 타임스탬프 저장 흐름이 이미 일부 존재한다.

- `POST /api/admin/videos` 로 영상 생성 가능
- `PUT /api/admin/videos/{video_id}` 로 기존 영상 수정 가능
- `DELETE /api/admin/videos/{video_id}` 로 영상 삭제 가능
- 영상 상세에는 `timestamps` 배열을 함께 내려줄 수 있음
- 관리자 UI에는 타임스탬프 입력 폼이 이미 일부 존재함

하지만 게임 진행 기준으로 쓰기에는 다음을 더 명확히 정리해야 한다.

1. 영상을 보면서 `impact_time`을 쉽게 찍을 수 있어야 한다.
2. 각 timestamp가 어떤 공격인지 즉시 확인할 수 있어야 한다.
3. 난이도와 공격 타입에 따라 기본값이 자동으로 들어가야 한다.
4. 저장 전에 JSON 형태를 미리 확인할 수 있어야 한다.
5. 게임 화면에서는 `timestamps`를 그대로 읽어서 진행과 판정을 연결해야 한다.

## 수정 목표

관리자가 영상 한 편을 재생하면서 다음 작업을 할 수 있게 만든다.

- 공격이 닿는 순간을 `impact_time`으로 마킹
- timestamp 목록을 테이블로 확인
- 각 timestamp의 세부값 수정
- 난이도별 기본 판정값 자동 입력
- 공격 타입별 기본 회피 동작 자동 입력
- 저장 요청에 `timestamps[]`가 함께 포함되도록 연결

## 반드시 반영할 수정 항목

### 1. 관리자 영상 미리보기 추가

- 영상 파일을 바로 재생할 수 있어야 한다.
- 현재 재생 시간을 `currentTime` 형태로 표시해야 한다.
- 재생, 일시정지, 속도 조절 기능이 필요하다.
- 프레임 단위로 앞으로/뒤로 이동할 수 있어야 한다.

### 2. `impact_time` 마킹 기능 추가

- 현재 재생 시점을 버튼 또는 단축키로 기록한다.
- 단축키는 `M` 키를 사용한다.
- 기록 시점은 소수 셋째 자리 정도까지 저장한다.
- 한 영상에 여러 개의 타임스탬프를 추가할 수 있어야 한다.

### 3. timestamp 편집 테이블

각 행에서 아래 항목을 바로 수정할 수 있어야 한다.

- `impact_time`
- `dodge_window_ms`
- `hitbox_radius`
- `required_move`
- `target_zone`

추가로 필요하면 아래 항목도 노출한다.

- `attack_type`
- `judge_shape`
- `min_displacement`

### 4. 난이도/공격 타입 기본값 자동 입력

새 timestamp를 추가할 때 아래 규칙으로 기본값을 넣는다.

- 난이도에 따라 `dodge_window_ms`, `hitbox_radius`를 자동 설정
- 공격 타입에 따라 `required_move`, `target_zone`를 자동 설정

권장 기본값 예시:

- `beginner`: `dodge_window_ms=650`, `hitbox_radius=0.22`
- `intermediate`: `dodge_window_ms=520`, `hitbox_radius=0.16`
- `advanced`: `dodge_window_ms=430`, `hitbox_radius=0.12`
- `pro`: `dodge_window_ms=340`, `hitbox_radius=0.09`

공격 타입 기본값 예시:

- `jab` -> `required_move=slip_side`, `target_zone=head`
- `straight` -> `required_move=lean_back`, `target_zone=head`
- `hook` -> `required_move=duck`, `target_zone=left_head` 또는 `right_head`
- `uppercut` -> `required_move=step_out`, `target_zone=body`
- `mixed` -> `required_move=auto`, `target_zone=head`

### 5. JSON 미리보기

- `timestamps[]`가 포함된 최종 payload를 JSON으로 보여준다.
- 저장 전에 어떤 값이 들어가는지 바로 확인할 수 있어야 한다.
- 비어 있는 값이나 잘못된 값은 미리 경고해야 한다.

### 6. 저장 연동

- 기존 영상 등록 API에 `timestamps` 배열을 포함한다.
- 수정 저장도 동일한 payload 구조를 사용한다.
- 저장 버튼 하나로 영상 정보와 타임스탬프를 함께 저장한다.

## 게임 진행 측면에서 필요한 연결

게임에서 영상 진행을 정확하게 맞추려면, 관리자 모드에서 저장된 `timestamps`를 다음 방식으로 사용해야 한다.

1. 영상 재생 중 `impact_time`에 도달하면 판정을 시작한다.
2. `dodge_window_ms` 안에서 플레이어 행동을 확인한다.
3. `hitbox_radius`와 포즈/회피 입력을 비교한다.
4. `required_move`에 따라 정답 동작을 다르게 판단한다.
5. `target_zone`에 따라 회피 방향이나 부위를 분기한다.

즉, 영상은 단순 재생 자료가 아니라 게임 진행을 구동하는 타임라인이 되어야 한다.

## 백엔드 확인 사항

현재 백엔드에는 아래 구조가 있어야 한다.

- `attack_videos`
- `attack_timestamps`
- 영상 생성 시 `timestamps` 저장
- 영상 수정 시 기존 `timestamps` 삭제 후 재저장

검토할 파일:

- `backend/app/schemas/admin_videos.py`
- `backend/app/models/video.py`
- `backend/app/routers/admin_videos.py`
- `backend/app/routers/videos.py`

## 프론트엔드 확인 사항

수정 대상 파일:

- `frontend/admin.html`
- `frontend/sparring.html`
- `frontend/js/engine/VideoPlayer.js`

특히 확인할 부분:

- 관리자 영상 편집 화면에서 `timestamps` 입력이 가능한가
- 게임 화면이 API에서 받은 `timestamps`를 그대로 읽는가
- `impact_time` 도달 시 판정 이벤트가 정상적으로 발생하는가

## 검증 기준

아래 조건이 만족되면 수정 완료로 본다.

- 관리자가 영상 재생 중 현재 시간을 보고 timestamp를 추가할 수 있다.
- 각 timestamp의 값이 테이블에서 수정된다.
- 저장된 `timestamps[]`가 API 응답에 포함된다.
- 게임 화면에서 `impact_time` 기준으로 판정이 시작된다.
- 난이도와 공격 타입에 따라 기본값이 자동 입력된다.

## 우선순위

1. 관리자 영상 미리보기 및 마킹 기능
2. timestamp 테이블 편집
3. 난이도/공격 타입 기본값 자동화
4. JSON 미리보기
5. 저장 API 연동
6. 게임 화면에서 timestamps 기반 판정 연결

## 최종 요청 문장

`frontend/admin.html`에 영상 타임스탬프 마킹 기능을 추가하고, 영상의 `impact_time`을 기준으로 게임 진행이 가능하도록 `timestamps[]`를 저장/수정/미리보기할 수 있게 해주세요.


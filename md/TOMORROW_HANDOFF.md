# Tomorrow Handoff

## 2026-04-17 sparring 레벨별 영상/팝업/관리자 작업 메모

`frontend/sparring.html`의 스파링 시작 화면은 레벨 선택 후 안내 팝업을 띄우는 구조로 맞춘다.

이번에 사용할 자산 규칙:

- 영상 폴더: `frontend/assets/videos/sparring/`
- 선수 이미지 폴더: `frontend/assets/images/player/`
- 선수 이미지 파일명: `beginner`, `intermediate`, `advanced`, `pro` 기준

레벨별 영상 파일 규칙:

- 초급: `sparring_beginner_jab_01.mp4`, `sparring_beginner_jab_02.mp4`, `sparring_beginner_jab_03.mp4`
- 중급: `sparring_intermediate_straight_01.mp4`, `sparring_intermediate_straight_02.mp4`, `sparring_intermediate_straight_03.mp4`
- 상급: `sparring_advanced_hook_01.mp4`, `sparring_advanced_hook_02.mp4`, `sparring_advanced_hook_03.mp4`
- 프로: `sparring_pro_mixed_01.mp4`, `sparring_pro_mixed_02.mp4`, `sparring_pro_mixed_03.mp4`

관리자 모드 보완 사항:

- `frontend/admin.html`에 영상 수정 버튼과 수정 저장 흐름을 추가했다.
- `POST /api/admin/videos`와 함께 `PUT /api/admin/videos/{video_id}`로 기존 영상을 덮어쓸 수 있게 맞췄다.
- 영상 경로 기본값은 `frontend/assets/videos/sparring/` 기준으로 안내한다.
- `초급 / 중급 / 상급 / 프로` 프리셋 버튼으로 난이도, 공격 타입, 파일명 기본값을 빠르게 채울 수 있게 했다.

팝업 문구 방향:

- 초급은 `jab` 중심으로 거리와 리듬을 익히는 입문형
- 중급은 `straight` 중심으로 직선 반응과 정확도를 올리는 단계
- 상급은 `hook` 중심으로 각도와 타이밍을 파고드는 단계
- 프로는 `mixed` 중심으로 콤보 대응과 복합 반응을 묶는 단계

## 2026-04-17 최신 우선순위 정리

이 섹션이 현재 기준 최신 작업 메모다. 아래쪽 기존 메모는 일부 한글 인코딩이 깨져 보일 수 있으므로, 내일 작업은 우선 이 섹션을 기준으로 보면 된다.

## 1. sparring.html 시작 화면 로고 수정 완료

`frontend/sparring.html` 시작 화면의 `SOUL in MOTION` 워드마크를 참고 이미지의 `novah`처럼 더 낮고 둥근 미니멀 타이포 느낌으로 변경했다.

변경 방향:

- 기존 강한 복싱 게임 타이틀 느낌을 줄이고, 얇고 둥근 워드마크 스타일로 정리
- `soul in motion TM`처럼 소문자 기반으로 보여주되, 의미는 기존 `SOUL in MOTION` 유지
- 붉은 포인트보다 차분한 아이스 블루/화이트 계열로 정리
- JS 렌더링은 `renderHeroTitle()`에서 처리
- CSS 핵심 클래스는 `.start-title`, `.wordmark-main`, `.wordmark-in`, `.wordmark-motion`, `.wordmark-tm`

확인할 파일:

- `frontend/sparring.html`

## 2. 레벨별 매칭 점검 결과와 보강 사항

현재 스파링 레벨은 아래처럼 연결된다.

- 초급: `difficulty=beginner`, `attack_type=jab`
- 중급: `difficulty=intermediate`, `attack_type=straight`
- 상급: `difficulty=advanced`, `attack_type=hook`
- 프로급: `difficulty=pro`, `attack_type=mixed`

이번에 `sparring.html`의 영상 필터를 보강했다.

- 기존: 주로 `attack_type` 중심 필터
- 변경: `difficulty`와 `attack_type`을 함께 비교
- API 호출: `/api/videos?difficulty=beginner` 같은 형태
- 매칭 영상이 없으면 `Demo mode (no matching level video)`로 fallback

즉, 실제 영상이 아직 제작되지 않아도 레벨 버튼을 누르면 앱이 멈추지 않고 데모 모드로 자연스럽게 넘어가야 한다.

## 3. 아직 제작해야 하는 실제 영상 목록

스파링 영상은 단순 배경 영상이 아니라, 판정 타임스탬프와 연결되는 공격 영상이어야 한다. 최소 아래 세트가 필요하다.

### 초급 영상

- 목적: 사용자가 타이밍과 큰 회피 움직임을 익히는 단계
- 필요 영상: 잽 중심 영상 2~3개
- 권장 파일명: `sparring_beginner_jab_01.mp4`, `sparring_beginner_jab_02.mp4`
- 공격 타입: `jab`
- 난이도: `beginner`
- 길이: 5~8초
- 구성: 한 영상에 잽 1~2회
- 판정 예시: `impact_time=2.0`, `dodge_window_ms=650`, `hitbox_radius=0.22`
- 권장 회피: `slip_left`, `slip_right`, 또는 `auto`

### 중급 영상

- 목적: 직선 압박과 반응 속도 훈련
- 필요 영상: 스트레이트/크로스 중심 영상 2~3개
- 권장 파일명: `sparring_intermediate_straight_01.mp4`, `sparring_intermediate_straight_02.mp4`
- 공격 타입: `straight`
- 난이도: `intermediate`
- 길이: 6~10초
- 구성: 스트레이트 2~3회 또는 잽 후 스트레이트
- 판정 예시: `impact_time=1.8`, `dodge_window_ms=520`, `hitbox_radius=0.16`
- 권장 회피: `slip_side`, `slip_left`, `slip_right`

### 상급 영상

- 목적: 짧은 회피와 훅 대응 훈련
- 필요 영상: 훅 중심 영상 2~3개
- 권장 파일명: `sparring_advanced_hook_01.mp4`, `sparring_advanced_hook_02.mp4`
- 공격 타입: `hook`
- 난이도: `advanced`
- 길이: 8~12초
- 구성: 좌우 훅, 훅 후 재공격
- 판정 예시: `impact_time=2.2`, `dodge_window_ms=430`, `hitbox_radius=0.12`
- 권장 회피: `duck`, `slip_side`

### 프로급 영상

- 목적: 실전 압박, 페인트, 복합 패턴 대응
- 필요 영상: 혼합 콤보 영상 3개 이상
- 권장 파일명: `sparring_pro_mixed_01.mp4`, `sparring_pro_combo_01.mp4`
- 공격 타입: `mixed`
- 난이도: `pro`
- 길이: 10~15초
- 구성: 페인트, 잽, 훅, 어퍼컷, 콤보
- 판정 예시: `impact_time=1.4`, `dodge_window_ms=340`, `hitbox_radius=0.09`
- 권장 회피: `auto`, `duck`, `slip_side`, `lean_back`

## 4. 관리자 모드에서 영상 추가/삭제/수정 가능 여부

현재 관리자 화면은 `frontend/admin.html`의 `스파링 영상` 탭에서 관리한다.

가능한 것:

- 영상 목록 조회: `GET /api/videos`
- 영상 추가: `POST /api/admin/videos`
- 영상 삭제: `DELETE /api/admin/videos/{video_id}`
- 타임스탬프 추가: 영상 추가 시 `timestamps` 배열로 함께 저장
- 난이도 지정: `beginner / intermediate / advanced / pro`
- 공격 타입 지정: `jab / straight / hook / uppercut / mixed`
- 판정값 지정: `impact_time`, `dodge_window_ms`, `hitbox_radius`, `required_move`, `target_zone` 등

주의할 점:

- 현재 백엔드에는 영상 수정용 `PUT /api/admin/videos/{id}` 엔드포인트가 없다.
- 그래서 "수정"은 현재 기준으로는 삭제 후 다시 추가하는 방식이 가장 안전하다.
- 실제 운영에서 수정 기능이 필요하면 `admin_videos.py`에 PUT 엔드포인트를 추가해야 한다.

## 5. 관리자 모드로 게임을 수월하게 운영하는 방법

관리자 모드는 영상과 판정 데이터를 직접 맞추는 도구로 쓰면 된다.

운영 순서:

1. 실제 mp4 파일을 `frontend/assets/videos/`에 넣는다.
2. `frontend/admin.html`로 이동한다.
3. `스파링 영상` 탭을 연다.
4. `영상 추가`를 누른다.
5. 제목, 파일 경로, 공격 타입, 난이도, 길이를 입력한다.
6. 공격이 실제로 닿는 순간을 보고 `impact_time`을 초 단위로 입력한다.
7. 레벨에 맞게 `dodge_window_ms`와 `hitbox_radius`를 프리셋으로 적용한다.
8. 저장 후 `sparring.html`에서 해당 레벨을 선택해 영상이 뜨는지 확인한다.
9. 판정이 너무 쉽거나 어렵다면 기존 데이터를 삭제하고 보정값을 바꿔 다시 등록한다.

추천 파일 경로 입력 예:

- `/assets/videos/sparring_beginner_jab_01.mp4`
- `/assets/videos/sparring_intermediate_straight_01.mp4`
- `/assets/videos/sparring_advanced_hook_01.mp4`
- `/assets/videos/sparring_pro_mixed_01.mp4`

## 6. 내일 바로 확인할 체크리스트

1. `sparring.html`에서 `soul in motion TM` 워드마크가 참고 이미지처럼 부드럽고 얇게 보이는지 확인
2. 초급 선택 시 `beginner + jab` 영상만 목록에 뜨는지 확인
3. 중급 선택 시 `intermediate + straight` 영상만 목록에 뜨는지 확인
4. 상급 선택 시 `advanced + hook` 영상만 목록에 뜨는지 확인
5. 프로급 선택 시 `pro + mixed` 영상만 목록에 뜨는지 확인
6. 실제 매칭 영상이 없을 때 데모 모드 안내가 자연스럽게 뜨는지 확인
7. 관리자 모드에서 영상 추가 후 스파링 화면에 즉시 반영되는지 확인
8. 삭제한 영상이 스파링 선택 목록에서 사라지는지 확인


## 오늘 한 일

- `frontend/sparring.html` 시작 화면을 단순화하고, 레벨 선택을 `초급 / 중급 / 상급 / 프로급` 중심으로 정리했다.
- `sparring-lobby-bg.mp4`를 시작 배경으로 사용하도록 연결했고, `logo.png`를 로고 이미지로 반영했다.
- 시작 화면 카피를 `SOUL IN MOTION` 기반으로 정리하고, 한글 문구는 3줄 흐름으로 보이도록 다듬었다.
- 스파링 점수/판정 흐름은 유지하면서, 화면에 보이는 선택지는 줄이고 내부 로직은 그대로 재사용하도록 정리했다.
- `frontend/tutorial2.html`을 추가해 6개 스테이지형 튜토리얼 2페이지를 만들었다.
- `frontend/admin.html`의 한글 문구와 주석을 정리하고, 관리자 화면과 백엔드 연결도 이어 붙였다.
- 백엔드 저장 구조는 `accuracy_score`, `judge_label`, `earned_score_per_attack`, `dodge_direction`, `outcome`까지 저장되도록 확장했다.

## 현재 상태

- 스파링은 4단계 레벨만 눈에 띄게 보여주는 구조로 바뀌었다.
- Assist, Training, Round Length 같은 값은 내부 기본값으로 처리하는 방향이다.
- 점수 계산은 `GameEngine.js`가 계속 담당하고, HUD 하단에는 `반응속도 / 회피 방향 / 획득 점수 / 회피율 / 판정 결과`가 표시된다.
- 튜토리얼은 `tutorial.html`에서 `tutorial2.html`로 진입할 수 있다.
- 영상 파일은 `frontend/assets/videos/`를 기준으로 관리한다.

## 내일 우선순위

1. `sparring.html` 시작 화면 최종 점검
   - `SOUL IN MOTION`의 크기와 간격을 실제 화면에서 다시 확인
   - 왼쪽 타이틀과 오른쪽 레벨 버튼 균형 확인
   - 배경 비디오 밝기와 오버레이 톤 조정

2. 레벨별 매칭 점검
   - 초급 / 중급 / 상급 / 프로급이 실제 영상 필터와 잘 연결되는지 확인
   - 데모 모드 fallback이 자연스럽게 동작하는지 확인

3. HUD와 결과 패널 점검
   - 반응속도, 회피 방향, 이번 공격 획득 점수, 회피율, 판정 결과가 잘 갱신되는지 확인
   - 라운드 종료 후 결과 패널이 바로 보이는지 확인

4. 튜토리얼 2 페이지 점검
   - `tutorial2.html`의 영상/웹캠 배치 확인
   - 6개 스테이지 전환과 체크리스트가 자연스럽게 보이는지 확인

5. 관리자 화면 점검
   - 한글 라벨이 깨지지 않는지 확인
   - 신규 timestamp 필드가 저장 API와 일치하는지 확인

## 바로 실행할 명령

```powershell
cd "c:\Users\User\Desktop\PROJECT\2차 작업파일 (PROJECT)\운동앱\boxer"
py -m http.server 5500
```

```powershell
cd "c:\Users\User\Desktop\PROJECT\2차 작업파일 (PROJECT)\운동앱\boxer\backend"
py -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## 확인할 페이지

- `http://localhost:5500/frontend/index.html`
- `http://localhost:5500/frontend/sparring.html`
- `http://localhost:5500/frontend/tutorial.html`
- `http://localhost:5500/frontend/tutorial2.html`
- `http://localhost:5500/frontend/admin.html`

## 중요한 파일

- [frontend/sparring.html](../frontend/sparring.html)
- [frontend/tutorial2.html](../frontend/tutorial2.html)
- [frontend/admin.html](../frontend/admin.html)
- [backend/app/services/session_service.py](../backend/app/services/session_service.py)
- [backend/app/schemas/video.py](../backend/app/schemas/video.py)
- [backend/app/models/session.py](../backend/app/models/session.py)
- [backend/app/models/video.py](../backend/app/models/video.py)

## 메모

- `frontend/assets/videos/sparring-lobby-bg.mp4`가 시작 화면 배경이다.
- `frontend/assets/images/logo.png`가 현재 로고 이미지다.
- 스파링은 "사용자는 레벨만 고른다"는 방향으로 단순화되어 있다.
- 다음 작업은 UI 마감과 실제 실행 확인을 중심으로 진행하면 된다.

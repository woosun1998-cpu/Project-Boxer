# Sparring Match Planning Prompt

아래 내용은 `frontend/sparring.html`의 현재 기능을 기준으로, 경기 제작과 기능 점검을 위해 바로 사용할 수 있게 정리한 프롬프트다.

## 1. 페이지 목적
- AI 복싱 스파링 메인 게임 화면
- 사용자는 경기 시작 전에 난이도, 공격 유형, 라운드 길이, 경기 모드, Assist 여부를 고른다
- 경기 중에는 AI 공격 영상을 보면서 웹캠 자세를 감지해 회피 판정을 받는다
- 경기 결과는 세션과 라운드 단위로 서버에 저장된다

## 2. 경기 시작 전 설정 항목
- 비디오 선택
  - `Choose a sparring video...` 드롭다운
  - `/api/videos`에서 불러온 비디오 목록을 사용
  - `attack_type` 기준으로 필터링 가능
  - 매칭되는 비디오가 없으면 Demo mode로 전환
- 난이도 선택
  - `Beginner`
  - `Intermediate`
  - `Advanced`
  - `Pro`
- 공격 유형 필터
  - `All attacks`
  - `Jab`
  - `Straight`
  - `Hook`
  - `Uppercut`
  - `Mixed`
- 라운드 길이
  - `60 sec`
  - `90 sec`
  - `120 sec`
- 경기 모드
  - `Training`
  - `Ranked`
- Assist 토글
  - 켜짐이면 히트박스와 코치 힌트 표시
  - 꺼짐이면 보조 표시 최소화

## 3. 난이도별 기능 값
- Beginner
  - HP 감소: 5
  - 히트박스 반경: 0.22
  - 기본 점수: 90
  - 콤보 보너스: 0.08
  - 회피 창: Wide
  - 스타일: 큰 슬립 동작으로 타이밍 연습
- Intermediate
  - HP 감소: 10
  - 히트박스 반경: 0.16
  - 기본 점수: 110
  - 콤보 보너스: 0.12
  - 회피 창: Normal
  - 스타일: 균형형 반응과 콤보 흐름
- Advanced
  - HP 감소: 16
  - 히트박스 반경: 0.12
  - 기본 점수: 135
  - 콤보 보너스: 0.16
  - 회피 창: Tight
  - 스타일: 더 빠르고 더 정확한 반응
- Pro
  - HP 감소: 24
  - 히트박스 반경: 0.09
  - 기본 점수: 160
  - 콤보 보너스: 0.2
  - 회피 창: Very tight
  - 스타일: 실전급 빠른 템포

## 4. 경기 화면 구성
- 상단 HUD
  - HP 바
  - 점수
  - 콤보 표시
  - 일시정지 버튼
  - 종료 버튼
- 메인 좌측
  - AI 공격 영상
  - 현재 공격 타입 배지
  - 히트박스 오버레이
- 메인 우측
  - 플레이어 웹캠 영상
  - 자세 추적 캔버스
  - 카메라 상태 텍스트
  - Assist 힌트
- 하단 상태 바
  - `DODGE NOW!` 경고
  - 반응속도 ms
  - 회피/전체 공격 수
  - 회피율
- KO 화면
  - 최종 점수
  - 최고 콤보
  - 최종 정확도
  - 총 회피 수
  - 총 피격 수
  - 재시작 버튼
  - 대시보드 이동
  - 샵 이동

## 5. 경기 진행 흐름
- 사용자가 설정을 고르고 `FIGHT!`를 누른다
- 세션이 생성된다
- 선택한 비디오가 있으면 해당 공격 영상을 재생한다
- 비디오가 없거나 매칭 실패 시 Demo mode로 전환한다
- Demo mode에서는 3초마다 기본 공격이 발생한다
- MediaPipe Pose로 플레이어 자세를 추적한다
- 공격 타임스탬프가 오면 회피 판정을 시작한다
- 제한 시간 안에 코 위치와 상체 이동을 기준으로 DODGE/HIT를 판단한다
- 판정 결과에 따라 점수, HP, 콤보, 정확도, 라벨이 갱신된다
- HP가 0이 되면 KO 화면으로 종료된다

## 6. 판정 로직 상세
- 기본 판정
  - 코가 히트박스 밖이면 DODGE
  - 안이면 HIT
- 공격별 권장 회피 방식
  - Jab: slip_side
  - Straight: slip_side
  - Hook: slip_side
  - Uppercut: duck
- 공격 프로필에 따라 추가 체크
  - `judge_shape`
  - `required_move`
  - `min_displacement`
  - `hitbox_radius`
  - `dodge_window_ms`
- Assist가 켜져 있으면 히트박스가 웹캠 위에 표시된다

## 7. 점수와 상태 변화
- DODGE 성공
  - 콤보 +1
  - 최고 콤보 갱신
  - 점수 획득
  - 빠른 반응일수록 추가 보너스
  - 정확도 점수와 판정 라벨 반영
- HIT 발생
  - HP 감소
  - 콤보 0으로 초기화
  - 피격 이펙트와 화면 흔들림
- HP가 0이면 KO 처리

## 8. 저장되는 데이터
- 세션 생성
  - `/api/sessions`
- 라운드 저장
  - `/api/sessions/rounds`
  - 저장 항목
    - `session_id`
    - `video_id`
    - `result`
    - `reaction_ms`
    - `score_earned`
    - `earned_score_per_attack`
    - `combo_at_time`
    - `attack_type`
    - `dodge_direction`
    - `accuracy_score`
    - `judge_label`
    - `outcome`
    - `nose_x`
    - `nose_y`
- 세션 종료 저장
  - `/api/sessions/{sessionId}/end`
  - 저장 항목
    - `total_score`
    - `max_combo`
    - `total_rounds`
    - `exp_earned`
- 리더보드 갱신
  - `/api/leaderboard/me`
  - 저장 항목
    - `total_score`
    - `max_combo`
    - `total_dodges`
    - `win_rate`

## 9. 영상 제작용 경기 선택 기준
- 넣기 좋은 경기
  - 공격 패턴이 명확한 경기
  - `jab`, `straight`, `hook`, `uppercut`가 각각 잘 드러나는 경기
  - 회피 방향이 화면에서 잘 보이는 경기
  - 3초 전개, 경고, 회피, 판정이 한 세트로 읽히는 경기
- 빼기 좋은 경기
  - 공격 모션이 너무 비슷해서 구분이 안 되는 경기
  - 자세 추적이 흔들려 판정이 자주 불안정한 경기
  - 비디오 길이가 너무 짧아 라운드 흐름이 안 잡히는 경기
  - 같은 패턴이 지나치게 반복되는 경기

## 10. 영상 제작을 위한 추천 구성
- 1세트: `Jab` 위주
- 1세트: `Hook` 위주
- 1세트: `Straight` 위주
- 1세트: `Uppercut` 위주
- 1세트: `Mixed` 조합
- 난이도별 샘플
  - Beginner 1개
  - Intermediate 1개
  - Advanced 1개
  - Pro 1개
- 경기 길이별 샘플
  - 60초
  - 90초
  - 120초

## 11. 바로 써먹는 프롬프트
아래 문장을 그대로 써서 경기 기획이나 영상 제작에 활용할 수 있다.

```text
현재 sparring.html의 경기 구조를 기준으로, 다음 조건을 만족하는 스파링 경기를 설계해줘.

1. 경기 시작 전 설정 항목을 명확히 분리해줘.
   - 비디오 선택
   - 난이도
   - 공격 유형 필터
   - 라운드 길이
   - 경기 모드
   - Assist 토글

2. 경기 중 화면에서 보여야 할 항목을 목록화해줘.
   - HP 바
   - 점수
   - 콤보
   - 공격 영상
   - 웹캠 자세 추적
   - 히트박스
   - 반응속도
   - 회피/피격 카운트
   - 회피율

3. 공격 유형별로 어떤 경기를 넣고 뺄지 판단할 수 있게 정리해줘.
   - Jab
   - Straight
   - Hook
   - Uppercut
   - Mixed

4. 난이도별로 기능 수치를 비교해줘.
   - HP 감소
   - 히트박스 반경
   - 기본 점수
   - 콤보 보너스
   - 회피 창

5. 판정 결과가 어떤 데이터로 저장되는지 적어줘.
   - result
   - reaction_ms
   - score_earned
   - combo_at_time
   - attack_type
   - dodge_direction
   - accuracy_score
   - judge_label
   - outcome

6. 영상 제작 관점에서
   - 넣기 좋은 경기
   - 빼기 좋은 경기
   - 샘플 구성안
   을 분리해서 적어줘.
```


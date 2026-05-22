# 작업 목표

현재 권투 회피 게임 앱의 스파링 판정 시스템, 점수 시스템, 난이도 구조, 관리자 설정 구조를 전면 개선하라.

기존 시스템은 nose 좌표 1점만으로 중앙 원형 히트박스 기준 회피 여부를 판단하고 있어 정확성이 부족하다.  
이번 작업의 목표는 다음과 같다.

1. 난이도를 easy / medium / hard 3단계에서  
   초급 / 중급 / 상급 / 프로 4단계 구조로 확장한다.

2. 회피 판정을 nose 1점 기반에서  
   머리 / 어깨 / 몸통을 포함한 다점 랜드마크 기반 판정으로 개편한다.

3. 공격 타입별 판정 모델을 도입한다.  
   jab / hook / straight / uppercut / mixed 공격에 대해  
   판정 방식과 필요한 회피 동작이 달라져야 한다.

4. 단순 HIT / DODGE 결과 외에  
   accuracy_score(0~100)와 judge_label(Perfect / Clean / Late / Unsafe / Miss)을 계산하고 저장한다.

5. 관리자(admin) 화면에서 공격별 판정 속성을 입력할 수 있게 하고  
   난이도 프리셋, 추천값, 향후 확장 가능한 구조를 만든다.

6. 백엔드 모델과 프론트엔드 로직을 함께 수정하여  
   실제 세션 결과에 attack_type, dodge_direction, accuracy_score, judge_label이 저장되도록 한다.

중요:
- 기존 프로젝트 구조를 먼저 분석한 뒤 수정하라.
- 기존 파일/함수/모델을 최대한 재사용하되, 무리한 중복 코드는 만들지 마라.
- 변경 전후 영향 범위를 설명하고, 필요한 경우 마이그레이션 포인트를 주석 또는 TODO로 남겨라.
- 프론트엔드와 백엔드가 서로 필드명이 어긋나지 않게 맞춰라.
- 기존 기능이 깨지지 않도록 하위호환을 가능한 범위에서 유지하라.

---

# 현재 알고 있는 기존 로직

## 1. 현재 점수 시스템
공격 타이밍이 오면 impact_time 기준으로 판정이 시작된다.

현재 판정은:
- nose 좌표가 중앙 원형 히트박스 밖으로 나가면 DODGE
- 안에 있으면 HIT

DODGE 성공 시:
- combo +1
- 기본점수 100
- 콤보 보너스 = 1 + combo * 0.1
- 반응속도 보너스:
  - 200ms 미만: 1.5배
  - 300ms 미만: 1.2배
  - 그 외: 1.0배

기존 점수 개념:
earned = 100 * (1 + combo * 0.1) * speedBonus

HIT 되면:
- HP 감소
- combo 0 리셋

기존 난이도:
- easy: HP 5 감소, 히트박스 반경 0.20
- medium: HP 10 감소, 반경 0.15
- hard: HP 20 감소, 반경 0.10

## 2. 현재 한계
- nose 하나만 봐서 정확성이 떨어진다.
- 몸통은 움직였는데 코가 중앙에 남으면 억울한 HIT가 발생할 수 있다.
- 고개만 살짝 빼도 DODGE가 되는 경우가 있다.
- jab, hook, uppercut의 판정 구조가 거의 동일하다.
- score_earned가 라운드 누적 점수 중심이라 공격별 세부 분석이 어렵다.

---

# 목표 기능 상세

## A. 난이도 4단계 확장
기존 easy / medium / hard를 다음 구조로 바꿔라.

- beginner(초급)
- intermediate(중급)
- advanced(상급)
- pro(프로)

각 난이도는 최소한 다음 속성을 가진다.
- label
- hp_damage
- default_hitbox_radius
- dodge_window_scale 또는 기본 dodge_window 성향
- score_multiplier 또는 난이도 반영 요소
- assist 허용 여부 또는 추천 상태

초기 추천값은 다음 방향으로 설계하라.

### 초급
- 목표: 타이밍 익히기
- HP 감소 낮음
- 회피 창 넓음
- 히트박스 큼
- 단일 공격 위주

### 중급
- 목표: 좌우 슬립 익히기
- 방향 구분 시작
- 2타 콤보 일부 허용
- 중간 속도

### 상급
- 목표: 덕킹 + 연속 회피
- 회피 창 짧음
- 연속 콤보 허용
- 공격 타입 다양화

### 프로
- 목표: 예측 억제, 실전 반응
- 작은 히트박스
- 빠른 연속 타격
- 랜덤 템포 / 페이크 포함 가능

기존 easy / medium / hard 데이터를 사용 중인 곳이 있으면
하위호환 매핑도 제공하라.
예:
- easy -> beginner
- medium -> intermediate
- hard -> advanced
프로는 신규 추가

---

## B. 다점 랜드마크 기반 판정으로 개편
회피 판정 함수를 다음 방향으로 바꿔라.

기존:
- judge(nose)

변경:
- judge(landmarks, attackProfile, timingContext)

랜드마크에서 최소한 다음 점들을 활용하라.
- nose (0)
- left_shoulder (11)
- right_shoulder (12)
- 필요 시 left_ear / right_ear 또는 눈 근처 보조점
- 가능하면 shoulder_center, head_center 같은 파생 포인트도 계산하라

판정은 단순 원형 벗어남 하나가 아니라
공격 타입과 required_move에 따라 달라지게 하라.

예시:
- jab / straight:
  - 코와 어깨 중심이 타격선에서 충분히 벗어나야 함
- hook:
  - 좌우 슬립 이동량이 충분해야 함
- uppercut:
  - duck 또는 lean_back 계열 판정 필요
  - 머리 높이 변화, 어깨 대비 머리 위치, 수직 이동량을 참고
- mixed:
  - attackProfile에 정의된 required_move를 우선 적용

가능하면 판정에 사용할 내부 보조 함수도 분리하라.
예:
- getHeadCenter()
- getShoulderCenter()
- getHorizontalDisplacement()
- getVerticalDisplacement()
- detectGuardState()
- evaluateTimingScore()
- evaluateMovementScore()

---

## C. 공격 타입별 판정 프로필 도입
AttackTimestamp 또는 프론트엔드에서 사용하는 공격 메타데이터에
다음 필드를 추가할 수 있도록 구조를 설계하라.

- attack_type
- judge_shape: circle | ellipse | lane
- target_zone: head | left_head | right_head | body
- required_move: slip_left | slip_right | duck | lean_back | step_out | auto
- min_displacement
- dodge_window_ms
- hitbox_radius

설계 원칙:
- attack_type만 보고 판정하지 말고
  required_move와 judge_shape를 함께 보게 하라.
- 향후 관리자 화면에서 직접 조정 가능해야 한다.
- 값이 없는 기존 데이터도 안전하게 동작하도록 기본값(default fallback)을 제공하라.

공격별 기본 예시:
- jab: lane, head, slip_left 또는 slip_right, 작은 수평 회피 요구
- straight: lane, head, lean_back 또는 step_out 가능
- hook: ellipse 또는 side zone, slip 방향 중요
- uppercut: body/head 하단 접근, duck 중요
- mixed: 개별 timestamp 설정값 따름

---

## D. 정확도 점수 시스템 추가
단순 DODGE / HIT 말고 accuracy_score를 0~100으로 계산하라.

초기 계산 항목 예시:
- 타이밍 정확도 40점
- 이동 방향 정확도 30점
- 이동 거리 충분성 20점
- 가드 유지 10점

총점에 따라 judge_label을 부여하라.

예시 기준:
- 90 이상: Perfect
- 75 이상: Clean
- 55 이상: Late
- 35 이상: Unsafe
- 그 미만: Miss

주의:
- DODGE 성공이더라도 정확도가 낮으면 Perfect가 아닌 Clean/Late/Unsafe가 될 수 있다.
- HIT가 발생하면 기본적으로 Miss 또는 Unsafe 처리하되,
  내부 로직상 세부 점수는 남길 수 있게 하라.
- 개별 공격당 earned_score와 accuracy_score를 모두 기록할 수 있게 하라.

---

## E. 점수 시스템 개선
기존 점수 공식을 유지하되 정확도 점수를 일부 반영할 수 있게 확장하라.

권장 방식:
- baseScore = 100
- comboMultiplier = 1 + combo * 0.1
- speedBonus:
  - <200ms = 1.5
  - <300ms = 1.2
  - else = 1.0
- accuracyMultiplier 예시:
  - Perfect = 1.3
  - Clean = 1.15
  - Late = 1.0
  - Unsafe = 0.7
  - Miss = 0 또는 매우 낮음

최종 예시:
earned = baseScore * comboMultiplier * speedBonus * accuracyMultiplier

단, 아래를 만족시켜라.
- 기존 플레이 감각이 너무 망가지지 않도록 점수 폭주를 방지한다.
- HIT 시 HP 감소와 combo 초기화는 유지한다.
- 공격별 획득 점수와 라운드 총점 모두 추적 가능하게 만든다.

---

# 수정 대상 파일 가이드

아래 파일들을 우선 점검하고 필요한 수정을 수행하라.

## 프론트엔드
- frontend/js/engine/HitboxJudge.js
- frontend/sparring.html
- 관련 점수/판정/세션 저장 로직 파일
- 필요 시 difficulty config 또는 constants 파일

## 백엔드
- backend/app/models/session.py
- backend/app/models/video.py
- 관련 schema / serializer / CRUD / API 라우트
- 세션 저장 및 결과 응답 구조

## 관리자
- frontend/admin.html
- 관련 관리자 JS
- 영상 등록 및 타임스탬프 폼 처리 로직

---

# 모델 변경 요구사항

## 1. session 결과 모델 확장
RoundResult 또는 동등한 세션 결과 모델에 다음 필드를 추가하라.

- attack_type
- dodge_direction
- accuracy_score
- judge_label
- earned_score_per_attack 또는 동등 개념
- reaction_ms (가능하면)
- was_dodge_success 또는 outcome

주의:
- 기존 저장 구조를 최대한 유지하면서 확장하라.
- 필요한 경우 nullable/default 처리하라.

## 2. video / attack timestamp 모델 확장
AttackTimestamp 또는 유사 모델에 다음 필드를 추가하라.

- judge_shape
- target_zone
- required_move
- min_displacement
- attack_type
- dodge_window_ms
- hitbox_radius

값이 없을 때의 기본값도 정의하라.

---

# 관리자 화면 개선 요구사항

frontend/admin.html 및 관련 JS에서
관리자가 영상 및 타임스탬프를 더 정밀하게 설정할 수 있게 개선하라.

필수 입력/선택 항목:
- title
- difficulty
- duration_sec
- file_path
- attack_type
- impact_time
- dodge_window_ms
- hitbox_radius
- judge_shape
- target_zone
- required_move
- min_displacement

추가 UX 요구:
- 난이도 프리셋 버튼
  - 초급 프리셋 적용
  - 중급 프리셋 적용
  - 상급 프리셋 적용
  - 프로 프리셋 적용
- 값 자동 추천
- 기존 값 수정 가능
- 필드 설명 또는 placeholder 제공
- 잘못된 값 검증

가능하면 TODO 또는 구조만이라도 남길 기능:
- 타임스탬프 미리보기
- 영상 재생하며 impact_time 찍기
- 판정 테스트 모드
- 영상별 실패율 통계

---

# Match Setup UI 개선 요구사항

frontend/sparring.html의 Match Setup 영역을 개선하라.

기존:
- 영상 선택
- 난이도 선택

개선:
- Level: 초급 / 중급 / 상급 / 프로
- Attack Type: Jab / Hook / Straight / Mixed
- Round Length: 60 / 90 / 120초
- Mode: Training / Ranked
- Assist: 히트박스 가이드 On / Off

요구사항:
- 기본값은 초급 + Training + Assist On
- 기존 UI를 크게 깨지 않게 점진적으로 개선
- 선택값이 실제 게임 로직과 연결되게 구현
- Mode에 따라 점수 저장/표시 정책을 나눌 수 있게 확장 가능한 구조로 작성

---

# 추천 영상 시드 데이터
다음 추천 영상을 seed 데이터 또는 초기 더미 데이터 구조로 반영할 수 있게 하라.

## 초급
- jab_basic_01.mp4: 정면 jab 3회
- straight_basic_01.mp4: 느린 straight 3회
- jab_pause_jab_01.mp4: 쉬는 템포가 분명한 jab

## 중급
- jab_hook_01.mp4: 왼쪽 jab 후 오른쪽 hook
- double_jab_01.mp4: 속도 차이 나는 2연 jab
- straight_hook_01.mp4: 직선 후 측면 공격

## 상급
- hook_duck_hook_01.mp4: 좌훅-우훅 패턴
- uppercut_hook_01.mp4: 아래에서 위로 올라오는 공격 포함
- mixed_combo_3hit_01.mp4: 3타 연속 패턴

## 프로
- feint_jab_hook_01.mp4: 페이크 후 실공격
- pro_combo_5hit_01.mp4: 5타 랜덤 템포
- sparring_reactive_01.mp4: 준비동작이 짧은 실전형 패턴

seed 데이터는 최소한 다음 정보를 포함할 수 있도록 설계하라.
- title
- difficulty
- attack_type
- duration_sec
- file_path
- timestamps[]
  - impact_time
  - dodge_window_ms
  - hitbox_radius
  - judge_shape
  - target_zone
  - required_move
  - min_displacement

---

# 구현 방식 지시

다음 순서대로 작업하라.

## 1단계. 프로젝트 구조 분석
- 현재 난이도 설정이 어디에 정의되어 있는지 찾기
- 판정 로직이 실제 어디서 호출되는지 추적
- 세션 결과 저장 구조 확인
- 관리자 등록 폼 구조 확인
- UI select가 실제 어떤 데이터와 연결되는지 확인

먼저 수정 대상 파일 목록과 영향 범위를 정리하라.

## 2단계. 설계안 반영
- 새로운 difficulty config 설계
- attackProfile 기본 구조 설계
- judge 함수 시그니처 변경
- accuracy_score 계산 함수 설계
- 백엔드 모델 필드 확장 설계
- 하위호환 fallback 설계

## 3단계. 프론트엔드 구현
- HitboxJudge.js 리팩터링
- sparring.html 및 연결 JS 수정
- Match Setup UI 확장
- 판정 결과 HUD 또는 디버그용 표시가 가능하면 추가

## 4단계. 백엔드 구현
- session.py 수정
- video.py 수정
- 필요한 schema / CRUD / route 반영
- 프론트와 API 필드명 일치 확인

## 5단계. 관리자 기능 구현
- admin.html 입력 필드 확장
- 난이도 프리셋
- attack timestamp 추가 필드 저장
- 기본 validation 추가

## 6단계. seed 데이터 작성
- 단계별 추천 영상 세트 추가
- attack timestamp 샘플 포함

## 7단계. 검증
- 기존 easy/medium/hard 데이터 fallback 확인
- jab/hook/uppercut별 판정 동작 확인
- HIT/DODGE/accuracy_score/judge_label 저장 확인
- UI에서 선택한 난이도가 실제 판정에 반영되는지 확인
- 관리자에서 입력한 값이 실제 게임에 반영되는지 확인

---

# 출력 형식 지시

작업 결과를 아래 형식으로 정리하라.

1. 현재 구조 분석 결과
2. 수정이 필요한 파일 목록
3. 각 파일별 변경 내용 요약
4. 실제 코드 수정안
5. 하위호환 처리 방식
6. 테스트 체크리스트
7. 남은 TODO

중요:
- 가능한 한 실제 수정 코드 중심으로 작성하라.
- 함수명, 필드명, 이벤트 흐름이 연결되도록 작성하라.
- 단순 설명만 하지 말고 실제 적용 가능한 코드 패치를 제시하라.
- 프로젝트에 이미 존재하는 코드 스타일을 최대한 따르라.
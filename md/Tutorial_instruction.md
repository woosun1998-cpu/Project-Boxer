중요:
기존 코드를 덮어쓰지 말고, 삭제하지 말고, 추가 방식으로 구현하라.

특히 아래 요소는 절대 제거 금지:
- video/webcam element
- pose overlay canvas
- 기존 HUD/score/status DOM
- 기존 이벤트 리스너
- 기존 한글 UI 문자열 구조

작업 전 반드시 현재 파일 구조를 먼저 분석하고,
"재사용 가능한 코드"와 "새로 추가해야 할 코드"를 구분해서 설명한 뒤 구현하라.

# 작업 목표

첨부된 디자인 이미지를 참고하여, AI 복싱 트레이닝 서비스의 튜토리얼 페이지 6종을 구현하라.

중요:
이 작업은 기존 프로젝트를 갈아엎는 것이 아니라,
기존 웹캠 인터랙션, 스켈레톤 오버레이, 상태 패널, 게임형 UI 요소를 최대한 유지하면서
튜토리얼 학습 페이지를 새롭게 정리/구성하는 작업이다.

절대 금지:
- 기존 웹캠 기능 삭제
- 기존 오버레이 캔버스 삭제
- 기존 HUD/패널 구조 제거
- 전체 HTML 파일을 새로 갈아엎는 방식
- 한글 인코딩 깨짐 유발

반드시 지켜라:
- 기존 코드 분석 후 필요한 부분만 확장
- 공통 레이아웃을 컴포넌트/템플릿/재사용 가능한 구조로 구현
- 6개 페이지는 데이터 기반으로 렌더링
- UTF-8 인코딩 유지
- 반응형 대응
- 기존 AI 판정 로직과 연결 가능한 구조 유지

---

# 참고 디자인 방향

첨부 이미지 스타일처럼 다음 구조를 갖는 튜토리얼 페이지를 구현하라.

## 공통 레이아웃
- 상단 Header
  - 좌측: 서비스 로고/타이틀 (예: AI 복싱 트레이닝 센터)
  - 중앙: 현재 레벨명 + 단계 제목
  - 상단 진행률 바
  - 우측: 사용자 프로필 아이콘 영역

- 본문 2분할 레이아웃
  - Left: 실시간 웹캠 피드 + 스켈레톤 오버레이 + 가이드 히트존/발 위치 가이드
  - Right: STATUS & FEEDBACK 패널 + 정석 자세 참고 패널

- Right 영역 상세
  - 상단: 큰 핵심 지시 문구
  - 중단 좌측: AI 판정 리포트 카드
  - 중단 우측: 정석 자세 이미지 또는 루프 영상 영역
  - 하단: 핵심 수칙 체크리스트 + 단계 이동 버튼

- 하단 CTA
  - 전체 단계 보기
  - 이전 단계
  - 다음 단계 / 연습 시작 버튼

---

# 구현 방식

6개 페이지를 각각 따로 복붙해서 만들지 말고,
공통 템플릿 1개 + 레벨 데이터 6개로 구성하라.

권장 구조 예시:
- tutorial.html 또는 tutorial.js 공통 페이지
- tutorialData.js 또는 JSON 데이터 파일
- query param 또는 route 기반 렌더링
  - /tutorial/beginner-1
  - /tutorial/beginner-2
  - /tutorial/intermediate-1
  - /tutorial/intermediate-2
  - /tutorial/advanced-1
  - /tutorial/advanced-2

또는 기존 프로젝트 구조에 맞는 방식으로 구현하되,
반드시 "공통 템플릿 + 데이터 기반 렌더링" 원칙을 지켜라.

---

# 디자인/UX 요구사항

## 전체 톤앤매너
- 미래지향적 AI 스포츠 트레이닝 대시보드 느낌
- 딥 네이비/다크 블루/오렌지 포인트 컬러
- 둥근 카드 UI
- 명확한 타이포그래피
- 정보 위계가 잘 보이도록 구성
- 한글 가독성 최우선

## 시각 요소
- 웹캠 위에 MediaPipe 스켈레톤 렌더링
- 발 위치 가이드 링/타겟 존 표시
- 핵심 관절 포인트 강조
- 정확도 80% 이상이면 녹색 계열, 미만이면 오렌지/레드 계열
- AI 리포트는 카드형 지표 UI
- 정석 자세 패널은 일러스트/참고 이미지/루프 영상 삽입 가능 구조
- 체크리스트는 아이콘과 함께 시각적으로 정돈

## 반응형
- 데스크톱 우선
- 태블릿까지 무너지지 않게 대응
- 모바일은 최소 레이아웃 붕괴 없이 스택형으로 전환 가능하게 구조화

---

# 기능 요구사항

## 1. 웹캠 및 스켈레톤
- 기존 웹캠 스트림 로직이 있으면 재사용
- video element와 overlay canvas를 유지
- MediaPipe 또는 TensorFlow.js Pose Detection과 연결 가능한 구조 유지
- 17개 관절 좌표를 다룰 수 있도록 설계
- 튜토리얼 페이지에서도 실시간 자세 판정이 가능하게 유지

## 2. AI 판정 카드
우측 STATUS & FEEDBACK 영역에는 페이지별로 아래 카드들을 표시할 수 있게 하라.
예시:
- 정확도
- 속도
- 각도
- 발 간격
- 가드 높이
- 체중 이동
- 회전력
- 회피 성공률
- 콤보 연결 속도

모든 카드가 모든 페이지에 다 나올 필요는 없고,
페이지 데이터에 따라 필요한 지표만 렌더링되게 하라.

## 3. 3초 유지 후 시작
- 사용자가 정석 자세를 3초 이상 유지하면
  "연습 시작" 카운트다운이 시작되도록 구조를 마련하라.
- 아직 실제 로직이 없으면 TODO와 hook 포인트를 남겨라.

## 4. 우측 정석 자세 패널
- 정석 자세 이미지/참고 영상/고스트 모드가 들어갈 수 있게 설계
- 사용자 영상 위 반투명 고스트 오버레이를 향후 추가 가능하게 hook를 남겨라

## 5. 데이터 동기화
- 우측 참고 영상의 timestamp와 사용자 포즈 데이터를 실시간 비교할 수 있도록
  구조적으로 연결 가능하게 설계
- 실제 비교 엔진이 아직 없으면 함수 stub/TODO를 남겨라

---

# 반드시 유지해야 할 개발 안전 규칙

반드시 지켜라:
- 기존 파일을 통째로 재작성하지 말고 최소 수정
- 기존 DOM id/class를 가능하면 유지
- 기존 JS 이벤트 리스너 제거 금지
- 기존 video/canvas/hud가 있으면 재사용
- 새 기능은 추가 방식으로 구현
- innerHTML로 전체 레이아웃 덮어쓰기 금지
- document.body 전체 교체 금지
- 한글 문자열은 UTF-8 기준으로 안전하게 작성

작업 순서:
1. 현재 프로젝트의 튜토리얼/스파링/웹캠 관련 구조 분석
2. 재사용 가능한 부분 식별
3. 공통 템플릿 설계
4. tutorial data 구조 설계
5. 6개 페이지 렌더링 구현
6. 기존 웹캠 및 AI 판정 연결점 유지
7. 스타일 정리
8. 테스트 체크리스트 작성

출력 시 반드시 포함:
1. 현재 구조 분석 결과
2. 수정 대상 파일 목록
3. 새로 추가한 파일 목록
4. 각 파일별 변경 이유
5. 실제 코드
6. TODO 및 연결 포인트
7. 테스트 체크리스트

---

# 6개 튜토리얼 페이지 데이터

아래 내용을 공통 데이터 구조로 정리해서 렌더링하라.

---

## LEVEL 1 - 초급 - 기본기 구축 (The Foundation)

### Page beginner-1
- level: 1
- stageGroup: 초급
- title: 기본 스탠스
- subtitle: Boxing Stance
- routeKey: beginner-1
- progress: 16

- heroInstruction:
  양발을 어깨너비로 벌리고, 뒷발 뒤꿈치를 살짝 들어 '스프링' 상태를 유지하세요.

- shortDescription:
  복싱의 80%를 결정하는 기초이며, 부상 방지를 위한 필수 단계입니다.

- aiLogicSummary:
  발 간격(픽셀 거리)과 가드 높이(y좌표)를 체크합니다.

- metrics:
  - label: 정확도
    type: percent
    valueKey: accuracy
  - label: 발 간격
    type: px
    valueKey: footDistance
    targetRange: 480-550
  - label: 가드 높이
    type: y
    valueKey: guardY

- checklist:
  - 오른손잡이(Orthodox) 기준 왼발 앞 배치
  - 앞발 정면, 뒷발 45도 각도 유지
  - 턱을 당기고 양손 가드를 눈높이/턱 옆에 유지

- coachingTips:
  - 무릎을 너무 펴지 말고 탄성을 유지
  - 상체를 과하게 세우지 말고 살짝 이완
  - 시선은 정면 유지

- referencePanel:
  title: 정석 자세
  mediaType: image_or_video
  description:
    45도 스탠스, 턱 당김, 팔꿈치 밀착, 앞발 정면, 뒷발 45도

- cta:
  primary: 잽(Jab) 연습하기
  secondary: 이전 단계
  tertiary: 초급 전체 보기

---

### Page beginner-2
- level: 1
- stageGroup: 초급
- title: 잽
- subtitle: Jab
- routeKey: beginner-2
- progress: 32

- heroInstruction:
  앞손을 가볍게 던지듯 뻗고 즉시 가드로 복귀하세요.

- shortDescription:
  가장 빠르고 간결한 주먹으로 거리 조절의 핵심입니다.

- aiLogicSummary:
  타격 후 손이 원래의 가드 위치 히트박스로 돌아오는 딜레이를 측정합니다.

- metrics:
  - label: 정확도
    type: percent
    valueKey: accuracy
  - label: 복귀 속도
    type: ms
    valueKey: returnDelay
  - label: 가드 유지
    type: score
    valueKey: guardRecovery

- checklist:
  - 타격 시 손등이 위를 향하도록 주먹을 살짝 비틀기
  - 앞손이 나갈 때 뒷손은 턱을 보호
  - 짧은 호흡 '습'과 함께 빠르게 복귀

- coachingTips:
  - 어깨가 과하게 들리지 않게 하기
  - 팔만 뻗지 말고 어깨와 중심축을 함께 사용
  - 잽 후 멈추지 말고 바로 가드

- referencePanel:
  title: 정석 잽
  mediaType: image_or_video
  description:
    앞손 직선 궤적, 빠른 복귀, 반대손 가드 유지

- cta:
  primary: 스트레이트 배우기
  secondary: 이전 단계
  tertiary: 초급 전체 보기

---

## LEVEL 2 - 중급 - 리듬과 파워 (The Rhythm)

### Page intermediate-1
- level: 2
- stageGroup: 중급
- title: 스트레이트
- subtitle: Straight / Cross
- routeKey: intermediate-1
- progress: 50

- heroInstruction:
  뒷발을 회전시키며 온몸의 체중을 실어 강력하게 뻗으세요.

- shortDescription:
  체중 이동과 회전력을 활용해 강한 파워를 만드는 단계입니다.

- aiLogicSummary:
  어깨 회전 각도와 골반 피벗을 감지하여 파워 수치를 산출합니다.

- metrics:
  - label: 파워
    type: percent
    valueKey: power
  - label: 회전 각도
    type: degree
    valueKey: shoulderRotation
  - label: 체중 이동
    type: score
    valueKey: weightTransfer

- checklist:
  - 뒷발 피벗 시 뒤꿈치 방향 체크
  - 체중이 뒷발에서 앞발로 자연스럽게 이동
  - 앞손 가드가 안면을 보호하는지 확인

- coachingTips:
  - 팔 힘만 쓰지 말고 바닥을 밀어내는 느낌
  - 골반과 어깨가 함께 회전
  - 스트레이트 후 중심 회복

- referencePanel:
  title: 정석 스트레이트
  mediaType: image_or_video
  description:
    뒷발 피벗, 어깨 회전, 체중 전달, 반대손 가드

- cta:
  primary: 훅(Hook) 배우기
  secondary: 이전 단계
  tertiary: 중급 전체 보기

---

### Page intermediate-2
- level: 2
- stageGroup: 중급
- title: 훅
- subtitle: Hook
- routeKey: intermediate-2
- progress: 66

- heroInstruction:
  팔을 'ㄱ'자로 꺾어 측면을 타격하며, 짧고 강한 회전이 중요합니다.

- shortDescription:
  짧고 강한 회전력으로 측면을 타격하는 기술입니다.

- aiLogicSummary:
  팔꿈치와 어깨의 수평 정렬과 몸통 회전을 모니터링합니다.

- metrics:
  - label: 정확도
    type: percent
    valueKey: accuracy
  - label: 팔 각도
    type: degree
    valueKey: elbowAngle
  - label: 회전력
    type: score
    valueKey: torsoRotation

- checklist:
  - 앞발 뒤꿈치를 살짝 들고 안쪽 회전
  - 팔모양 90도 유지
  - 몸통 회전을 이용해 짧고 강하게 타격

- coachingTips:
  - 팔만 휘두르지 말고 코어 회전 사용
  - 훅 궤적을 너무 크게 만들지 않기
  - 타격 후 즉시 가드 복귀

- referencePanel:
  title: 정석 훅
  mediaType: image_or_video
  description:
    90도 팔 각도, 짧은 회전, 코어 사용, 가드 복귀

- cta:
  primary: 더킹 & 위빙 배우기
  secondary: 이전 단계
  tertiary: 중급 전체 보기

---

## LEVEL 3 - 상급 - 회피와 카운터 (The Evasion)

### Page advanced-1
- level: 3
- stageGroup: 상급
- title: 더킹 & 위빙
- subtitle: Ducking & Weaving
- routeKey: advanced-1
- progress: 83

- heroInstruction:
  무릎을 굽혀 아래로 피하거나, 머리를 U자 형태로 굴려 피하세요.

- shortDescription:
  상대의 공격을 무력화하고 카운터 기회를 만드는 회피 기술입니다.

- aiLogicSummary:
  코 좌표가 Punch Zone을 벗어나는지, 무릎 굴곡과 좌우 이동 궤적을 판정합니다.

- metrics:
  - label: 회피 성공률
    type: percent
    valueKey: dodgeRate
  - label: 무릎 굴곡
    type: degree
    valueKey: kneeFlexion
  - label: 궤적 안정성
    type: score
    valueKey: weaveSmoothness

- checklist:
  - 허리가 아니라 무릎을 굽혀 회피
  - U자 이동 시 좌우 체중 이동 유지
  - 회피 중에도 시선은 정면 유지

- coachingTips:
  - 상체만 숙이지 말고 하체를 사용
  - 너무 깊게 내려가지 않기
  - 회피 후 바로 카운터 연결 가능 자세 유지

- referencePanel:
  title: 정석 회피
  mediaType: image_or_video
  description:
    무릎 굴곡, U자 회피, 시선 유지, 카운터 연결 자세

- cta:
  primary: 콤보 & 카운터 배우기
  secondary: 이전 단계
  tertiary: 상급 전체 보기

---

### Page advanced-2
- level: 3
- stageGroup: 상급
- title: 콤보 & 카운터
- subtitle: Combo Training
- routeKey: advanced-2
- progress: 100

- heroInstruction:
  잽-잽-스트레이트-위빙처럼 연속 동작을 수행하며 리듬을 유지하세요.

- shortDescription:
  연속 공격과 방어를 유기적으로 연결하는 종합 단계입니다.

- aiLogicSummary:
  각 동작 사이의 딜레이를 계산하여 콤보 보너스와 연결 완성도를 산출합니다.

- metrics:
  - label: 콤보 완성도
    type: percent
    valueKey: comboAccuracy
  - label: 연결 속도
    type: ms
    valueKey: chainDelay
  - label: 밸런스
    type: score
    valueKey: balanceScore

- checklist:
  - 연속 동작 중 발 위치가 꼬이지 않도록 유지
  - 각 펀치 후 가드가 턱 옆으로 복귀
  - AI 공격 타이밍에 즉각 반응

- coachingTips:
  - 빠르기보다 연결 리듬 우선
  - 각 동작이 끊기지 않게 이어가기
  - 공격 후 수비 복귀를 습관화

- referencePanel:
  title: 정석 콤보
  mediaType: image_or_video
  description:
    잽-잽-스트레이트-위빙의 연결 흐름, 복귀 리듬, 밸런스 유지

- cta:
  primary: 실전 연습 시작하기
  secondary: 이전 단계
  tertiary: 상급 전체 보기

---

# 개발 가이드라인

반드시 반영할 규칙:

1. Skeleton Mapping
- MediaPipe 또는 TensorFlow.js Pose Detection 사용
- 17개 관절 좌표 추출 구조 유지

2. Visual Feedback
- 정확도 80% 이상일 때 관절 UI를 녹색
- 80% 미만일 때 주황/적색

3. State Management
- 사용자가 3초 이상 올바른 자세를 유지할 때만
  '연습 시작' 카운트다운 작동

4. Data Sync
- 우측 참고 영상의 timestamp와 사용자 포즈 데이터를 실시간 비교할 수 있도록 설계

5. UX Safety
- 기존 웹캠, 패널, 게임형 인터랙션 요소 제거 금지
- 새 페이지를 만들더라도 기존 기능과 연결 가능해야 함

6. Code Quality
- 공통 컴포넌트화
- 중복 마크업 최소화
- 한글 문자열 UTF-8 안전 처리
- 테스트 가능한 함수 분리

---

# 구현 결과물 요구

출력 형식:

1. 현재 프로젝트에서 재사용 가능한 파일/구조 분석
2. 어떤 파일을 새로 만들고 어떤 파일을 수정할지 목록
3. tutorial page 공통 템플릿 코드
4. tutorial data 구조 코드
5. 6개 페이지 렌더링 방식
6. 웹캠/스켈레톤/AI 피드백 연결 포인트
7. 스타일 코드
8. 라우팅 또는 페이지 전환 방식
9. 테스트 체크리스트
10. 남은 TODO


## 1단계 구조분석
현재 프로젝트에서 튜토리얼/스파링/웹캠 관련 구조를 분석하라.

확인할 것:
- 웹캠 video element 위치
- skeleton overlay canvas 위치
- HUD/status panel 구조
- 기존 sparring/tutorial 관련 HTML/JS/CSS 파일
- 재사용 가능한 컴포넌트 또는 함수
- 페이지 라우팅 방식

출력:
1. 재사용 가능한 구조
2. 수정이 필요한 파일
3. 새로 추가하면 좋은 파일
4. 기존 기능을 유지하기 위해 절대 건드리면 안 되는 부분

## 2단계 공통 템플릿 구현용
튜토리얼 6개 페이지를 위한 공통 템플릿을 구현하라.

요구사항:
- 상단 header
- 좌측 webcam + overlay
- 우측 instruction + ai status + reference panel
- 하단 CTA 버튼
- 데이터 기반 렌더링
- 중복 마크업 최소화

출력:
- 공통 HTML/템플릿 코드
- 필요한 CSS
- 필요한 JS 렌더링 코드

## 3단계: 데이터 구조 구현용
6개 튜토리얼 페이지 데이터를 tutorialData.js 또는 적절한 구조로 구현하라.

필수 필드:
- level
- stageGroup
- title
- subtitle
- routeKey
- progress
- heroInstruction
- shortDescription
- aiLogicSummary
- metrics
- checklist
- coachingTips
- referencePanel
- cta

출력:
- 실제 데이터 코드
- 렌더링과 연결되는 방식


## 4단계: 웹캠/판정 연결용
튜토리얼 페이지가 기존 웹캠/스켈레톤/AI 판정 시스템과 연결될 수 있도록 hook 포인트를 구현하라.

필수:
- webcam stream 재사용
- pose landmark subscription hook
- metric card 업데이트 함수
- 3초 정자세 유지 후 카운트다운 구조
- 참고 영상 timestamp 비교용 stub 함수

출력:
- 연결 포인트 코드
- TODO 주석
- 기존 기능 보존 방식

## 5단계: 스타일 마감용
첨부 이미지와 유사한 미래형 AI 트레이닝 대시보드 스타일로 튜토리얼 페이지 UI를 마감하라.

스타일 요구:
- 딥 블루 + 오렌지 포인트
- 둥근 카드
- 강한 정보 위계
- 웹캠 패널 강조
- 우측 AI 리포트 카드 시각화
- 체크리스트와 CTA 정리
- 반응형 고려

출력:
- CSS 또는 스타일 파일 수정안
- 주요 클래스 설명

## 주의사항 

Codex에게 절대 쓰지 말아야 할 표현

이건 피하세요.

전체를 새로 만들어줘
그냥 예쁘게 다시 짜줘
구조를 갈아엎어줘
깔끔하게 재작성해줘

이렇게 쓰면 기존 웹캠/게임 UI를 또 날릴 가능성이 큽니다.

## 대신 이렇게 쓰세요.

기존 구조를 유지하면서 확장해라
기존 웹캠과 패널을 재사용해라
삭제 없이 추가 방식으로 구현해라
공통 템플릿을 만들되 기존 기능 연결점을 유지해라

기존 기능 삭제 금지, 기존 webcam/overlay/status UI 유지, 전체 재작성 금지, 최소 수정 + 데이터 기반 확장 방식으로 구현하라.
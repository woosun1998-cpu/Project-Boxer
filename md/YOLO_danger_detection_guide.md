# YOLO 실시간 위험물체 탐지 가이드

## 1) YOLO만으로 가능한가?

가능합니다.

- YOLO(예: YOLOv8/YOLO11) + 웹캠 입력만으로 실시간 탐지 구현 가능
- 단, 탐지 가능한 물체는 학습된 클래스에 한정됨
- 정확한 위험물체 탐지를 원하면 커스텀 학습이 필요할 수 있음

## 2) COCO 기준 위험물체 후보

COCO 80 클래스 중 현재 프로젝트(운동 중 주변 충돌 위험) 기준 항목:

- `chair`
- `dining table`
- `couch`
- `bottle`
- `cup`
- `laptop`
- `book`

중요 한계:

- COCO에는 `gun`, `pistol`, `rifle` 같은 총기 클래스가 기본 포함되지 않음

## 3) Roboflow가 필요한가?

- PoC 단계: YOLO만으로 시작 가능
- 운영 단계: Roboflow + 커스텀 데이터셋 권장
  - 데이터 수집/라벨링/버전관리/증강/내보내기 효율이 높음

## 4) 추천 진행 순서

1. **목표 정의**
   - 위험물체 목록, 경보 조건(신뢰도/ROI/연속 프레임) 확정
2. **YOLO 기본 PoC**
   - COCO pretrained로 웹캠 실시간 추론, 위험 클래스 필터링
3. **한계 분석**
   - 미탐/오탐 케이스 수집
4. **커스텀 데이터셋 구축**
   - Roboflow 권장 (train/valid/test 분리 + augmentation)
5. **재학습**
   - YOLO fine-tuning, mAP/precision/recall 확인
6. **경보 정책 적용**
   - N프레임 연속 검출 + ROI 진입 + 임계값 조합
7. **배포/운영**
   - FPS 최적화, 로그 수집, 재학습 루프

## 5) 바로 실행 체크리스트

- [ ] 위험물체 클래스 목록 확정
- [ ] COCO 기반 실시간 데모 실행
- [ ] 위험 클래스 필터 적용
- [ ] 오탐/미탐 사례 저장
- [ ] 커스텀 데이터셋 구축(Roboflow)
- [ ] 재학습 후 성능 비교
- [ ] 경보 로직 적용

## 6) 방금 추가된 데모 기능

`scripts/yolo_realtime_danger_demo.py`에는 아래가 적용되어 있습니다.

- ROI(위험구역) 박스 표시 (화면 중앙 50% x 50%)
- ROI 내부에서 위험물체가 감지되면 연속 프레임 카운트 증가
- `CONSEC_FRAMES_FOR_ALERT`(기본 5프레임) 이상이면 ALERT 상태
- ALERT 상태에서 `winsound.Beep`으로 경보음 발생
- 과도한 알람 반복을 막는 `ALARM_COOLDOWN_SEC` 적용

조정 포인트:

- `CONF_THRESHOLD`
- `CONSEC_FRAMES_FOR_ALERT`
- `ALARM_COOLDOWN_SEC`
- ROI 좌표 비율(`0.25 ~ 0.75`)

### ROI 드래그 사용법

- 마우스 왼쪽 버튼 드래그: 사용자 ROI 지정
- `r` 키: ROI 초기화(기본 중앙 ROI로 복귀)
- `q` 또는 `ESC`: 종료


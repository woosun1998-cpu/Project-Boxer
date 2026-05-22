# YOLO 운동 주변 장애물 학습 가이드

## 1) 목표 클래스

운동 중 부딪힘 위험이 있는 주변 물체를 아래 7개로 학습합니다.

- `chair` (의자)
- `dining table` (책상/테이블)
- `couch` (소파)
- `bottle` (병)
- `cup` (컵)
- `laptop` (노트북)
- `book` (책)

## 2) 폴더 구조

아래 구조를 그대로 맞추세요.

```text
dataset/
  data.yaml
  images/
    train/
    val/
    test/   # 선택
  labels/
    train/
    val/
    test/   # 선택
```

- 이미지: `.jpg`, `.jpeg`, `.png`
- 라벨: YOLO txt 형식 (`class x_center y_center width height`, 0~1 정규화)
- 이미지와 라벨 파일명은 동일해야 함

## 3) 클래스 인덱스 고정

`dataset/data.yaml` 기준:

- `0 chair`
- `1 dining table`
- `2 couch`
- `3 bottle`
- `4 cup`
- `5 laptop`
- `6 book`

라벨링 툴(Roboflow/CVAT/LabelImg)에서 반드시 동일 순서를 유지하세요.

## 4) 권장 데이터 수

- 최소: 클래스당 200장
- 권장: 클래스당 500장 이상
- 목표: 실제 운동 환경(방 조명/카메라 각도/배경) 기준으로 다양하게 수집

## 5) 학습 실행

사전 설치:

```bash
pip install ultralytics roboflow
```

학습 명령:

```bash
python scripts/train_yolo_obstacle.py --model yolov8n.pt --epochs 80 --imgsz 960
```

정확도 우선(시간 더 소요):

```bash
python scripts/train_yolo_obstacle.py --model yolov8s.pt --epochs 120 --imgsz 960 --batch 8
```

CPU 학습(매우 느림):

```bash
python scripts/train_yolo_obstacle.py --device cpu --batch 4
```

### Roboflow 데이터셋으로 바로 학습

Roboflow에 이미 데이터셋이 올라와 있다면 아래처럼 실행합니다.

```bash
set ROBOFLOW_API_KEY=YOUR_KEY
python scripts/train_yolo_obstacle_roboflow.py --workspace YOUR_WORKSPACE --project YOUR_PROJECT --version 1
```

옵션 예시:

```bash
python scripts/train_yolo_obstacle_roboflow.py --workspace YOUR_WORKSPACE --project YOUR_PROJECT --version 1 --model yolov8s.pt --epochs 120 --imgsz 960 --batch 8
```

## 6) 결과 확인

- 결과 폴더: `runs/obstacle/train/`
- 최적 가중치: `runs/obstacle/train/weights/best.pt`
- 지표: `precision`, `recall`, `mAP50`, `mAP50-95`

## 7) 적용 순서

1. `best.pt`로 실시간 추론 테스트
2. 오탐/미탐 이미지 수집
3. 라벨 보강 후 재학습
4. 위 과정을 반복해 모델 안정화

## 8) 프론트와 연결 시 주의

현재 `tutorial2.html`은 브라우저 `coco-ssd`를 사용합니다.  
커스텀 `best.pt`는 브라우저에서 직접 사용하기 어렵기 때문에, 아래 중 하나로 운영합니다.

- 방법 A: Python 서버 추론(API)로 전환 후 프론트에서 결과 수신
- 방법 B: ONNX/TensorFlow.js 변환 후 웹 추론 파이프라인 구성

빠르게 정확도를 올리려면 방법 A가 구현 난이도가 낮고 안정적입니다.

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import cv2
import numpy as np
from fastapi import APIRouter, File, HTTPException, Query, UploadFile, status
from ultralytics import YOLO
from ultralytics.utils.downloads import safe_download


router = APIRouter()

PROJECT_ROOT = Path(__file__).resolve().parents[3]
# 학습 산출은 dataset/runs 아래에 둡니다 (프로젝트 정리).
TRAINED_WEIGHTS = (
    PROJECT_ROOT / "dataset" / "runs" / "detect" / "runs" / "obstacle" / "desk-v1" / "weights" / "best.pt"
)
FALLBACK_TRAINED_WEIGHTS = (
    PROJECT_ROOT
    / "dataset"
    / "runs"
    / "detect"
    / "runs"
    / "obstacle"
    / "roboflow-train"
    / "weights"
    / "best.pt"
)
DEFAULT_WEIGHTS = PROJECT_ROOT / "dataset" / "pretrained" / "yolov8n.pt"
DEFAULT_WEIGHTS_URL = "https://github.com/ultralytics/assets/releases/download/v8.4.0/yolov8n.pt"


def resolve_weight_path() -> Path:
    if TRAINED_WEIGHTS.exists():
        return TRAINED_WEIGHTS
    if FALLBACK_TRAINED_WEIGHTS.exists():
        return FALLBACK_TRAINED_WEIGHTS
    if not DEFAULT_WEIGHTS.exists():
        # 무엇: 학습 모델이 없으면 무료 공개 YOLO 기본 가중치를 프로젝트 규칙 경로에 받습니다.
        # 왜: Roboflow 학습 산출물이 없어도 chair/cup/laptop 같은 COCO 객체 감지를 바로 테스트하기 위함입니다.
        DEFAULT_WEIGHTS.parent.mkdir(parents=True, exist_ok=True)
        safe_download(url=DEFAULT_WEIGHTS_URL, file=str(DEFAULT_WEIGHTS))
    return DEFAULT_WEIGHTS


@lru_cache(maxsize=1)
def get_model() -> YOLO:
    weight_path = resolve_weight_path()
    if not weight_path.exists():
        raise FileNotFoundError(f"YOLO 가중치 파일을 찾을 수 없습니다: {weight_path}")
    return YOLO(str(weight_path))


@router.post(
    "/obstacles",
    summary="장애물 감지",
    description="웹캠 프레임 이미지를 받아 YOLO로 장애물을 감지합니다.",
)
async def detect_obstacles(
    frame: UploadFile = File(..., description="웹캠 프레임 이미지 파일(jpg/png)"),
    conf: float = Query(0.25, ge=0.05, le=0.95, description="감지 confidence 임계값"),
    imgsz: int = Query(640, ge=320, le=1280, description="추론 해상도"),
) -> dict:
    content = await frame.read()
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="프레임 파일이 비어 있습니다.")

    np_img = np.frombuffer(content, dtype=np.uint8)
    image = cv2.imdecode(np_img, cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="이미지 디코딩에 실패했습니다.")

    try:
        model = get_model()
        results = model.predict(source=image, conf=conf, imgsz=imgsz, verbose=False)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"모델 추론 실패: {exc}") from exc

    detections: list[dict] = []
    names = model.names
    for result in results:
        for box in result.boxes:
            cls_id = int(box.cls[0].item())
            x1, y1, x2, y2 = map(float, box.xyxy[0].tolist())
            detections.append(
                {
                    "class_name": str(names.get(cls_id, cls_id)),
                    "confidence": float(box.conf[0].item()),
                    "bbox": [x1, y1, x2, y2],
                }
            )

    return {
        "detections": detections,
        "count": len(detections),
        "model_path": str(resolve_weight_path()),
    }

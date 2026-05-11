"""
YOLO 실시간 위험물체 탐지 데모 (웹캠)

설치:
  pip install ultralytics opencv-python

실행:
  python scripts/yolo_realtime_danger_demo.py
"""

from ultralytics import YOLO
import cv2
import time
import winsound
from pathlib import Path


# COCO 기준 운동 주변 장애물 위험 클래스
DANGER_CLASSES = {"chair", "dining table", "couch", "bottle", "cup", "laptop", "book"}
CONF_THRESHOLD = 0.4
CONSEC_FRAMES_FOR_ALERT = 5
ALARM_COOLDOWN_SEC = 2.0
TRAINED_WEIGHTS = Path("dataset/runs/detect/runs/obstacle/roboflow-train/weights/best.pt")
DEFAULT_WEIGHTS = Path("dataset/pretrained/yolov8n.pt")


def main():
    model_path = TRAINED_WEIGHTS if TRAINED_WEIGHTS.exists() else DEFAULT_WEIGHTS
    model = YOLO(str(model_path))
    model_class_names = {str(name) for name in model.names.values()}
    effective_danger_classes = (
        DANGER_CLASSES if DANGER_CLASSES.intersection(model_class_names) else model_class_names
    )
    print(f"[INFO] model: {model_path}")
    print(f"[INFO] danger classes: {sorted(effective_danger_classes)}")
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        raise RuntimeError("웹캠을 열 수 없습니다.")

    prev_time = time.time()
    consecutive_roi_hits = 0
    last_alarm_time = 0.0
    window_name = "YOLO Danger Detection"

    roi_state = {
        "x1": None,
        "y1": None,
        "x2": None,
        "y2": None,
        "dragging": False,
        "start_x": 0,
        "start_y": 0,
    }

    def get_effective_roi(frame_w, frame_h):
        if None not in (roi_state["x1"], roi_state["y1"], roi_state["x2"], roi_state["y2"]):
            x1 = max(0, min(frame_w - 1, int(roi_state["x1"])))
            y1 = max(0, min(frame_h - 1, int(roi_state["y1"])))
            x2 = max(0, min(frame_w - 1, int(roi_state["x2"])))
            y2 = max(0, min(frame_h - 1, int(roi_state["y2"])))
            if x1 == x2:
                x2 = min(frame_w - 1, x1 + 1)
            if y1 == y2:
                y2 = min(frame_h - 1, y1 + 1)
            return min(x1, x2), min(y1, y2), max(x1, x2), max(y1, y2), True

        # 기본 ROI: 중앙 50% x 50%
        return int(frame_w * 0.25), int(frame_h * 0.25), int(frame_w * 0.75), int(frame_h * 0.75), False

    def on_mouse(event, x, y, flags, param):
        if event == cv2.EVENT_LBUTTONDOWN:
            roi_state["dragging"] = True
            roi_state["start_x"] = x
            roi_state["start_y"] = y
            roi_state["x1"] = x
            roi_state["y1"] = y
            roi_state["x2"] = x
            roi_state["y2"] = y
        elif event == cv2.EVENT_MOUSEMOVE and roi_state["dragging"]:
            roi_state["x2"] = x
            roi_state["y2"] = y
        elif event == cv2.EVENT_LBUTTONUP:
            roi_state["dragging"] = False
            roi_state["x2"] = x
            roi_state["y2"] = y

    cv2.namedWindow(window_name)
    cv2.setMouseCallback(window_name, on_mouse)

    while True:
        ok, frame = cap.read()
        if not ok:
            break

        frame_h, frame_w = frame.shape[:2]
        roi_x1, roi_y1, roi_x2, roi_y2, custom_roi = get_effective_roi(frame_w, frame_h)

        results = model(frame, conf=CONF_THRESHOLD, verbose=False)
        annotated = frame.copy()

        danger_count = 0
        roi_danger_count = 0
        for r in results:
            for box in r.boxes:
                cls_id = int(box.cls[0].item())
                cls_name = model.names[cls_id]
                conf = float(box.conf[0].item())

                if cls_name not in effective_danger_classes:
                    continue

                danger_count += 1
                x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                center_x = (x1 + x2) // 2
                center_y = (y1 + y2) // 2
                in_roi = roi_x1 <= center_x <= roi_x2 and roi_y1 <= center_y <= roi_y2
                if in_roi:
                    roi_danger_count += 1

                cv2.rectangle(annotated, (x1, y1), (x2, y2), (0, 0, 255), 2)
                cv2.circle(annotated, (center_x, center_y), 3, (0, 255, 255), -1)
                cv2.putText(
                    annotated,
                    f"DANGER: {cls_name} {conf:.2f}" + (" [ROI]" if in_roi else ""),
                    (x1, max(20, y1 - 8)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.6,
                    (0, 0, 255),
                    2,
                    cv2.LINE_AA,
                )

        if roi_danger_count > 0:
            consecutive_roi_hits += 1
        else:
            consecutive_roi_hits = 0

        alert_triggered = consecutive_roi_hits >= CONSEC_FRAMES_FOR_ALERT
        now = time.time()
        if alert_triggered and (now - last_alarm_time) >= ALARM_COOLDOWN_SEC:
            try:
                winsound.Beep(1400, 180)
                winsound.Beep(1000, 180)
            except RuntimeError:
                pass
            last_alarm_time = now

        now = time.time()
        fps = 1.0 / max(1e-6, (now - prev_time))
        prev_time = now

        # ROI 박스 시각화
        cv2.rectangle(
            annotated,
            (roi_x1, roi_y1),
            (roi_x2, roi_y2),
            (0, 0, 255) if alert_triggered else (0, 255, 255),
            2,
        )
        cv2.putText(
            annotated,
            "ROI(CUSTOM)" if custom_roi else "ROI(DEFAULT)",
            (roi_x1 + 6, roi_y1 + 24),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (0, 0, 255) if alert_triggered else (0, 255, 255),
            2,
            cv2.LINE_AA,
        )

        cv2.putText(
            annotated,
            f"FPS: {fps:.1f}",
            (10, 25),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (255, 255, 255),
            2,
            cv2.LINE_AA,
        )
        cv2.putText(
            annotated,
            f"Danger Objects: {danger_count}",
            (10, 55),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (0, 0, 255) if danger_count > 0 else (0, 255, 0),
            2,
            cv2.LINE_AA,
        )
        cv2.putText(
            annotated,
            f"ROI Danger: {roi_danger_count} / Consecutive: {consecutive_roi_hits}",
            (10, 85),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.65,
            (0, 0, 255) if roi_danger_count > 0 else (0, 255, 255),
            2,
            cv2.LINE_AA,
        )
        cv2.putText(
            annotated,
            "ALERT" if alert_triggered else "SAFE",
            (10, 115),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            (0, 0, 255) if alert_triggered else (0, 255, 0),
            2,
            cv2.LINE_AA,
        )
        cv2.putText(
            annotated,
            "Drag mouse to set ROI | r: reset ROI | q/ESC: quit",
            (10, frame_h - 14),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            (220, 220, 220),
            1,
            cv2.LINE_AA,
        )

        cv2.imshow(window_name, annotated)
        key = cv2.waitKey(1) & 0xFF
        if key in (27, ord("q")):  # ESC or q
            break
        if key == ord("r"):
            roi_state["x1"] = None
            roi_state["y1"] = None
            roi_state["x2"] = None
            roi_state["y2"] = None
            roi_state["dragging"] = False

    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()


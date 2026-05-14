#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
무엇: YOLO-Pose 기반 코치 영상 오프라인 펀치 타임스탬프 추출기 / 왜: 수동 라벨 보조·내부 개발용 스냅샷 생성

ultralytics YOLOv8 pose + OpenCV로 어깨-손목 거리 변화율 기반 타격 후보를 잡고,
궤적·팔꿈치 각 휴리스틱으로 jab / hook / uppercut / body_shot 을 분류합니다.
출력: extracted_attacks.js (window.EXTRACTED_ATTACKS = [...])
"""

from __future__ import annotations

import argparse
import math
import sys
from collections import deque
from pathlib import Path
from typing import Deque, List, Optional, Tuple

import cv2
import numpy as np
from tqdm import tqdm
from ultralytics import YOLO

# COCO 17 키포인트 (Ultralytics YOLOv8 pose와 동일 순서)
# 무엇: 상지 추적에 필요한 인덱스만 상수화 / 왜: 매직 넘버 제거
KPT_L_SHOULDER, KPT_R_SHOULDER = 5, 6
KPT_L_ELBOW, KPT_R_ELBOW = 7, 8
KPT_L_WRIST, KPT_R_WRIST = 9, 10
KPT_L_HIP, KPT_R_HIP = 11, 12


def repo_root_from_this_file() -> Path:
    """무엇: backend/ 기준으로 저장소 루트 / 왜: 기본 비디오·가중치 상대경로 고정"""
    return Path(__file__).resolve().parent.parent


def angle_deg_at_b(a: np.ndarray, b: np.ndarray, c: np.ndarray) -> float:
    """무엇: 점 b에서 ba·bc 사이 각도(도) / 왜: 팔꿈치 굽힘 정도로 훅 여부 판단"""
    ba = a.astype(np.float64) - b.astype(np.float64)
    bc = c.astype(np.float64) - b.astype(np.float64)
    nba = float(np.linalg.norm(ba)) + 1e-9
    nbc = float(np.linalg.norm(bc)) + 1e-9
    cos_t = float(np.dot(ba, bc) / (nba * nbc))
    cos_t = max(-1.0, min(1.0, cos_t))
    return float(math.degrees(math.acos(cos_t)))


def pick_main_person_xy(
    keypoints_xy: np.ndarray,
    keypoints_conf: Optional[np.ndarray],
    boxes_conf: Optional[np.ndarray],
) -> Optional[np.ndarray]:
    """
    무엇: 다중 검출 중 1인 선택 / 왜: 코치 단일 트래킹
    상지 평균 신뢰도와 박스 신뢰도를 함께 사용합니다.
    """
    if keypoints_xy is None or len(keypoints_xy) == 0:
        return None
    n = keypoints_xy.shape[0]
    scores = []
    for i in range(n):
        kxy = keypoints_xy[i]
        kcf = keypoints_conf[i] if keypoints_conf is not None else None
        idxs = [KPT_L_SHOULDER, KPT_R_SHOULDER, KPT_L_ELBOW, KPT_R_ELBOW, KPT_L_WRIST, KPT_R_WRIST]
        if kcf is not None:
            arm_mean = float(np.mean([kcf[j] for j in idxs]))
        else:
            arm_mean = 1.0
        box_c = 1.0
        if boxes_conf is not None and len(boxes_conf) > i:
            box_c = float(boxes_conf[i])
        scores.append(arm_mean * 0.65 + box_c * 0.35)
    best = int(np.argmax(scores))
    return keypoints_xy[best].astype(np.float64)


def shoulder_wrist_dist(kp: np.ndarray, side: str) -> float:
    """무엇: 어깨-손목 유클리드 거리(px) / 왜: 팔 길이 팽창으로 뻗기 감지"""
    if side == "L":
        s, w = kp[KPT_L_SHOULDER], kp[KPT_L_WRIST]
    else:
        s, w = kp[KPT_R_SHOULDER], kp[KPT_R_WRIST]
    return float(np.linalg.norm(w - s))


def classify_punch(
    hist_wx: Deque[float],
    hist_wy: Deque[float],
    hist_sy: Deque[float],
    hist_hipy: Deque[float],
    elbow_deg: float,
    side: str,
    frame_w: int,
    frame_h: int,
) -> str:
    """
    무엇: 타격 직전 궤적·각도로 4종 라벨 / 왜: 단일 2D 카메라에서 실용적인 휴리스틱
    OpenCV 좌표: x 오른쪽 증가, y 아래로 증가.
    """
    wx = list(hist_wx)
    wy = list(hist_wy)
    sy = list(hist_sy)
    hipy = list(hist_hipy)
    if len(wx) < 5 or len(wy) < 5:
        return "jab"

    # 몸통 기준선(대략 명치~복부): 어깨-엉덩이 중간
    torso_mid = float(np.median([(sy[i] + hipy[i]) * 0.5 for i in range(min(len(sy), len(hipy)))]))

    w0x, w0y = wx[0], wy[0]
    w1x, w1y = wx[-1], wy[-1]
    dx = w1x - w0x
    dy = w1y - w0y  # 아래로 가면 양수
    lateral = abs(dx) / (frame_w + 1e-6)
    vertical = abs(dy) / (frame_h + 1e-6)

    shoulder_ref = float(np.median(sy[-5:])) if len(sy) >= 5 else float(sy[-1])

    # 손목이 한동안 아래로 깊게 갔다가(큰 y), 마지막에 위로(y 감소) 튀는 패턴 → 어퍼컷
    y_seq = np.array(wy, dtype=np.float64)
    y_lowest = float(np.max(y_seq))  # 화면 아래로 가장 내려간 지점
    y_end = float(y_seq[-1])
    valley_then_up = (y_lowest > shoulder_ref + 0.05 * frame_h) and (y_end < y_lowest - 0.03 * frame_h)

    # 훅: 팔꿈치 굽힘 + 강한 횡이동
    hook_like = elbow_deg < 130.0 and lateral > 0.07

    # 바디: 최종 손목이 어깨선보다 뚜렷이 아래(타격 높이 낮음)
    low_wrist_finish = w1y > shoulder_ref + 0.08 * frame_h

    if low_wrist_finish and w1y > torso_mid + 0.03 * frame_h:
        return "body_shot"
    if valley_then_up and vertical > 0.04:
        return "uppercut"
    if hook_like:
        return "hook"
    # 잽/직선 계열: 수직 변화 상대적으로 작고 횡만 크지 않음
    if lateral < 0.09 and vertical < 0.06:
        return "jab"
    if lateral > vertical * 1.2 and elbow_deg >= 130.0:
        return "jab"
    return "jab"


def write_js_output(path: Path, attacks: List[dict]) -> None:
    """무엇: 프론트에서 바로 붙여넣을 JS 스냅샷 / 왜: 수동 병합·검수용 (window 전역으로 로거와 연동)"""
    lines = [
        "// 자동 추출된 데이터 스냅샷 (YOLO-Pose coach_punch_extractor.py)",
        "window.EXTRACTED_ATTACKS = [",
    ]
    for a in attacks:
        lines.append(f'  {{ time: {a["time"]}, type: "{a["type"]}" }},')
    lines.append("];")
    lines.append("")
    path.write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    root = repo_root_from_this_file()
    parser = argparse.ArgumentParser(
        description="YOLO-Pose 기반 코치 펀치 타임스탬프 추출 → extracted_attacks.js",
    )
    parser.add_argument(
        "--video",
        type=Path,
        default=root / "frontend" / "video" / "스파링어려움.mp4",
        help="분석할 비디오 경로",
    )
    parser.add_argument(
        "--model",
        type=str,
        default=str(root / "dataset" / "pretrained" / "yolov8n-pose.pt"),
        help="YOLOv8 pose 가중치 경로(없으면 이름으로 자동 다운로드)",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=root / "backend" / "extracted_attacks.js",
        help="출력 JS 파일 경로",
    )
    parser.add_argument("--cooldown", type=float, default=0.35, help="펀치당 최소 간격(초)")
    parser.add_argument("--device", type=str, default="0", help="cuda 장치 번호 또는 cpu")
    parser.add_argument("--imgsz", type=int, default=640, help="추론 입력 크기")
    args = parser.parse_args()

    video_path = args.video.resolve()
    if not video_path.is_file():
        print(f"[오류] 비디오 파일이 없습니다: {video_path}", file=sys.stderr)
        return 1

    model_path = Path(args.model)
    if not model_path.is_file():
        # 무엇: 로컬 파일 없을 때 모델 이름만 전달 / 왜: Ultralytics가 캐시에 내려받음
        model_load = "yolov8n-pose.pt"
        print(f"[안내] 로컬 가중치 없음 → {model_load} 사용(자동 다운로드)")
    else:
        model_load = str(model_path)

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        print(f"[오류] OpenCV로 비디오를 열 수 없습니다: {video_path}", file=sys.stderr)
        return 1

    fps = float(cap.get(cv2.CAP_PROP_FPS)) or 30.0
    n_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or 640
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or 480
    print(f"[정보] 비디오: {video_path.name}  {w}x{h}  {fps:.3f} fps  프레임≈{n_frames}")

    device = args.device
    if device != "cpu":
        try:
            import torch

            if not torch.cuda.is_available():
                print("[안내] CUDA 없음 → cpu 로 추론합니다.")
                device = "cpu"
        except Exception:
            device = "cpu"

    model = YOLO(model_load)

    # 무엇: 타격 후보·분류용 짧은 히스토리 / 왜: 메모리 고정·궤적 곡률 추정
    hist_len = 18
    hist_wx_L: Deque[float] = deque(maxlen=hist_len)
    hist_wy_L: Deque[float] = deque(maxlen=hist_len)
    hist_wx_R: Deque[float] = deque(maxlen=hist_len)
    hist_wy_R: Deque[float] = deque(maxlen=hist_len)
    hist_sy_L: Deque[float] = deque(maxlen=hist_len)
    hist_sy_R: Deque[float] = deque(maxlen=hist_len)
    hist_hipy: Deque[float] = deque(maxlen=hist_len)

    prev_d_L: Optional[float] = None
    prev_d_R: Optional[float] = None
    prev_d_max: Optional[float] = None
    prev_vel_smooth: float = 0.0
    last_hit_time_sec: float = -1e9

    # 속도 임계 적응용 버퍼 (양의 연장 속도만)
    pos_vel_buf: Deque[float] = deque(maxlen=int(fps * 2.0))

    attacks: List[dict] = []
    hit_count = 0

    pbar = tqdm(
        total=n_frames if n_frames > 0 else None,
        desc="Pose 분석",
        unit="fr",
        dynamic_ncols=True,
    )

    frame_idx = 0
    while True:
        ok, frame_bgr = cap.read()
        if not ok:
            break

        t_sec = frame_idx / fps
        results = model.predict(
            source=frame_bgr,
            imgsz=args.imgsz,
            device=device,
            verbose=False,
        )
        r0 = results[0]

        kp_xy = None
        if r0.keypoints is not None and r0.keypoints.xy is not None:
            xy = r0.keypoints.xy.cpu().numpy()
            cf = r0.keypoints.conf.cpu().numpy() if r0.keypoints.conf is not None else None
            bcf = r0.boxes.conf.cpu().numpy() if r0.boxes is not None and r0.boxes.conf is not None else None
            kp_xy = pick_main_person_xy(xy, cf, bcf)

        if kp_xy is None:
            # 무엇: 검출 공백 시 거리 미분 상태 초기화 / 왜: 재등장 시 가짜 급가속 방지
            prev_d_L = prev_d_R = prev_d_max = None
            prev_vel_smooth *= 0.4
            frame_idx += 1
            pbar.update(1)
            pbar.set_postfix(hits=hit_count, refresh=False)
            continue

        d_L = shoulder_wrist_dist(kp_xy, "L")
        d_R = shoulder_wrist_dist(kp_xy, "R")
        d_max = max(d_L, d_R)
        side = "L" if d_L >= d_R else "R"

        ls = kp_xy[KPT_L_SHOULDER]
        rs = kp_xy[KPT_R_SHOULDER]
        lh = kp_xy[KPT_L_HIP]
        rh = kp_xy[KPT_R_HIP]
        hip_mid_y = float((lh[1] + rh[1]) * 0.5)

        lw = kp_xy[KPT_L_WRIST]
        rw = kp_xy[KPT_R_WRIST]
        le = kp_xy[KPT_L_ELBOW]
        re = kp_xy[KPT_R_ELBOW]

        hist_wx_L.append(float(lw[0]))
        hist_wy_L.append(float(lw[1]))
        hist_wx_R.append(float(rw[0]))
        hist_wy_R.append(float(rw[1]))
        hist_sy_L.append(float(ls[1]))
        hist_sy_R.append(float(rs[1]))
        hist_hipy.append(hip_mid_y)

        if side == "L":
            elbow_deg = angle_deg_at_b(ls, le, lw)
            wx_hist, wy_hist = hist_wx_L, hist_wy_L
            sy_hist = hist_sy_L
        else:
            elbow_deg = angle_deg_at_b(rs, re, rw)
            wx_hist, wy_hist = hist_wx_R, hist_wy_R
            sy_hist = hist_sy_R

        v_inst = 0.0
        if prev_d_max is not None:
            v_inst = (d_max - prev_d_max) * fps
        alpha = 0.35
        vel_smooth = alpha * v_inst + (1.0 - alpha) * prev_vel_smooth
        prev_vel_smooth = vel_smooth

        if v_inst > 0:
            pos_vel_buf.append(float(v_inst))

        # 무엇: 연장 속도 분포 기반 임계 / 왜: 해상도·동작 강도에 스케일 자동
        if len(pos_vel_buf) > int(fps * 0.5):
            arr = np.array(pos_vel_buf, dtype=np.float64)
            th = float(np.percentile(arr, 88) * 0.72)
            th = max(th, 0.06 * min(w, h) * (fps / 30.0))
        else:
            th = max(120.0, 0.08 * min(w, h))

        extend_px = 0.018 * min(w, h)
        extension_ok = prev_d_max is not None and d_max > prev_d_max + extend_px
        cooldown_ok = (t_sec - last_hit_time_sec) >= float(args.cooldown)
        peak_like = vel_smooth > th and extension_ok

        if peak_like and cooldown_ok:
            punch_type = classify_punch(
                wx_hist,
                wy_hist,
                sy_hist,
                hist_hipy,
                elbow_deg,
                side,
                w,
                h,
            )
            hit_count += 1
            attacks.append({"time": round(t_sec, 2), "type": punch_type})
            last_hit_time_sec = t_sec

        prev_d_L, prev_d_R = d_L, d_R
        prev_d_max = d_max
        frame_idx += 1
        pbar.update(1)
        pbar.set_postfix(hits=hit_count, refresh=True)

    cap.release()
    pbar.close()

    args.out.parent.mkdir(parents=True, exist_ok=True)
    write_js_output(args.out.resolve(), attacks)
    print(f"[완료] 타격 후보 {len(attacks)}건 → {args.out.resolve()}")
    print("[참고] 단일 2D 뷰 휴리스틱이므로 수동 라벨과 차이가 날 수 있습니다. 반드시 검수하세요.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

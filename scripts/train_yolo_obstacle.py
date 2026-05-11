"""
운동 주변 장애물 감지용 YOLO 학습 스크립트.

사용 예시:
  python scripts/train_yolo_obstacle.py --model yolov8n.pt --epochs 80 --imgsz 960
"""

from __future__ import annotations

import argparse
import subprocess
from pathlib import Path

from ultralytics import YOLO


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="YOLO obstacle detector trainer")
    parser.add_argument("--data", default="dataset/data.yaml", help="YOLO data.yaml 경로")
    parser.add_argument(
        "--model",
        default="dataset/pretrained/yolov8n.pt",
        help="초기 가중치(.pt). 기본은 dataset/pretrained/yolov8n.pt",
    )
    parser.add_argument("--epochs", type=int, default=80, help="학습 epoch 수")
    parser.add_argument("--imgsz", type=int, default=960, help="학습 입력 해상도")
    parser.add_argument("--batch", type=int, default=16, help="배치 크기")
    parser.add_argument("--device", default="0", help="GPU 번호 또는 cpu")
    parser.add_argument("--workers", type=int, default=4, help="데이터 로더 worker 수")
    parser.add_argument(
        "--project",
        default="dataset/runs/obstacle",
        help="결과 저장 루트 (기본: dataset/runs/obstacle)",
    )
    parser.add_argument("--name", default="train", help="실험 이름")
    parser.add_argument("--patience", type=int, default=20, help="early stopping patience")
    parser.add_argument(
        "--skip-backup",
        action="store_true",
        help="학습 완료 후 자동 백업을 생략합니다.",
    )
    parser.add_argument(
        "--resume",
        type=str,
        default=None,
        metavar="LAST.pt",
        help=(
            "Ultralytics 체크포인트(보통 weights/last.pt) 경로. "
            "지정 시 해당 런에서 학습 재개(resume=True). best.pt는 재개용이 아닙니다."
        ),
    )
    return parser.parse_args()


def run_auto_backup(source_weight: Path, tag: str, notes: str = "") -> None:
    """학습 완료 직후 가중치를 안전 백업 스크립트로 보관합니다."""
    project_root = Path(__file__).resolve().parents[1]
    python_exe = project_root / "backend" / "venv" / "Scripts" / "python.exe"
    backup_script = project_root / "scripts" / "secure_model_backup.py"
    backup_root = project_root / "dataset" / "model_backups"
    models_dst = project_root / "dataset" / "models" / "weights" / f"{tag}-best.pt"

    if not python_exe.exists():
        raise FileNotFoundError(f"백업용 Python 실행 파일이 없습니다: {python_exe}")
    if not backup_script.exists():
        raise FileNotFoundError(f"백업 스크립트가 없습니다: {backup_script}")
    if not source_weight.exists():
        raise FileNotFoundError(f"백업할 가중치가 없습니다: {source_weight}")

    cmd = [
        str(python_exe),
        str(backup_script),
        "--source",
        str(source_weight),
        "--backup-root",
        str(backup_root),
        "--tag",
        tag,
        "--notes",
        notes or "train_yolo_obstacle.py 자동 백업",
        "--copy-to-models",
        str(models_dst),
    ]
    subprocess.run(cmd, check=True)


def main() -> None:
    args = parse_args()

    if args.resume:
        ckpt = Path(args.resume).expanduser().resolve()
        if not ckpt.is_file():
            raise FileNotFoundError(f"재개용 체크포인트를 찾을 수 없습니다: {ckpt}")
        print(f"[학습] 체크포인트에서 재개: {ckpt}")
        model = YOLO(str(ckpt))
        train_result = model.train(resume=True)
    else:
        data_path = Path(args.data)
        if not data_path.exists():
            raise FileNotFoundError(f"data.yaml을 찾을 수 없습니다: {data_path}")

        model = YOLO(args.model)
        train_result = model.train(
            data=str(data_path),
            epochs=args.epochs,
            imgsz=args.imgsz,
            batch=args.batch,
            device=args.device,
            workers=args.workers,
            project=args.project,
            name=args.name,
            patience=args.patience,
            pretrained=True,
            optimizer="auto",
            cos_lr=True,
            cache=False,
            close_mosaic=10,
        )
    if args.skip_backup:
        print("[학습] --skip-backup 옵션으로 자동 백업을 건너뜁니다.")
        return

    # Ultralytics 결과 객체의 save_dir에서 best.pt 경로를 추적합니다.
    save_dir = Path(getattr(train_result, "save_dir", ""))
    best_weight = save_dir / "weights" / "best.pt"
    run_auto_backup(best_weight, tag=args.name, notes="train_yolo_obstacle.py 학습 완료 자동 백업")


if __name__ == "__main__":
    main()

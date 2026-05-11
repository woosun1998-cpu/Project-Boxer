"""
Roboflow 데이터셋을 내려받아 YOLO 학습을 실행하는 스크립트.

사용 예시:
  set ROBOFLOW_API_KEY=YOUR_KEY
  python scripts/train_yolo_obstacle_roboflow.py ^
    --workspace my-workspace ^
    --project obstacle-safety ^
    --version 3
"""

from __future__ import annotations

import argparse
import os
import subprocess
from pathlib import Path

from roboflow import Roboflow
from ultralytics import YOLO


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train YOLO with Roboflow dataset")
    parser.add_argument("--workspace", required=True, help="Roboflow workspace slug")
    parser.add_argument("--project", required=True, help="Roboflow project slug")
    parser.add_argument("--version", required=True, type=int, help="Roboflow dataset version")
    parser.add_argument("--format", default="yolov8", help="다운로드 포맷 (기본: yolov8)")
    parser.add_argument(
        "--model",
        default="dataset/pretrained/yolov8n.pt",
        help="초기 가중치(.pt)",
    )
    parser.add_argument("--epochs", type=int, default=80, help="학습 epoch 수")
    parser.add_argument("--imgsz", type=int, default=960, help="입력 해상도")
    parser.add_argument("--batch", type=int, default=16, help="배치 크기")
    parser.add_argument("--device", default="0", help="GPU 번호 또는 cpu")
    parser.add_argument("--workers", type=int, default=4, help="데이터 로더 worker 수")
    parser.add_argument(
        "--project-dir",
        default="dataset/runs/obstacle",
        help="학습 결과 저장 루트 (기본: dataset/runs/obstacle)",
    )
    parser.add_argument("--name", default="roboflow-train", help="학습 실험 이름")
    parser.add_argument("--patience", type=int, default=20, help="early stopping patience")
    parser.add_argument(
        "--skip-backup",
        action="store_true",
        help="학습 완료 후 자동 백업을 생략합니다.",
    )
    return parser.parse_args()


def resolve_data_yaml(download_location: str) -> Path:
    root = Path(download_location)
    data_yaml = root / "data.yaml"
    if data_yaml.exists():
        return data_yaml
    raise FileNotFoundError(f"다운로드 폴더에서 data.yaml을 찾을 수 없습니다: {data_yaml}")


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
        notes or "train_yolo_obstacle_roboflow.py 자동 백업",
        "--copy-to-models",
        str(models_dst),
    ]
    subprocess.run(cmd, check=True)


def main() -> None:
    args = parse_args()
    api_key = os.environ.get("ROBOFLOW_API_KEY", "").strip()
    if not api_key:
        raise EnvironmentError("ROBOFLOW_API_KEY 환경변수가 비어 있습니다.")

    rf = Roboflow(api_key=api_key)
    project = rf.workspace(args.workspace).project(args.project)
    version = project.version(args.version)
    dataset = version.download(args.format)
    data_yaml = resolve_data_yaml(dataset.location)

    model = YOLO(args.model)
    train_result = model.train(
        data=str(data_yaml),
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        device=args.device,
        workers=args.workers,
        project=args.project_dir,
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
    run_auto_backup(best_weight, tag=args.name, notes="train_yolo_obstacle_roboflow.py 학습 완료 자동 백업")


if __name__ == "__main__":
    main()

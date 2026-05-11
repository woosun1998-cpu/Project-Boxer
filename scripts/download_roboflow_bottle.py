"""
Roboflow에서 bottle-esq9b v1(YOLOv8) 데이터를 받아 Boxing_Test 안에 둡니다.

  PowerShell:
    $env:ROBOFLOW_API_KEY = "<Roboflow 웹에서 발급한 키>"
    .\\backend\\venv\\Scripts\\python.exe scripts\\download_roboflow_bottle.py

다운로드 위치는 dataset/_roboflow/ 아래이며, 경로는 dataset/.roboflow_bottle_root.txt 에 기록됩니다.
"""

from __future__ import annotations

import os
from pathlib import Path


def main() -> None:
    key = os.environ.get("ROBOFLOW_API_KEY", "").strip()
    if not key:
        raise SystemExit(
            "ROBOFLOW_API_KEY 환경 변수가 없습니다.\n"
            "  PowerShell 예: $env:ROBOFLOW_API_KEY = '...'"
        )

    try:
        from roboflow import Roboflow
    except ImportError as e:
        raise SystemExit("먼저 실행: .\\backend\\venv\\Scripts\\pip.exe install roboflow") from e

    project_root = Path(__file__).resolve().parents[1]
    dl_root = project_root / "dataset" / "_roboflow"
    dl_root.mkdir(parents=True, exist_ok=True)

    prev = Path.cwd()
    try:
        os.chdir(dl_root)
        rf = Roboflow(api_key=key)
        rf_project = rf.workspace("bottle-detection-berain").project("bottle-esq9b")
        ver = rf_project.version(1)
        dataset = ver.download("yolov8")
    finally:
        os.chdir(prev)

    if hasattr(dataset, "location"):
        loc = Path(dataset.location)
    elif isinstance(dataset, (str, Path)):
        loc = Path(dataset)
    else:
        loc = dl_root

    loc = loc.resolve()
    marker = project_root / "dataset" / ".roboflow_bottle_root.txt"
    marker.write_text(str(loc), encoding="utf-8")
    print(f"[완료] 데이터셋 경로: {loc}")
    print(f"[완료] 통합 스크립트용 기록: {marker}")


if __name__ == "__main__":
    main()

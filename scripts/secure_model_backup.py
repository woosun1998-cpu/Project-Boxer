"""
학습된 가중치(.pt)를 안전하게 백업하는 스크립트.

무엇을 하나요?
1) 원본 파일을 버전 폴더로 복사
2) SHA256 체크섬 파일 생성
3) 메타데이터(JSON) 저장

왜 필요한가요?
- merge/branch 이동/실수 삭제가 발생해도 모델 복구 가능성을 높이기 위해서입니다.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from datetime import datetime
from pathlib import Path


def sha256_of_file(file_path: Path) -> str:
    """파일 무결성 확인을 위해 SHA256 해시를 계산합니다."""
    digest = hashlib.sha256()
    with file_path.open("rb") as fp:
        for chunk in iter(lambda: fp.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="YOLO 가중치 안전 백업 도구")
    parser.add_argument("--source", required=True, help="백업할 원본 가중치 파일(.pt)")
    parser.add_argument(
        "--backup-root",
        default="dataset/model_backups",
        help="백업 루트 폴더 (기본: ./dataset/model_backups)",
    )
    parser.add_argument(
        "--tag",
        default="manual",
        help="백업 태그 (예: desk-v1, roboflow-v3 등)",
    )
    parser.add_argument(
        "--notes",
        default="",
        help="메모 (학습 조건/특이사항 등)",
    )
    parser.add_argument(
        "--copy-to-models",
        default="",
        help="추가 복사 대상 경로 (예: models/weights/desk-v1-best.pt)",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    source = Path(args.source).resolve()
    if not source.exists():
        raise FileNotFoundError(f"원본 가중치 파일을 찾을 수 없습니다: {source}")
    if source.suffix.lower() != ".pt":
        raise ValueError(f".pt 파일만 백업할 수 있습니다: {source}")

    now = datetime.now()
    stamp = now.strftime("%Y%m%d-%H%M%S")
    backup_root = Path(args.backup_root).resolve()
    target_dir = backup_root / f"{args.tag}-{stamp}"
    target_dir.mkdir(parents=True, exist_ok=True)

    # 1) 원본 가중치 복사
    copied_weight = target_dir / source.name
    shutil.copy2(source, copied_weight)

    # 2) 체크섬 생성
    checksum = sha256_of_file(copied_weight)
    checksum_path = target_dir / f"{source.name}.sha256.txt"
    checksum_path.write_text(f"{checksum}  {source.name}\n", encoding="utf-8")

    # 3) 메타데이터 저장
    metadata = {
        "created_at": now.isoformat(),
        "tag": args.tag,
        "source_path": str(source),
        "backup_weight_path": str(copied_weight),
        "sha256": checksum,
        "size_bytes": copied_weight.stat().st_size,
        "notes": args.notes,
    }
    metadata_path = target_dir / "metadata.json"
    metadata_path.write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    # 선택 사항: models/weights 같은 고정 경로에도 함께 복사
    if args.copy_to_models:
        destination = Path(args.copy_to_models).resolve()
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
        metadata["copied_to_models"] = str(destination)
        metadata_path.write_text(
            json.dumps(metadata, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

    print("백업 완료")
    print(f"- 원본: {source}")
    print(f"- 백업 폴더: {target_dir}")
    print(f"- 체크섬: {checksum}")


if __name__ == "__main__":
    main()

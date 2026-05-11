"""
book 단일 클래스 데이터셋(book-1 등)을 Boxing_Test/dataset 7클래스 레이아웃으로 합칩니다.

- 소스 라벨: 클래스 id 0 = book (단일 클래스)
- 통합 라벨: 클래스 id 6 = book (dataset/data.yaml names 기준)

사용 예:
  python scripts/sync_unified_7class_dataset.py
  python scripts/sync_unified_7class_dataset.py --dry-run
  python scripts/sync_unified_7class_dataset.py --source D:\\path\\to\\book-1
"""

from __future__ import annotations

import argparse
import os
import shutil
from pathlib import Path

# 통합 data.yaml 기준: names 에서 book 의 인덱스 (0-based)
BOOK_CLASS_UNIFIED = 6
BOOK_CLASS_SOURCE_SINGLE = 0


def find_image_for_stem(images_dir: Path, stem: str) -> Path | None:
    for ext in (".jpg", ".jpeg", ".png", ".webp", ".bmp"):
        p = images_dir / f"{stem}{ext}"
        if p.is_file():
            return p
    matches = list(images_dir.glob(f"{stem}.*"))
    return matches[0] if matches else None


def remap_label_line(line: str) -> str:
    parts = line.strip().split()
    if not parts:
        return ""
    try:
        cid = int(parts[0])
    except ValueError:
        return line.strip()
    if cid == BOOK_CLASS_SOURCE_SINGLE:
        parts[0] = str(BOOK_CLASS_UNIFIED)
    return " ".join(parts)


def sync_split(
    source_root: Path,
    split_name: str,
    dest_images: Path,
    dest_labels: Path,
    dry_run: bool,
) -> tuple[int, int]:
    src_img = source_root / split_name / "images"
    src_lbl = source_root / split_name / "labels"
    if not src_img.is_dir() or not src_lbl.is_dir():
        print(f"[건너뜀] 없음: {src_img} 또는 {src_lbl}")
        return 0, 0

    copied_img = 0
    copied_lbl = 0
    for label_path in sorted(src_lbl.glob("*.txt")):
        stem = label_path.stem
        img_path = find_image_for_stem(src_img, stem)
        if img_path is None:
            print(f"[경고] 이미지 없음, 라벨만 있음: {label_path.name}")
            continue

        new_label_lines: list[str] = []
        for line in label_path.read_text(encoding="utf-8", errors="replace").splitlines():
            out = remap_label_line(line)
            if out:
                new_label_lines.append(out)

        dest_l = dest_labels / f"{stem}.txt"
        dest_i = dest_images / img_path.name

        if dry_run:
            copied_img += 1
            copied_lbl += 1
            continue

        dest_labels.mkdir(parents=True, exist_ok=True)
        dest_images.mkdir(parents=True, exist_ok=True)
        if not dest_i.exists() or dest_i.stat().st_mtime < img_path.stat().st_mtime:
            shutil.copy2(img_path, dest_i)
            copied_img += 1
        dest_l.write_text("\n".join(new_label_lines) + ("\n" if new_label_lines else ""), encoding="utf-8")
        copied_lbl += 1

    return copied_img, copied_lbl


def main() -> None:
    parser = argparse.ArgumentParser(description="book-1 → unified 7class dataset 폴더로 동기화")
    parser.add_argument(
        "--source",
        type=Path,
        default=None,
        help="book 단일 클래스 데이터셋 루트 (기본: boxer_woosunshin/book-1 또는 환경변수 BOXER_BOOK_DATASET)",
    )
    parser.add_argument(
        "--project",
        type=Path,
        default=Path(__file__).resolve().parents[1],
        help="Boxing_Test 프로젝트 루트",
    )
    parser.add_argument("--dry-run", action="store_true", help="복사/쓰기 없이 개수만")
    args = parser.parse_args()

    source = args.source
    if source is None:
        env = os.environ.get("BOXER_BOOK_DATASET", "").strip()
        if env:
            source = Path(env)
        else:
            source = Path(r"C:\Users\EZ\boxer_woosunshin\book-1")

    project: Path = args.project
    dest_train_img = project / "dataset" / "images" / "train"
    dest_train_lbl = project / "dataset" / "labels" / "train"
    dest_val_img = project / "dataset" / "images" / "val"
    dest_val_lbl = project / "dataset" / "labels" / "val"

    if not source.is_dir():
        raise SystemExit(
            f"소스 데이터셋이 없습니다: {source}\n"
            "  --source 경로를 주거나 BOXER_BOOK_DATASET 환경 변수를 설정하세요."
        )

    print(f"[소스] {source.resolve()}")
    print(f"[대상] {project / 'dataset'}")

    if args.dry_run:
        print("[DRY-RUN] 실제 복사는 하지 않습니다.")
    else:
        for p in (dest_train_img, dest_train_lbl, dest_val_img, dest_val_lbl):
            p.mkdir(parents=True, exist_ok=True)

    n_tr = sync_split(source, "train", dest_train_img, dest_train_lbl, args.dry_run)
    n_va = sync_split(source, "test", dest_val_img, dest_val_lbl, args.dry_run)

    print(
        f"[완료] train: 이미지~{n_tr[0]} 라벨~{n_tr[1]} | "
        f"val(원본 test): 이미지~{n_va[0]} 라벨~{n_va[1]}"
    )
    print(
        "[다음] 의자·책상 등 나머지 클래스는 dataset/images/{train,val} 와 "
        "labels에 직접 추가하고, id는 dataset/data.yaml names (0~6)를 따르세요."
    )


if __name__ == "__main__":
    main()

"""
과거에 학습에 사용했던 로컬 데이터셋을 dataset/data.yaml (7클래스) 트리로 병합합니다.

포함 (클래스 이름으로 통합 맵핑 가능한 것만):
  - boxer_woosunshin/book-1          → book → 클래스 6
  - Boxing_Test/desk-1               → chair, desk→책상류, laptop 등 (keyboard 등 미매칭 박스는 생략)
  - Boxing_Test/Chair-Detection-1    → chair
  - Roboflow bottle-esq9b (선택)     → bottle → 클래스 3  [download_roboflow_bottle.py]

제외 (통합 names 에 없음):
  - box-detection-1 (box)
  - Toy-Model-1 (Ball, Toy)

사용:
  python scripts/merge_past_datasets_into_unified.py --yes
  python scripts/merge_past_datasets_into_unified.py --dry-run
"""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path

import yaml

# dataset/data.yaml 과 동일 순서
UNIFIED_CLASS_NAMES: tuple[str, ...] = (
    "chair",
    "dining table",
    "couch",
    "bottle",
    "cup",
    "laptop",
    "book",
)

# 소스 데이터셋 클래스 이름 → 통합 이름(표준 키워드)
ALIASES: dict[str, str] = {
    "desk": "dining table",
}

_UNIFIED_LOWER = {n.lower(): i for i, n in enumerate(UNIFIED_CLASS_NAMES)}


def _normalize_name(raw: str) -> str:
    return raw.strip().lower()


def source_class_to_unified(source_names: list[str], class_idx: int) -> int | None:
    if class_idx < 0 or class_idx >= len(source_names):
        return None
    key = _normalize_name(source_names[class_idx])
    if key in ALIASES:
        key = ALIASES[key]
    if key in _UNIFIED_LOWER:
        return _UNIFIED_LOWER[key]
    if "book" in key:
        return 6
    return None


def _polygon_to_yolo_box(nums: list[float]) -> tuple[float, float, float, float] | None:
    """정규화 다각형 좌표 (x0 y0 x1 y1 ...) → (cx, cy, w, h)."""
    if len(nums) < 6 or len(nums) % 2 != 0:
        return None
    xs = nums[0::2]
    ys = nums[1::2]
    x1, x2 = min(xs), max(xs)
    y1, y2 = min(ys), max(ys)
    w = max(x2 - x1, 1e-6)
    h = max(y2 - y1, 1e-6)
    cx = (x1 + x2) / 2
    cy = (y1 + y2) / 2
    return (cx, cy, w, h)


def yolo_line_to_unified_box(
    line: str,
    source_names: list[str],
    force_unified: int | None,
) -> str | None:
    """
    한 라인을 detection용 'cls cx cy w h' 한 줄로 변환.
    Roboflow bottle 세그(다각형)는 bbox로 감쌈. force_unified가 있으면 그 cls로 통일.
    """
    parts = line.strip().split()
    if len(parts) < 2:
        return None
    try:
        src_cid = int(parts[0])
    except ValueError:
        return None
    nums = [float(x) for x in parts[1:]]

    if force_unified is not None:
        uid = force_unified
    else:
        uid = source_class_to_unified(source_names, src_cid)
        if uid is None:
            return None

    if len(nums) == 4:
        return f"{uid} {nums[0]:.6f} {nums[1]:.6f} {nums[2]:.6f} {nums[3]:.6f}"
    box = _polygon_to_yolo_box(nums)
    if box is None:
        return None
    cx, cy, w, h = box
    return f"{uid} {cx:.6f} {cy:.6f} {w:.6f} {h:.6f}"


def find_image(images_dir: Path, stem: str) -> Path | None:
    for ext in (".jpg", ".jpeg", ".png", ".webp", ".bmp"):
        p = images_dir / f"{stem}{ext}"
        if p.is_file():
            return p
    matches = list(images_dir.glob(f"{stem}.*"))
    return matches[0] if matches else None


def load_roboflow_names(yaml_path: Path) -> list[str]:
    data = yaml.safe_load(yaml_path.read_text(encoding="utf-8"))
    if not data:
        return []
    names = data.get("names")
    if isinstance(names, dict):
        return [names[k] for k in sorted(names.keys(), key=lambda x: int(x))]
    if isinstance(names, list):
        return [str(x) for x in names]
    return []


def wipe_unified(project: Path, yes: bool) -> None:
    for sub in ("train", "val"):
        for kind in ("images", "labels"):
            d = project / "dataset" / kind / sub
            if not d.is_dir():
                continue
            for f in d.iterdir():
                if f.is_file():
                    f.unlink()


def process_folder(
    *,
    source_names: list[str],
    src_images: Path,
    src_labels: Path,
    dest_images: Path,
    dest_labels: Path,
    file_prefix: str,
    dry_run: bool,
    force_unified: int | None = None,
) -> tuple[int, int, int]:
    """복사한 이미지 수, 쓴 라벨 수, 스킵한 박스(줄) 수."""
    n_img = n_lbl = n_skip_boxes = 0
    if not src_images.is_dir() or not src_labels.is_dir():
        return 0, 0, 0

    for label_path in sorted(src_labels.glob("*.txt")):
        stem = label_path.stem
        img_path = find_image(src_images, stem)
        if img_path is None:
            print(f"  [경고] 이미지 없음: {label_path.name}")
            continue

        out_stem = f"{file_prefix}{stem}"
        out_label_lines: list[str] = []
        for line in label_path.read_text(encoding="utf-8", errors="replace").splitlines():
            converted = yolo_line_to_unified_box(line, source_names, force_unified)
            if converted is None:
                n_skip_boxes += 1
                continue
            out_label_lines.append(converted)

        if not out_label_lines:
            continue

        dest_images.mkdir(parents=True, exist_ok=True)
        dest_labels.mkdir(parents=True, exist_ok=True)

        ext = img_path.suffix
        dest_img = dest_images / f"{out_stem}{ext}"
        dest_lbl = dest_labels / f"{out_stem}.txt"

        if dry_run:
            n_img += 1
            n_lbl += 1
            continue

        shutil.copy2(img_path, dest_img)
        dest_lbl.write_text("\n".join(out_label_lines) + "\n", encoding="utf-8")
        n_img += 1
        n_lbl += 1

    return n_img, n_lbl, n_skip_boxes


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--yes",
        action="store_true",
        help="dataset/images/{train,val} 및 labels 를 비우고 다시 채웁니다.",
    )
    parser.add_argument(
        "--book-root",
        type=Path,
        default=Path(r"C:\Users\EZ\boxer_woosunshin\book-1"),
        help="book-1 데이터셋 루트",
    )
    parser.add_argument(
        "--bottle-root",
        type=Path,
        default=None,
        help="Roboflow bottle 다운로드 루트(비우면 dataset/.roboflow_bottle_root.txt 사용)",
    )
    args = parser.parse_args()

    project: Path = args.project
    book_root: Path = args.book_root
    desk_root = project / "desk-1"
    chair_root = project / "Chair-Detection-1"

    bottle_root: Path | None = None
    marker = project / "dataset" / ".roboflow_bottle_root.txt"
    if args.bottle_root is not None:
        bottle_root = args.bottle_root.resolve()
    elif marker.is_file():
        try:
            cand = Path(marker.read_text(encoding="utf-8").strip())
            if cand.is_dir():
                bottle_root = cand
        except OSError:
            pass
    if bottle_root is not None and not bottle_root.is_dir():
        print(f"[경고] bottle 경로 없음, 생략: {bottle_root}")
        bottle_root = None

    if not args.yes and not args.dry_run:
        raise SystemExit("실행하려면 --yes (기존 통합 폴더 비우기) 또는 --dry-run 을 주세요.")

    if args.dry_run:
        print("[DRY-RUN]")

    # 검증
    for name, path in [
        ("book-1", book_root),
        ("desk-1", desk_root),
        ("Chair-Detection-1", chair_root),
    ]:
        if not path.is_dir():
            raise SystemExit(f"없는 경로 ({name}): {path}")

    if not args.dry_run and args.yes:
        print("[정리] dataset/images·labels 의 train·val 기존 파일 삭제")
        wipe_unified(project, True)

    dest_train_i = project / "dataset" / "images" / "train"
    dest_train_l = project / "dataset" / "labels" / "train"
    dest_val_i = project / "dataset" / "images" / "val"
    dest_val_l = project / "dataset" / "labels" / "val"
    for d in (dest_train_i, dest_train_l, dest_val_i, dest_val_l):
        if not args.dry_run:
            d.mkdir(parents=True, exist_ok=True)

    stats: list[tuple[str, str, int, int, int]] = []

    # 1) book-1
    book_yaml = book_root / "data.yaml"
    book_names = load_roboflow_names(book_yaml)
    if not book_names:
        book_names = ["book"]
    tr = process_folder(
        source_names=book_names,
        src_images=book_root / "train" / "images",
        src_labels=book_root / "train" / "labels",
        dest_images=dest_train_i,
        dest_labels=dest_train_l,
        file_prefix="b1tr_",
        dry_run=args.dry_run,
    )
    stats.append(("book-1 train", "train", *tr))
    va = process_folder(
        source_names=book_names,
        src_images=book_root / "test" / "images",
        src_labels=book_root / "test" / "labels",
        dest_images=dest_val_i,
        dest_labels=dest_val_l,
        file_prefix="b1va_",
        dry_run=args.dry_run,
    )
    stats.append(("book-1 test→val", "val", *va))

    # 2) desk-1 (yaml 경로가 ../ 형태라 실제 폴더는 datasets/deck-1/train 직접 사용)
    desk_yaml = desk_root / "data.yaml"
    desk_names = load_roboflow_names(desk_yaml)
    tr = process_folder(
        source_names=desk_names,
        src_images=desk_root / "train" / "images",
        src_labels=desk_root / "train" / "labels",
        dest_images=dest_train_i,
        dest_labels=dest_train_l,
        file_prefix="d1tr_",
        dry_run=args.dry_run,
    )
    stats.append(("desk-1 train", "train", *tr))
    va = process_folder(
        source_names=desk_names,
        src_images=desk_root / "valid" / "images",
        src_labels=desk_root / "valid" / "labels",
        dest_images=dest_val_i,
        dest_labels=dest_val_l,
        file_prefix="d1va_",
        dry_run=args.dry_run,
    )
    stats.append(("desk-1 valid", "val", *va))

    # 3) Chair-Detection-1
    ch_yaml = chair_root / "data.yaml"
    ch_names = load_roboflow_names(ch_yaml)
    tr = process_folder(
        source_names=ch_names,
        src_images=chair_root / "train" / "images",
        src_labels=chair_root / "train" / "labels",
        dest_images=dest_train_i,
        dest_labels=dest_train_l,
        file_prefix="chtr_",
        dry_run=args.dry_run,
    )
    stats.append(("chair train", "train", *tr))
    va = process_folder(
        source_names=ch_names,
        src_images=chair_root / "valid" / "images",
        src_labels=chair_root / "valid" / "labels",
        dest_images=dest_val_i,
        dest_labels=dest_val_l,
        file_prefix="chva_",
        dry_run=args.dry_run,
    )
    stats.append(("chair valid", "val", *va))

    # 4) Roboflow bottle (bottle → 통합 클래스 3)
    if bottle_root is not None:
        bot_yaml = bottle_root / "data.yaml"
        if not bot_yaml.is_file():
            raise SystemExit(f"bottle data.yaml 없음: {bot_yaml}")
        bot_names = load_roboflow_names(bot_yaml)
        tr = process_folder(
            source_names=bot_names,
            src_images=bottle_root / "train" / "images",
            src_labels=bottle_root / "train" / "labels",
            dest_images=dest_train_i,
            dest_labels=dest_train_l,
            file_prefix="bottr_",
            dry_run=args.dry_run,
            force_unified=3,
        )
        stats.append(("roboflow bottle train", "train", *tr))
        val_img = bottle_root / "valid" / "images"
        val_lbl = bottle_root / "valid" / "labels"
        if not val_img.is_dir():
            val_img = bottle_root / "test" / "images"
            val_lbl = bottle_root / "test" / "labels"
        va = process_folder(
            source_names=bot_names,
            src_images=val_img,
            src_labels=val_lbl,
            dest_images=dest_val_i,
            dest_labels=dest_val_l,
            file_prefix="botva_",
            dry_run=args.dry_run,
            force_unified=3,
        )
        stats.append(("roboflow bottle val", "val", *va))
    else:
        print("[건너뜀] Roboflow bottle — dataset/.roboflow_bottle_root.txt 없음 또는 경로 오류")
        print("         다운로드: backend\\venv\\Scripts\\python.exe scripts\\download_roboflow_bottle.py")

    print("[병합 요약]")
    for label, split, ni, nl, ns in stats:
        print(f"  {label} ({split}): 이미지 {ni}, 라벨파일 {nl}, 매칭안된 박스줄 {ns}")

    print(
        "[참고] box-detection-1 / Toy-Model-1 은 통합 클래스(chair~book)에 없어 제외했습니다."
    )
    print("[다음] python scripts/train_yolo_obstacle.py --data dataset/data.yaml --name unified-from-past")


if __name__ == "__main__":
    main()

# -*- coding: utf-8 -*-
"""로컬 영상·이미지 경로를 네이버 MYBOX 공유 단축 URL로 치환 (프론트엔드 코드용)."""

from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parent.parent / "frontend"
VIDEO_URL = "https://naver.me/FKGOyvqQ"
IMAGE_URL = "https://naver.me/FuN6b5s8"

# 무엇: 비디오 확장자를 가진 리소스 경로 / 왜: 파일명에 공백(한글)이 있어도 끝까지 잡도록 .+? 사용
VIDEO_RE = re.compile(
    r"(?:\.?\.?/)?(?:frontend/)?/?assets/videos/.+?\.(?:mp4|webm|mov)",
    re.IGNORECASE,
)

# 무엇: 이미지·SVG·jpg / 왜: 위와 동일(공백 포함 파일명)
IMAGE_RE = re.compile(
    r"(?:\.?\.?/)?(?:frontend/)?/?(?:assets/images/.+?|image/.+?)\.(?:png|jpg|jpeg|gif|webp|svg)",
    re.IGNORECASE,
)

EXTS = {".html", ".css", ".js"}


def process_file(path: Path) -> bool:
    raw = path.read_text(encoding="utf-8")
    out = IMAGE_RE.sub(IMAGE_URL, VIDEO_RE.sub(VIDEO_URL, raw))
    if out != raw:
        path.write_text(out, encoding="utf-8")
        return True
    return False


def main() -> int:
    if not ROOT.is_dir():
        print("frontend folder not found", ROOT, file=sys.stderr)
        return 1
    changed = 0
    for p in ROOT.rglob("*"):
        if p.suffix.lower() not in EXTS:
            continue
        if process_file(p):
            changed += 1
            print("updated", p.relative_to(ROOT))
    print("files changed:", changed)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

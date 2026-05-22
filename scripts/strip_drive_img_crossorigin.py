# -*- coding: utf-8 -*-
"""구글 드라이브 직링크 img의 crossorigin 제거 → CORS 오류 없이 화면 표시."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "frontend"


def patch_html(text: str) -> str:
    s = text
    s = s.replace(
        '<img crossorigin="anonymous" referrerpolicy="no-referrer"',
        '<img referrerpolicy="no-referrer"',
    )
    s = s.replace('<img crossorigin="anonymous" ', "<img ")
    s = re.sub(
        r'<link rel="preload" as="image" crossorigin="anonymous" href="https://drive\.google\.com/',
        r'<link rel="preload" as="image" href="https://drive.google.com/',
        s,
    )
    return s


def main() -> None:
    n_files = 0
    for p in ROOT.rglob("*.html"):
        raw = p.read_text(encoding="utf-8")
        new = patch_html(raw)
        if new != raw:
            p.write_text(new, encoding="utf-8")
            n_files += 1
            print(p.relative_to(ROOT))
    print("html files updated:", n_files)


if __name__ == "__main__":
    main()

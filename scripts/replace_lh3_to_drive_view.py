# -*- coding: utf-8 -*-
"""lh3 임베드 URL → Drive uc?export=view (일회성 스크립트)"""
import re
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1] / "frontend"
LH3 = re.compile(r"https://lh3\.googleusercontent\.com/d/([^=?/]+)=w\d+")


def main() -> None:
    for pattern in ("*.html", "*.css", "*.js"):
        for path in ROOT.rglob(pattern):
            try:
                text = path.read_text(encoding="utf-8")
            except OSError:
                continue
            new = LH3.sub(r"https://drive.google.com/uc?export=view&id=\1", text)
            if new != text:
                path.write_text(new, encoding="utf-8")
                print("updated", path.relative_to(ROOT.parent))


if __name__ == "__main__":
    main()

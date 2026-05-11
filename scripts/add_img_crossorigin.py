# -*- coding: utf-8 -*-
"""외부 https 이미지 <img>에 crossorigin=\"anonymous\" 보강"""
import re
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1] / "frontend"
IMG_TAG = re.compile(r"<img\b[^>]*>", re.I)


def fix_tag(tag: str) -> str:
    if re.search(r"crossorigin\s*=", tag, re.I):
        return tag
    if "https://" not in tag and "http://" not in tag:
        return tag
    return re.sub(r"<img\s", '<img crossorigin="anonymous" ', tag, count=1, flags=re.I)


def main() -> None:
    for path in ROOT.rglob("*.html"):
        text = path.read_text(encoding="utf-8")

        def repl(m: re.Match) -> str:
            return fix_tag(m.group(0))

        new = IMG_TAG.sub(repl, text)
        if new != text:
            path.write_text(new, encoding="utf-8")
            print("crossorigin", path.relative_to(ROOT.parent))


if __name__ == "__main__":
    main()

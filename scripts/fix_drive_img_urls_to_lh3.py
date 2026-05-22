# -*- coding: utf-8 -*-
"""drive.google.com/uc?export=view&id= → lh3.googleusercontent.com/d/{id}=w2000
무엇: 정적 HTML/CSS/JS의 드라이브 이미지 URL 일괄 치환
왜: uc 링크는 usercontent로 리다이렉트되며 CORP same-site 등으로 로컬 호스트에서 img/url()이 막히는 경우가 있음
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "frontend"
PAT = re.compile(
    r"https://drive\.google\.com/uc\?export=view&id=([a-zA-Z0-9_-]+)"
)
REPL = r"https://lh3.googleusercontent.com/d/\1=w2000"
EXTS = {".html", ".htm", ".css", ".js", ".json"}


def main():
    n_files = 0
    n_subs = 0
    for p in ROOT.rglob("*"):
        if p.suffix.lower() not in EXTS:
            continue
        try:
            text = p.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        new, c = PAT.subn(REPL, text)
        if c:
            p.write_text(new, encoding="utf-8")
            n_files += 1
            n_subs += c
            print(f"{c}\t{p.relative_to(ROOT.parent)}")
    print(f"done: {n_files} files, {n_subs} replacements")


if __name__ == "__main__":
    main()

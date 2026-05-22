# -*- coding: utf-8 -*-
"""
drive.google.com/uc?export=view&id=… → lh3.googleusercontent.com/d/{id}=w2000
무엇: 직통 uc URL은 usercontent로 리다이렉트되며 CORP same-site로 로컬 호스트에서 img가 막힘.
왜: lh3 호스트는 외부 페이지 임베드에 적합한 응답 헤더를 줌.
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# 프론트 + 스크립트 내 문자열만 치환
SCAN = [
    ROOT / "frontend",
    ROOT / "scripts",
]

RE_UC = re.compile(
    r"https://drive\.google\.com/uc\?export=view&id=([a-zA-Z0-9_-]+)"
)


def patch(s: str) -> str:
    return RE_UC.sub(r"https://lh3.googleusercontent.com/d/\1=w2000", s)


def main() -> None:
    n = 0
    for base in SCAN:
        if not base.is_dir():
            continue
        for p in base.rglob("*"):
            if p.suffix.lower() not in (".html", ".js", ".css", ".py", ".json"):
                continue
            raw = p.read_text(encoding="utf-8")
            new = patch(raw)
            if new != raw:
                p.write_text(new, encoding="utf-8")
                n += 1
                print(p.relative_to(ROOT))
    print("files updated:", n)


if __name__ == "__main__":
    main()

# -*- coding: utf-8 -*-
"""
프론트엔드 파일의 깨진 주석(모지바케)을 한국어 주석으로 정리합니다.

주의:
- 코드 로직/문자열은 건드리지 않고 주석만 정리합니다.
- 사람이 작성한 의미를 100% 복원할 수 없으므로, 공통 한국어 주석으로 교체합니다.
"""

from __future__ import annotations

from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend"


# 깨진 문자(U+FFFD) 또는 물음표가 반복되는 패턴을 모지바케 힌트로 사용
MOJIBAKE_HINT = re.compile(r"�|\?{2,}")


def normalize_line(line: str, ext: str) -> str:
    stripped = line.strip()

    # HTML 주석
    if ext == ".html" and stripped.startswith("<!--") and MOJIBAKE_HINT.search(line):
        indent = line[: len(line) - len(line.lstrip())]
        return f"{indent}<!-- 화면 주석 정리됨 -->"

    # JS/CSS 주석
    if (ext in {".js", ".css", ".html"}) and stripped.startswith("//") and MOJIBAKE_HINT.search(line):
        indent = line[: len(line) - len(line.lstrip())]
        return f"{indent}// 한글 주석 정리됨"

    # 블록 주석 시작 줄
    if stripped.startswith("/*") and MOJIBAKE_HINT.search(line):
        indent = line[: len(line) - len(line.lstrip())]
        return f"{indent}/* 한글 주석 정리됨 */"

    return line


def process_file(path: Path) -> bool:
    src = path.read_text(encoding="utf-8")
    lines = src.splitlines()
    fixed = [normalize_line(line, path.suffix.lower()) for line in lines]
    out = "\n".join(fixed) + ("\n" if src.endswith("\n") else "")
    if out != src:
        path.write_text(out, encoding="utf-8")
        return True
    return False


def main() -> None:
    targets = list(FRONTEND.glob("*.html"))
    targets += list((FRONTEND / "css").glob("*.css"))
    targets += list((FRONTEND / "js").rglob("*.js"))

    changed = []
    for target in targets:
        if process_file(target):
            changed.append(target.relative_to(ROOT).as_posix())

    if not changed:
        print("no comment changes")
        return

    print("updated files:")
    for item in changed:
        print("-", item)


if __name__ == "__main__":
    main()


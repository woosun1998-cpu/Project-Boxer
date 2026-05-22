# -*- coding: utf-8 -*-
"""
프론트엔드 절대 경로(/frontend/...)를 상대 경로로 바꿉니다.
같은 폴더에서 http.server를 띄울 때와 Boxer 루트에서 띄울 때 모두 동작하도록 합니다.
"""
from __future__ import annotations

import pathlib


def fix_text(text: str) -> str:
    """한 번에 적용할 치환 규칙."""
    n = text
    n = n.replace('href="/frontend/', 'href="')
    n = n.replace("window.location.href = '/frontend/", "window.location.href = '")
    n = n.replace('"/frontend/assets/', '"assets/')
    n = n.replace("'/frontend/assets/", "'assets/")
    return n


def main() -> None:
    root = pathlib.Path(__file__).resolve().parents[1] / "frontend"
    targets: list[pathlib.Path] = list(root.glob("*.html"))
    targets += list((root / "js").rglob("*.js"))

    for path in targets:
        raw = path.read_text(encoding="utf-8")
        new = fix_text(raw)
        if new != raw:
            path.write_text(new, encoding="utf-8")
            print("updated:", path.relative_to(root.parent))


if __name__ == "__main__":
    main()

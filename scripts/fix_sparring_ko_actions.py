# -*- coding: utf-8 -*-
"""sparring.html 의 K.O. 영역 망가진 한글/태그 수정."""
from __future__ import annotations

import pathlib


def main() -> None:
    path = pathlib.Path(__file__).resolve().parents[1] / "frontend" / "sparring.html"
    lines = path.read_text(encoding="utf-8").splitlines()
    # 1-based line numbers → 0-based index: lines 546-548
    lines[545] = '    <button class="btn-primary" onclick="restartGame()">다시 하기</button>'
    lines[546] = '    <a class="btn-outline" href="dashboard.html">대시보드</a>'
    lines[547] = (
        '    <a class="btn-outline" href="shop.html" '
        'style="color:var(--color-accent-gold);border-color:rgba(255,214,10,0.3);">샵</a>'
    )
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("ok:", path)


if __name__ == "__main__":
    main()

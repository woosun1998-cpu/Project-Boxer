# -*- coding: utf-8 -*-
"""admin.html 네비/상태 문구를 한국어로 정규화."""
from __future__ import annotations

import pathlib
import re


def main() -> None:
    path = pathlib.Path(__file__).resolve().parents[1] / "frontend" / "admin.html"
    text = path.read_text(encoding="utf-8")

    rules: list[tuple[str, str]] = [
        (r'(<a class="nav-link" href="dashboard\.html">)[^<]*(</a>)', r"\1대시보드\2"),
        (r'(<a class="nav-link" href="tutorial\.html">)[^<]*(</a>)', r"\1튜토리얼\2"),
        (r'(<a class="nav-link" href="sparring\.html">)[^<]*(</a>)', r"\1스파링\2"),
        (r'(<a class="nav-link" href="shop\.html">)[^<]*(</a>)', r"\1샵\2"),
        (
            r'(<div style="font-size:13px;color:var\(--color-text-secondary\);">)[^<]*(</div>)',
            r"\1서버 상태 확인 중...\2",
        ),
        (r'(<strong id="server-status-text">)[^<]*(</strong>)', r"\1서버 상태 확인 중...\2"),
        (r'(onclick="auth\.logout\(\)">)[^<]*(</button>)', r"\1로그아웃\2"),
    ]

    new = text
    for pattern, replacement in rules:
        new = re.sub(pattern, replacement, new)

    if new != text:
        path.write_text(new, encoding="utf-8")
        print("updated admin.html")
    else:
        print("no changes")


if __name__ == "__main__":
    main()

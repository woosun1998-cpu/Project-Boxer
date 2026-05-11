# -*- coding: utf-8 -*-
"""이미지 경로·data SVG 플레이스홀더를 구글 드라이브 직통 URL로 통일, img에 crossorigin 보강."""

import re
from pathlib import Path

FRONTEND = Path(__file__).resolve().parent.parent / "frontend"
# 구식 단일 플레이스홀더 ID 대신, 스크립트 실행 시에는 로고 이미지를 기본으로 씀(필요 시 boxer-drive-images.js 참고).
DRIVE = "https://lh3.googleusercontent.com/d/12JEeAGf9eRkYAyIIRxDZDW3ugiwf-Kk8=w2000"

RE_DATA_SVG_URL = re.compile(r'url\(\s*["\']?data:image/svg\+xml[^)]*\)', re.I)

# 파일명에 공백(예: CPU HP BAR3.png) 허용 → 따옴표 밖 경로는 [^"'<>]+ 로 매칭
RE_LOCAL_FILE = re.compile(
    r"(?:\./|\.\./|/)?(?:assets/images/|image/)[^\"'<>]+?\.(?:png|jpe?g|gif|webp|svg)(?:\?[^\"'<>)]*)?",
    re.I,
)


def swap_data_uris(s: str) -> str:
    s = re.sub(r'"data:image/svg\+xml[^"]*"', f'"{DRIVE}"', s, flags=re.I)
    s = re.sub(r"'data:image/svg\+xml[^']*'", f"'{DRIVE}'", s, flags=re.I)
    s = RE_DATA_SVG_URL.sub(f'url("{DRIVE}")', s)
    return s


def swap_local_image_paths(s: str) -> str:
    return RE_LOCAL_FILE.sub(DRIVE, s)


def ensure_img_crossorigin(html: str) -> str:
    # 구글 드라이브 uc 링크에는 crossorigin을 붙이지 않음 → 응답에 ACAO가 없어 CORS로 img 로드가 막힘.
    return html


def patch_text(s: str, is_html: bool) -> str:
    s = swap_data_uris(s)
    s = swap_local_image_paths(s)
    if is_html:
        s = re.sub(
            r"<img\s+src=\"\$\{profileImg\}\"",
            '<img src="${profileImg}"',
            s,
            flags=re.I,
        )
        s = re.sub(
            r"<img\s+src='\$\{profileImg\}'",
            "<img src='${profileImg}'",
            s,
            flags=re.I,
        )
        s = ensure_img_crossorigin(s)
    return s


def main() -> None:
    n = 0
    for p in FRONTEND.rglob("*"):
        suf = p.suffix.lower()
        if suf not in (".html", ".css", ".js"):
            continue
        raw = p.read_text(encoding="utf-8")
        new = patch_text(raw, suf == ".html")
        if new != raw:
            p.write_text(new, encoding="utf-8")
            n += 1
            print(p.relative_to(FRONTEND))
    print("files updated:", n)


if __name__ == "__main__":
    main()

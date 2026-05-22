# -*- coding: utf-8 -*-
"""모든 frontend HTML에서 naver.me MYBOX URL을 로컬/데이터 URI로 치환."""

from pathlib import Path
import re

FRONTEND = Path(__file__).resolve().parent.parent / "frontend"
PLACEHOLDER_IMG = (
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='480' height='360'%3E"
    "%3Crect fill='%231c1c1c' width='100%25' height='100%25'/%3E%3C/svg%3E"
)
LOCAL_VIDEO = "./assets/videos/스파링초보.mp4"


def strip_file(p: Path) -> bool:
    s = p.read_text(encoding="utf-8")
    orig = s
    s = re.sub(r"https?://naver\.me/[^\s\"'<>)]*", lambda m: LOCAL_VIDEO if "FKGO" in m.group(0) or "vqQ" in m.group(0) else PLACEHOLDER_IMG, s)
    # 동일 축약 경로가 이미지/영상 구분 없이 섞였을 경우: FuN 이미지, FKGO 영상
    s = s.replace("https://naver.me/FuN6b5s8", PLACEHOLDER_IMG)
    s = s.replace("https://naver.me/FKGOyvqQ", LOCAL_VIDEO)
    if s != orig:
        p.write_text(s, encoding="utf-8")
        return True
    return False


def main() -> None:
    n = 0
    for p in FRONTEND.rglob("*.html"):
        if strip_file(p):
            n += 1
            print(p.relative_to(FRONTEND))
    print("updated", n, "files")


if __name__ == "__main__":
    main()

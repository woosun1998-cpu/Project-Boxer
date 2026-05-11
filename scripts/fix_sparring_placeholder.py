# -*- coding: utf-8 -*-
from pathlib import Path

p = Path(__file__).resolve().parents[1] / "frontend" / "sparring.html"
lines = p.read_text(encoding="utf-8").splitlines()
lines[465] = '        <div style="font-size:4rem;">🎬</div>'
lines[466] = "        <div>공격 영상 준비 중...</div>"
p.write_text("\n".join(lines) + "\n", encoding="utf-8")
print("ok")

# -*- coding: utf-8 -*-
"""admin.html 상단(로딩·네비·서버배너·상태카드) 망가진 한글 구간을 줄 단위로 복구합니다."""
from __future__ import annotations

import pathlib


def main() -> None:
    path = pathlib.Path(__file__).resolve().parents[1] / "frontend" / "admin.html"
    lines = path.read_text(encoding="utf-8").splitlines()

    # 0-based 인덱스 = 파일 줄번호 - 1
    lines[321] = (
        '  <div style="font-size:13px;color:var(--color-text-secondary);">'
        "서버 상태 확인 중...</div>"
    )
    lines[324] = "<!-- 상단 네비게이션 -->"
    lines[334] = '    <a class="nav-link" href="dashboard.html">대시보드</a>'
    lines[335] = '    <a class="nav-link" href="tutorial.html">튜토리얼</a>'
    lines[336] = '    <a class="nav-link" href="sparring.html">스파링</a>'
    lines[337] = '    <a class="nav-link" href="shop.html">샵</a>'
    lines[340] = (
        '    <button class="btn-outline" style="padding:8px 16px;font-size:13px;" '
        'onclick="auth.logout()">로그아웃</button>'
    )
    lines[346] = "  <!-- 서버 상태 배너 -->"
    lines[350] = '      <strong id="server-status-text">서버 상태 확인 중...</strong>'
    lines[354] = '      <button class="btn-sm" onclick="checkServerHealth()">새로고침</button>'
    lines[355] = (
        '      <a class="btn-sm success" href="http://localhost:8000/docs" '
        'target="_blank">Swagger UI</a>'
    )
    lines[360] = "  <!-- 요약 카드 -->"
    lines[363] = '      <div class="status-card-icon">👤</div>'
    lines[364] = (
        '      <div class="status-card-num" id="stat-users" '
        'style="color:var(--color-accent-blue);">-</div>'
    )
    lines[365] = '      <div class="status-card-label">가입 회원 수</div>'
    lines[368] = '      <div class="status-card-icon">📚</div>'
    lines[369] = (
        '      <div class="status-card-num" id="stat-tutorials" '
        'style="color:var(--color-accent-green);">-</div>'
    )
    lines[370] = '      <div class="status-card-label">튜토리얼 수</div>'
    lines[373] = '      <div class="status-card-icon">🎬</div>'
    lines[374] = (
        '      <div class="status-card-num" id="stat-videos" '
        'style="color:var(--color-accent-red);">-</div>'
    )
    lines[375] = '      <div class="status-card-label">공격 영상 수</div>'
    lines[378] = '      <div class="status-card-icon">🏆</div>'
    lines[379] = (
        '      <div class="status-card-num" id="stat-topscore" '
        'style="color:var(--color-accent-gold);">-</div>'
    )
    lines[380] = '      <div class="status-card-label">최고 점수</div>'
    lines[383] = '      <div class="status-card-icon">⭐</div>'
    lines[384] = (
        '      <div class="status-card-num" id="stat-my-score" '
        'style="color:var(--color-text-secondary);">-</div>'
    )
    lines[385] = '      <div class="status-card-label">내 점수</div>'

    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("ok:", path)


if __name__ == "__main__":
    main()

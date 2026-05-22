from __future__ import annotations

import json
from pathlib import Path
import sys
import urllib.request
import urllib.error

import pymysql


def bootstrap_path() -> None:
    base = Path(__file__).resolve().parents[1]
    if str(base) not in sys.path:
        sys.path.insert(0, str(base))


def http_json(method: str, url: str, token: str | None = None, payload: dict | None = None) -> dict:
    body = None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=10) as resp:
        raw = resp.read().decode("utf-8")
        return json.loads(raw) if raw else {}


def main() -> None:
    bootstrap_path()
    from app.config import settings

    email = "admin_e2e_verify@example.com"
    username = "admin_e2e_verify"
    password = "AdminVerify123!"

    # 1) 관리자 검증용 계정 준비
    try:
        http_json(
            "POST",
            "http://127.0.0.1:8000/api/auth/signup",
            payload={"username": username, "email": email, "password": password},
        )
    except urllib.error.HTTPError:
        # 이미 존재하면 그대로 진행
        pass

    conn = pymysql.connect(
        host=settings.DB_HOST,
        port=settings.DB_PORT,
        user=settings.DB_USER,
        password=settings.DB_PASSWORD,
        database=settings.DB_NAME,
        charset="utf8mb4",
        autocommit=True,
    )
    try:
        with conn.cursor() as cur:
            cur.execute("UPDATE users SET role='admin' WHERE email=%s", (email,))
    finally:
        conn.close()

    login = http_json(
        "POST",
        "http://127.0.0.1:8000/api/auth/login",
        payload={"email": email, "password": password},
    )
    token = login["data"]["token"]

    # 2) 대상 영상: Entry Jab
    videos = http_json("GET", "http://127.0.0.1:8000/api/videos", token=token)
    items = videos.get("data", videos)
    target = next(v for v in items if v.get("title") == "Entry Jab")
    video_id = target["id"]

    original = http_json("GET", f"http://127.0.0.1:8000/api/videos/{video_id}", token=token)
    original_data = original.get("data", original)

    timestamps = original_data.get("timestamps") or []
    if not timestamps:
        raise RuntimeError("Entry Jab 타임스탬프가 없어 검증을 진행할 수 없습니다.")

    # 3) 관리자값 변경 (테스트용)
    changed_timestamps = []
    for idx, ts in enumerate(timestamps):
        changed = {
            "impact_time": float(ts["impact_time"]),
            "dodge_window_ms": int(ts.get("dodge_window_ms") or 650),
            "hitbox_radius": float(ts.get("hitbox_radius") or 0.22),
            "attack_type": (ts.get("attack_type") or "jab"),
            "judge_shape": "lane" if idx == 0 else (ts.get("judge_shape") or "circle"),
            "target_zone": "right_head" if idx == 0 else (ts.get("target_zone") or "head"),
            "required_move": "any" if idx == 0 else (ts.get("required_move") or "auto"),
            "min_displacement": 0.19 if idx == 0 else float(ts.get("min_displacement") or 0.10),
        }
        changed_timestamps.append(changed)

    update_payload = {
        "title": original_data["title"],
        "file_path": original_data["file_path"],
        "attack_type": original_data.get("attack_type") or "jab",
        "difficulty": original_data.get("difficulty") or "beginner",
        "duration_sec": float(original_data.get("duration_sec") or 6.0),
        "thumbnail_url": original_data.get("thumbnail_url"),
        "is_premium": bool(original_data.get("is_premium")),
        "timestamps": changed_timestamps,
    }

    http_json("PUT", f"http://127.0.0.1:8000/api/admin/videos/{video_id}", token=token, payload=update_payload)

    # 4) 변경 반영 확인 (/api/videos/{id}) -> 스파링이 이 응답을 사용
    updated = http_json("GET", f"http://127.0.0.1:8000/api/videos/{video_id}", token=token)
    updated_data = updated.get("data", updated)
    first = (updated_data.get("timestamps") or [])[0]
    print("updated_first_required_move:", first.get("required_move"))
    print("updated_first_judge_shape:", first.get("judge_shape"))
    print("updated_first_target_zone:", first.get("target_zone"))
    print("updated_first_min_displacement:", first.get("min_displacement"))

    # 5) 원복
    restore_payload = {
        "title": original_data["title"],
        "file_path": original_data["file_path"],
        "attack_type": original_data.get("attack_type") or "jab",
        "difficulty": original_data.get("difficulty") or "beginner",
        "duration_sec": float(original_data.get("duration_sec") or 6.0),
        "thumbnail_url": original_data.get("thumbnail_url"),
        "is_premium": bool(original_data.get("is_premium")),
        "timestamps": [
            {
                "impact_time": float(ts["impact_time"]),
                "dodge_window_ms": int(ts.get("dodge_window_ms") or 500),
                "hitbox_radius": float(ts.get("hitbox_radius") or 0.15),
                "attack_type": ts.get("attack_type"),
                "judge_shape": ts.get("judge_shape"),
                "target_zone": ts.get("target_zone"),
                "required_move": ts.get("required_move"),
                "min_displacement": float(ts["min_displacement"]) if ts.get("min_displacement") is not None else None,
            }
            for ts in timestamps
        ],
    }
    http_json("PUT", f"http://127.0.0.1:8000/api/admin/videos/{video_id}", token=token, payload=restore_payload)
    print("restore_done: true")

    # 6) 검증용 관리자 계정 정리
    conn = pymysql.connect(
        host=settings.DB_HOST,
        port=settings.DB_PORT,
        user=settings.DB_USER,
        password=settings.DB_PASSWORD,
        database=settings.DB_NAME,
        charset="utf8mb4",
        autocommit=True,
    )
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM users WHERE email=%s", (email,))
    finally:
        conn.close()
    print("cleanup_user_deleted: true")


if __name__ == "__main__":
    main()


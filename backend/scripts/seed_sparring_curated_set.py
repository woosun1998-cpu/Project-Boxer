from __future__ import annotations

from pathlib import Path
import sys

import pymysql


def bootstrap_path() -> None:
    base = Path(__file__).resolve().parents[1]
    if str(base) not in sys.path:
        sys.path.insert(0, str(base))


def get_connection():
    bootstrap_path()
    from app.config import settings

    return pymysql.connect(
        host=settings.DB_HOST,
        port=settings.DB_PORT,
        user=settings.DB_USER,
        password=settings.DB_PASSWORD,
        database=settings.DB_NAME,
        charset="utf8mb4",
        autocommit=True,
    )


def normalize_required_move(value: str | None) -> str:
    # 무엇: required_move를 표준값으로 변환 -> 왜: 구버전 any 값과 신규 auto 값을 한 형태로 저장하기 위해
    raw = (value or "").strip().lower()
    if raw in {"", "any"}:
        return "auto"
    return raw


def upsert_video(cursor, item: dict) -> int:
    # 무엇: file_path 우선으로 기존 영상을 찾아 업데이트 -> 왜: 제목이 바뀌어도 동일 영상 중복 생성을 막기 위해
    cursor.execute(
        "SELECT id FROM attack_videos WHERE file_path=%s LIMIT 1",
        (item["file_path"],),
    )
    row = cursor.fetchone()
    if not row:
        cursor.execute(
            "SELECT id FROM attack_videos WHERE title=%s LIMIT 1",
            (item["title"],),
        )
        row = cursor.fetchone()

    if row:
        video_id = int(row[0])
        cursor.execute(
            """
            UPDATE attack_videos
            SET title=%s,
                file_path=%s,
                attack_type=%s,
                difficulty=%s,
                duration_sec=%s,
                thumbnail_url=%s,
                is_premium=%s
            WHERE id=%s
            """,
            (
                item["title"],
                item["file_path"],
                item["attack_type"],
                item["difficulty"],
                item["duration_sec"],
                item["thumbnail_url"],
                item["is_premium"],
                video_id,
            ),
        )
        return video_id

    cursor.execute(
        """
        INSERT INTO attack_videos (
          title, file_path, attack_type, difficulty, duration_sec, thumbnail_url, is_premium
        ) VALUES (%s, %s, %s, %s, %s, %s, %s)
        """,
        (
            item["title"],
            item["file_path"],
            item["attack_type"],
            item["difficulty"],
            item["duration_sec"],
            item["thumbnail_url"],
            item["is_premium"],
        ),
    )
    return int(cursor.lastrowid)


def upsert_timestamp(cursor, video_id: int, ts: dict) -> bool:
    required_move = normalize_required_move(ts.get("required_move"))

    # 무엇: impact_time 단위로 타임스탬프를 업데이트/삽입 -> 왜: 같은 타격 시점 데이터가 중복되지 않게 유지하기 위해
    cursor.execute(
        """
        SELECT id
        FROM attack_timestamps
        WHERE video_id=%s AND impact_time=%s
        LIMIT 1
        """,
        (video_id, ts["impact_time"]),
    )
    row = cursor.fetchone()

    if row:
        cursor.execute(
            """
            UPDATE attack_timestamps
            SET dodge_window_ms=%s,
                hitbox_radius=%s,
                attack_type=%s,
                judge_shape=%s,
                target_zone=%s,
                required_move=%s,
                min_displacement=%s
            WHERE id=%s
            """,
            (
                ts["dodge_window_ms"],
                ts["hitbox_radius"],
                ts["attack_type"],
                ts["judge_shape"],
                ts["target_zone"],
                required_move,
                ts["min_displacement"],
                int(row[0]),
            ),
        )
        return False

    cursor.execute(
        """
        INSERT INTO attack_timestamps (
          video_id, impact_time, dodge_window_ms, hitbox_radius,
          attack_type, judge_shape, target_zone, required_move, min_displacement
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            video_id,
            ts["impact_time"],
            ts["dodge_window_ms"],
            ts["hitbox_radius"],
            ts["attack_type"],
            ts["judge_shape"],
            ts["target_zone"],
            required_move,
            ts["min_displacement"],
        ),
    )
    return True


def curated_seed_items() -> list[dict]:
    thumb = {
        "beginner": "/assets/images/player/beginner.png",
        "intermediate": "/assets/images/player/intermediate.png",
        "advanced": "/assets/images/player/advanced.png",
        "pro": "/assets/images/player/pro.png",
    }
    return [
        {
            "title": "Entry Jab",
            "file_path": "/assets/videos/sparring/sparring_beginner_jab_01.mp4",
            "attack_type": "jab",
            "difficulty": "beginner",
            "duration_sec": 6.00,
            "thumbnail_url": thumb["beginner"],
            "is_premium": False,
            "timestamps": [
                {"impact_time": 1.150, "dodge_window_ms": 680, "hitbox_radius": 0.22, "attack_type": "jab", "judge_shape": "circle", "target_zone": "head", "required_move": "slip_side", "min_displacement": 0.09},
                {"impact_time": 3.400, "dodge_window_ms": 650, "hitbox_radius": 0.22, "attack_type": "jab", "judge_shape": "circle", "target_zone": "head", "required_move": "slip_side", "min_displacement": 0.09},
            ],
        },
        {
            "title": "Counter Straight",
            "file_path": "/assets/videos/sparring/sparring_intermediate_straight_02.mp4",
            "attack_type": "straight",
            "difficulty": "intermediate",
            "duration_sec": 7.45,
            "thumbnail_url": thumb["intermediate"],
            "is_premium": False,
            "timestamps": [
                {"impact_time": 1.550, "dodge_window_ms": 520, "hitbox_radius": 0.15, "attack_type": "straight", "judge_shape": "lane", "target_zone": "head", "required_move": "lean_back", "min_displacement": 0.12},
                {"impact_time": 4.250, "dodge_window_ms": 480, "hitbox_radius": 0.14, "attack_type": "straight", "judge_shape": "lane", "target_zone": "head", "required_move": "lean_back", "min_displacement": 0.12},
            ],
        },
        {
            "title": "Inside Hook",
            "file_path": "/assets/videos/sparring/sparring_advanced_hook_01.mp4",
            "attack_type": "hook",
            "difficulty": "advanced",
            "duration_sec": 8.40,
            "thumbnail_url": thumb["advanced"],
            "is_premium": True,
            "timestamps": [
                {"impact_time": 1.450, "dodge_window_ms": 480, "hitbox_radius": 0.13, "attack_type": "hook", "judge_shape": "ellipse", "target_zone": "left_head", "required_move": "slip_side", "min_displacement": 0.14},
                {"impact_time": 4.000, "dodge_window_ms": 450, "hitbox_radius": 0.12, "attack_type": "hook", "judge_shape": "ellipse", "target_zone": "left_head", "required_move": "slip_side", "min_displacement": 0.14},
            ],
        },
        {
            "title": "Pressure Mix",
            "file_path": "/assets/videos/sparring/sparring_pro_mixed_01.mp4",
            "attack_type": "mixed",
            "difficulty": "pro",
            "duration_sec": 9.60,
            "thumbnail_url": thumb["pro"],
            "is_premium": True,
            "timestamps": [
                {"impact_time": 1.300, "dodge_window_ms": 430, "hitbox_radius": 0.12, "attack_type": "mixed", "judge_shape": "ellipse", "target_zone": "body", "required_move": "auto", "min_displacement": 0.16},
                {"impact_time": 4.000, "dodge_window_ms": 380, "hitbox_radius": 0.11, "attack_type": "mixed", "judge_shape": "ellipse", "target_zone": "body", "required_move": "duck", "min_displacement": 0.16},
            ],
        },
    ]


def migrate() -> dict[str, int]:
    connection = get_connection()
    stats = {"videos_upserted": 0, "timestamps_inserted": 0, "timestamps_updated": 0}
    try:
        with connection.cursor() as cursor:
            for item in curated_seed_items():
                video_id = upsert_video(cursor, item)
                stats["videos_upserted"] += 1
                for ts in item["timestamps"]:
                    inserted = upsert_timestamp(cursor, video_id, ts)
                    if inserted:
                        stats["timestamps_inserted"] += 1
                    else:
                        stats["timestamps_updated"] += 1
    finally:
        connection.close()
    return stats


def main() -> None:
    stats = migrate()
    print("Curated sparring seed migration complete.")
    print(f"videos_upserted={stats['videos_upserted']}")
    print(f"timestamps_inserted={stats['timestamps_inserted']}")
    print(f"timestamps_updated={stats['timestamps_updated']}")


if __name__ == "__main__":
    main()


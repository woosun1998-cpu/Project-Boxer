from __future__ import annotations

from pathlib import Path
import sys

import pymysql


def bootstrap_path() -> None:
    base = Path(__file__).resolve().parents[1]
    if str(base) not in sys.path:
        sys.path.insert(0, str(base))


def main() -> None:
    bootstrap_path()
    from app.config import settings

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
            cur.execute(
                """
                SELECT difficulty, COUNT(1)
                FROM attack_videos
                WHERE title IN ('Entry Jab','Counter Straight','Inside Hook','Pressure Mix')
                GROUP BY difficulty
                ORDER BY difficulty
                """
            )
            print("difficulty_counts:", cur.fetchall())

            cur.execute(
                """
                SELECT v.title, t.impact_time, t.required_move, t.judge_shape, t.target_zone
                FROM attack_timestamps t
                JOIN attack_videos v ON v.id = t.video_id
                WHERE v.title IN ('Entry Jab','Counter Straight','Inside Hook','Pressure Mix')
                ORDER BY v.title, t.impact_time
                """
            )
            rows = cur.fetchall()
            print("timestamp_rows:", len(rows))
            for row in rows:
                print(row)
    finally:
        conn.close()


if __name__ == "__main__":
    main()


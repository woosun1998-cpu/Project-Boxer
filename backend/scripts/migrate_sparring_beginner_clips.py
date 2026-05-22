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


def fetch_one(cursor, sql: str, params: tuple) -> tuple | None:
    cursor.execute(sql, params)
    return cursor.fetchone()


def ensure_video(cursor, *, title: str, file_path: str, attack_type: str, difficulty: str, duration_sec: float, thumbnail_url: str, is_premium: bool) -> int:
    row = fetch_one(
        cursor,
        "SELECT id FROM attack_videos WHERE title = %s LIMIT 1",
        (title,),
    )
    if row:
        return int(row[0])

    cursor.execute(
        """
        INSERT INTO attack_videos (
          title, file_path, attack_type, difficulty, duration_sec, thumbnail_url, is_premium
        ) VALUES (%s, %s, %s, %s, %s, %s, %s)
        """,
        (title, file_path, attack_type, difficulty, duration_sec, thumbnail_url, is_premium),
    )
    return int(cursor.lastrowid)


def ensure_timestamp(
    cursor,
    *,
    video_id: int,
    impact_time: float,
    dodge_window_ms: int,
    hitbox_radius: float,
    attack_type: str,
    judge_shape: str,
    target_zone: str,
    required_move: str,
    min_displacement: float,
) -> bool:
    row = fetch_one(
        cursor,
        """
        SELECT id
        FROM attack_timestamps
        WHERE video_id = %s AND impact_time = %s
        LIMIT 1
        """,
        (video_id, impact_time),
    )
    if row:
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
            impact_time,
            dodge_window_ms,
            hitbox_radius,
            attack_type,
            judge_shape,
            target_zone,
            required_move,
            min_displacement,
        ),
    )
    return True


def migrate() -> list[str]:
    changes: list[str] = []
    connection = get_connection()

    beginner_thumbnail = "/assets/images/beginner.png"

    try:
        with connection.cursor() as cursor:
            beginner_flow_id = ensure_video(
                cursor,
                title="Beginner Jab Flow",
                file_path="/assets/videos/beginner-jab-flow.mp4",
                attack_type="jab",
                difficulty="beginner",
                duration_sec=6.00,
                thumbnail_url="/assets/images/beginner-jab-flow.jpg",
                is_premium=False,
            )
            if ensure_timestamp(
                cursor,
                video_id=beginner_flow_id,
                impact_time=1.100,
                dodge_window_ms=650,
                hitbox_radius=0.22,
                attack_type="jab",
                judge_shape="circle",
                target_zone="head",
                required_move="slip_left",
                min_displacement=0.10,
            ):
                changes.append("Beginner Jab Flow timestamp 1.100")

            rhythm_id = ensure_video(
                cursor,
                title="Beginner Jab Rhythm",
                file_path="/assets/videos/sparring/sparring_beginner_jab_02.mp4",
                attack_type="jab",
                difficulty="beginner",
                duration_sec=6.20,
                thumbnail_url=beginner_thumbnail,
                is_premium=False,
            )
            reset_id = ensure_video(
                cursor,
                title="Beginner Jab Reset",
                file_path="/assets/videos/sparring/sparring_beginner_jab_03.mp4",
                attack_type="jab",
                difficulty="beginner",
                duration_sec=6.40,
                thumbnail_url=beginner_thumbnail,
                is_premium=False,
            )

            for video_id, impact_time, dodge_window_ms, hitbox_radius, judge_shape in [
                (rhythm_id, 1.250, 650, 0.22, "circle"),
                (rhythm_id, 3.050, 600, 0.21, "circle"),
                (reset_id, 1.300, 680, 0.22, "lane"),
                (reset_id, 3.350, 620, 0.20, "lane"),
            ]:
                if ensure_timestamp(
                    cursor,
                    video_id=video_id,
                    impact_time=impact_time,
                    dodge_window_ms=dodge_window_ms,
                    hitbox_radius=hitbox_radius,
                    attack_type="jab",
                    judge_shape=judge_shape,
                    target_zone="head",
                    required_move="slip_side",
                    min_displacement=0.10,
                ):
                    changes.append(f"video {video_id} timestamp {impact_time:.3f}")
    finally:
        connection.close()

    return changes


def main() -> None:
    applied = migrate()
    if applied:
        print("Sparring beginner clip migration complete.")
        print("Applied changes:")
        for item in applied:
            print(f"- {item}")
    else:
        print("Sparring beginner clip migration complete. No changes were needed.")


if __name__ == "__main__":
    main()

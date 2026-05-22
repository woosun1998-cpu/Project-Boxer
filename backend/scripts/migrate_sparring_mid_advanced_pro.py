from __future__ import annotations

import os
from pathlib import Path
import sys

import pymysql


def bootstrap_path() -> None:
    base = Path(__file__).resolve().parents[1]
    if str(base) not in sys.path:
        sys.path.insert(0, str(base))
    os.chdir(base)


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


def ensure_video(
    cursor,
    *,
    title: str,
    file_path: str,
    attack_type: str,
    difficulty: str,
    duration_sec: float,
    thumbnail_url: str,
    is_premium: bool,
) -> int:
    row = fetch_one(cursor, "SELECT id FROM attack_videos WHERE title = %s LIMIT 1", (title,))
    if row:
        cursor.execute(
            """
            UPDATE attack_videos
            SET file_path = %s,
                attack_type = %s,
                difficulty = %s,
                duration_sec = %s,
                thumbnail_url = %s,
                is_premium = %s
            WHERE id = %s
            """,
            (file_path, attack_type, difficulty, duration_sec, thumbnail_url, is_premium, int(row[0])),
        )
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


def execute_sql_file(cursor, sql_path: Path) -> int:
    raw = sql_path.read_text(encoding="utf-8")
    statements: list[str] = []
    buffer: list[str] = []

    for line in raw.splitlines():
      stripped = line.strip()
      if not stripped or stripped.startswith("--"):
          continue
      buffer.append(line)
      if stripped.endswith(";"):
          statements.append("\n".join(buffer).strip().rstrip(";"))
          buffer = []

    if buffer:
        statements.append("\n".join(buffer).strip().rstrip(";"))

    count = 0
    for statement in statements:
        if not statement:
            continue
        cursor.execute(statement)
        count += 1
    return count


def migrate() -> list[str]:
    changes: list[str] = []
    connection = get_connection()

    sql_path = Path(__file__).resolve().parents[1] / "app" / "db" / "migrate_sparring_mid_advanced_pro.sql"

    try:
        with connection.cursor() as cursor:
            executed = execute_sql_file(cursor, sql_path)
            changes.append(f"executed_sql_statements={executed}")

            intermediate_thumb = "/assets/images/player/intermediate.png"
            advanced_thumb = "/assets/images/player/advanced.png"
            pro_thumb = "/assets/images/player/pro.png"

            line_control_id = ensure_video(
                cursor,
                title="Line Control",
                file_path="/assets/videos/sparring/sparring_intermediate_straight_01.mp4",
                attack_type="straight",
                difficulty="intermediate",
                duration_sec=7.20,
                thumbnail_url=intermediate_thumb,
                is_premium=False,
            )
            counter_straight_id = ensure_video(
                cursor,
                title="Counter Straight",
                file_path="/assets/videos/sparring/sparring_intermediate_straight_02.mp4",
                attack_type="straight",
                difficulty="intermediate",
                duration_sec=7.45,
                thumbnail_url=intermediate_thumb,
                is_premium=False,
            )
            pressure_finish_id = ensure_video(
                cursor,
                title="Pressure Finish",
                file_path="/assets/videos/sparring/sparring_intermediate_straight_03.mp4",
                attack_type="straight",
                difficulty="intermediate",
                duration_sec=7.80,
                thumbnail_url=intermediate_thumb,
                is_premium=False,
            )

            inside_hook_id = ensure_video(
                cursor,
                title="Inside Hook",
                file_path="/assets/videos/sparring/sparring_advanced_hook_01.mp4",
                attack_type="hook",
                difficulty="advanced",
                duration_sec=8.40,
                thumbnail_url=advanced_thumb,
                is_premium=True,
            )
            duck_hook_id = ensure_video(
                cursor,
                title="Duck and Hook",
                file_path="/assets/videos/sparring/sparring_advanced_hook_02.mp4",
                attack_type="hook",
                difficulty="advanced",
                duration_sec=8.70,
                thumbnail_url=advanced_thumb,
                is_premium=True,
            )
            angle_finish_id = ensure_video(
                cursor,
                title="Angle Finish",
                file_path="/assets/videos/sparring/sparring_advanced_hook_03.mp4",
                attack_type="hook",
                difficulty="advanced",
                duration_sec=8.95,
                thumbnail_url=advanced_thumb,
                is_premium=True,
            )

            pressure_mix_id = ensure_video(
                cursor,
                title="Pressure Mix",
                file_path="/assets/videos/sparring/sparring_pro_mixed_01.mp4",
                attack_type="mixed",
                difficulty="pro",
                duration_sec=9.60,
                thumbnail_url=pro_thumb,
                is_premium=True,
            )
            combo_chain_id = ensure_video(
                cursor,
                title="Combo Chain",
                file_path="/assets/videos/sparring/sparring_pro_mixed_02.mp4",
                attack_type="mixed",
                difficulty="pro",
                duration_sec=9.95,
                thumbnail_url=pro_thumb,
                is_premium=True,
            )
            final_burst_id = ensure_video(
                cursor,
                title="Final Burst",
                file_path="/assets/videos/sparring/sparring_pro_mixed_03.mp4",
                attack_type="mixed",
                difficulty="pro",
                duration_sec=10.30,
                thumbnail_url=pro_thumb,
                is_premium=True,
            )

            dense_timestamps = [
                (line_control_id, 0.900, 560, 0.16, "straight", "lane", "head", "lean_back", 0.12),
                (line_control_id, 1.300, 540, 0.16, "straight", "lane", "head", "lean_back", 0.12),
                (line_control_id, 4.000, 500, 0.15, "straight", "lane", "head", "lean_back", 0.12),
                (counter_straight_id, 1.250, 520, 0.15, "straight", "lane", "head", "lean_back", 0.12),
                (counter_straight_id, 1.900, 500, 0.15, "straight", "lane", "head", "lean_back", 0.12),
                (counter_straight_id, 4.250, 480, 0.14, "straight", "lane", "head", "lean_back", 0.12),
                (pressure_finish_id, 1.050, 560, 0.16, "straight", "lane", "head", "lean_back", 0.12),
                (pressure_finish_id, 1.450, 540, 0.15, "straight", "lane", "head", "lean_back", 0.12),
                (pressure_finish_id, 4.450, 520, 0.15, "straight", "lane", "head", "lean_back", 0.12),
                (inside_hook_id, 1.050, 500, 0.13, "hook", "ellipse", "left_head", "slip_side", 0.14),
                (inside_hook_id, 1.450, 480, 0.13, "hook", "ellipse", "left_head", "slip_side", 0.14),
                (inside_hook_id, 4.000, 450, 0.12, "hook", "ellipse", "left_head", "slip_side", 0.14),
                (duck_hook_id, 1.250, 480, 0.13, "hook", "ellipse", "left_head", "slip_side", 0.14),
                (duck_hook_id, 1.750, 460, 0.13, "hook", "ellipse", "left_head", "slip_side", 0.14),
                (duck_hook_id, 4.350, 430, 0.12, "hook", "ellipse", "left_head", "slip_side", 0.14),
                (angle_finish_id, 1.150, 460, 0.12, "hook", "ellipse", "left_head", "slip_side", 0.14),
                (angle_finish_id, 1.600, 450, 0.12, "hook", "ellipse", "left_head", "slip_side", 0.14),
                (angle_finish_id, 4.100, 420, 0.12, "hook", "ellipse", "left_head", "slip_side", 0.14),
                (pressure_mix_id, 1.150, 430, 0.11, "mixed", "ellipse", "body", "duck", 0.16),
                (pressure_mix_id, 1.650, 420, 0.11, "mixed", "ellipse", "body", "duck", 0.16),
                (pressure_mix_id, 4.000, 380, 0.11, "mixed", "ellipse", "body", "duck", 0.16),
                (combo_chain_id, 1.300, 420, 0.11, "mixed", "ellipse", "body", "duck", 0.16),
                (combo_chain_id, 1.850, 410, 0.10, "mixed", "ellipse", "body", "duck", 0.16),
                (combo_chain_id, 4.100, 380, 0.10, "mixed", "ellipse", "body", "duck", 0.16),
                (final_burst_id, 1.450, 400, 0.10, "mixed", "ellipse", "body", "duck", 0.16),
                (final_burst_id, 1.950, 390, 0.10, "mixed", "ellipse", "body", "duck", 0.16),
                (final_burst_id, 4.300, 360, 0.10, "mixed", "ellipse", "body", "duck", 0.16),
            ]

            for item in dense_timestamps:
                if ensure_timestamp(
                    cursor,
                    video_id=item[0],
                    impact_time=item[1],
                    dodge_window_ms=item[2],
                    hitbox_radius=item[3],
                    attack_type=item[4],
                    judge_shape=item[5],
                    target_zone=item[6],
                    required_move=item[7],
                    min_displacement=item[8],
                ):
                    changes.append(f"video {item[0]} timestamp {item[1]:.3f}")
    finally:
        connection.close()

    return changes


def main() -> None:
    applied = migrate()
    if applied:
        print("Sparring mid/advanced/pro migration complete.")
        print("Applied changes:")
        for item in applied:
            print(f"- {item}")
    else:
        print("Sparring mid/advanced/pro migration complete. No changes were needed.")


if __name__ == "__main__":
    main()

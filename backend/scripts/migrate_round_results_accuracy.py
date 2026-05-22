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


def column_exists(cursor, table_name: str, column_name: str) -> bool:
    cursor.execute(
        """
        SELECT COUNT(*)
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = %s
          AND COLUMN_NAME = %s
        """,
        (table_name, column_name),
    )
    return cursor.fetchone()[0] > 0


def migrate_round_results() -> list[str]:
    applied_changes: list[str] = []
    connection = get_connection()

    alter_statements = [
        (
            "attack_type",
            "ALTER TABLE round_results "
            "ADD COLUMN attack_type VARCHAR(30) NULL AFTER combo_at_time"
        ),
        (
            "accuracy_score",
            "ALTER TABLE round_results "
            "ADD COLUMN accuracy_score INT NOT NULL DEFAULT 0 AFTER attack_type"
        ),
        (
            "judge_label",
            "ALTER TABLE round_results "
            "ADD COLUMN judge_label VARCHAR(20) NULL AFTER accuracy_score"
        ),
    ]

    try:
        with connection.cursor() as cursor:
            for column_name, ddl in alter_statements:
                if column_exists(cursor, "round_results", column_name):
                    continue
                cursor.execute(ddl)
                applied_changes.append(column_name)
    finally:
        connection.close()

    return applied_changes


def main() -> None:
    applied_changes = migrate_round_results()
    if applied_changes:
        print(
            "round_results migration complete. Added columns: "
            + ", ".join(applied_changes)
        )
    else:
        print("round_results migration complete. No changes were needed.")


if __name__ == "__main__":
    main()

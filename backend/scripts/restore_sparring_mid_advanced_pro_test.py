from __future__ import annotations

import os
from pathlib import Path
import sys

import pymysql


def bootstrap_path() -> Path:
    base = Path(__file__).resolve().parents[1]
    if str(base) not in sys.path:
        sys.path.insert(0, str(base))
    os.chdir(base)
    return base


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


def run_sql_file(cursor, sql_path: Path) -> int:
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

    executed = 0
    for statement in statements:
        if not statement:
            continue
        cursor.execute(statement)
        executed += 1
    return executed


def main() -> None:
    sql_path = Path(__file__).resolve().parents[1] / "app" / "db" / "restore_sparring_mid_advanced_pro_test.sql"
    connection = get_connection()
    try:
        with connection.cursor() as cursor:
            executed = run_sql_file(cursor, sql_path)
    finally:
        connection.close()

    print("Temporary sparring restore complete.")
    print(f"Applied SQL statements: {executed}")


if __name__ == "__main__":
    main()

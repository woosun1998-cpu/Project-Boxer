import asyncio
from pathlib import Path
import sys


def bootstrap_path() -> None:
    base = Path(__file__).resolve().parents[1]
    if str(base) not in sys.path:
        sys.path.insert(0, str(base))


async def main() -> None:
    bootstrap_path()

    from app.database import engine, init_database
    from scripts.migrate_round_results_accuracy import migrate_round_results

    def _split_sql_statements(sql_text: str) -> list[str]:
        """세미콜론 기준으로 SQL을 안전하게 분리합니다(문자열 내부 세미콜론 제외)."""
        statements: list[str] = []
        buff: list[str] = []
        in_single_quote = False
        in_double_quote = False
        escape = False

        for ch in sql_text:
            buff.append(ch)
            if escape:
                escape = False
                continue
            if ch == "\\":
                escape = True
                continue
            if ch == "'" and not in_double_quote:
                in_single_quote = not in_single_quote
                continue
            if ch == '"' and not in_single_quote:
                in_double_quote = not in_double_quote
                continue
            if ch == ";" and not in_single_quote and not in_double_quote:
                statement = "".join(buff).strip()
                if statement:
                    statements.append(statement)
                buff = []

        tail = "".join(buff).strip()
        if tail:
            statements.append(tail)
        return statements

    async def _apply_seed_sql() -> int:
        """`app/db/seed.sql`을 읽어 DB에 반영하고 실행된 문장 수를 반환합니다."""
        seed_path = Path(__file__).resolve().parents[1] / "app" / "db" / "seed.sql"
        if not seed_path.exists():
            print("seed.sql not found. Skipping seed data.")
            return 0

        raw_sql = seed_path.read_text(encoding="utf-8")
        statements = _split_sql_statements(raw_sql)
        executed = 0

        async with engine.begin() as conn:
            for stmt in statements:
                stmt_clean = stmt.strip()
                if not stmt_clean:
                    continue
                # aiomysql는 '%'를 파라미터 포맷 기호로 해석하므로
                # SQL 문자열 리터럴의 퍼센트(예: "80%")는 이스케이프가 필요합니다.
                stmt_escaped = stmt_clean.replace("%", "%%")
                await conn.exec_driver_sql(stmt_escaped)
                executed += 1
        return executed

    await init_database()
    seed_count = await _apply_seed_sql()
    applied_changes = migrate_round_results()
    await engine.dispose()
    print("Boxer database is ready.")
    print(f"Applied seed statements: {seed_count}")
    if applied_changes:
        print("Applied round_results migration:", ", ".join(applied_changes))
    else:
        print("round_results migration already up to date.")
    print("You can now start the API and use /api/auth/signup.")


if __name__ == "__main__":
    asyncio.run(main())

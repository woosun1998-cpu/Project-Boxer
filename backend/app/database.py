from collections.abc import AsyncGenerator
from urllib.parse import parse_qsl, urlsplit, urlunsplit

import pymysql
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.config import settings


engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_pre_ping=True,
)

AsyncSessionLocal = sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


Base = declarative_base()


def _strip_database_from_url(database_url: str) -> tuple[str, str]:
    parsed = urlsplit(database_url)
    path = parsed.path.lstrip("/")
    if not path:
        raise ValueError("DATABASE_URL must include a database name.")

    server_url = urlunsplit((parsed.scheme, parsed.netloc, "", parsed.query, parsed.fragment))
    return server_url, path


def ensure_mysql_database_exists() -> None:
    if not settings.DATABASE_URL.startswith("mysql"):
        return

    server_url, database_name = _strip_database_from_url(settings.DATABASE_URL)
    parsed = urlsplit(server_url)

    query = dict(parse_qsl(parsed.query))
    charset = query.get("charset", "utf8mb4")

    connection = pymysql.connect(
        host=parsed.hostname or settings.DB_HOST,
        port=parsed.port or settings.DB_PORT,
        user=parsed.username or settings.DB_USER,
        password=parsed.password or settings.DB_PASSWORD,
        charset=charset,
        autocommit=True,
    )

    try:
        with connection.cursor() as cursor:
            cursor.execute(
                f"CREATE DATABASE IF NOT EXISTS `{database_name}` "
                "DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
            )
    finally:
        connection.close()


async def init_database() -> None:
    ensure_mysql_database_exists()
    import app.models  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await _ensure_schema_migrations(conn)


async def _ensure_schema_migrations(conn) -> None:
    """Lightweight migrations for projects without Alembic.

    This keeps existing installs working when new optional fields are added.
    """

    if not settings.DATABASE_URL.startswith("mysql"):
        return

    async def _has_column(table: str, column: str) -> bool:
        result = await conn.execute(
            text(
                "SELECT COUNT(*) AS c "
                "FROM information_schema.columns "
                "WHERE table_schema=:schema AND table_name=:table AND column_name=:column"
            ),
            {"schema": settings.DB_NAME, "table": table, "column": column},
        )
        return int(result.scalar_one()) > 0

    async def _add_column_if_missing(table: str, column: str, ddl: str) -> None:
        if await _has_column(table, column):
            return
        await conn.execute(text(f"ALTER TABLE `{table}` ADD COLUMN {ddl}"))

    # Admin platform: user manager fields.
    await _add_column_if_missing("users", "level", "`level` INT NOT NULL DEFAULT 1")
    await _add_column_if_missing("users", "is_active", "`is_active` BOOLEAN NOT NULL DEFAULT TRUE")
    await _add_column_if_missing("users", "last_login_at", "`last_login_at` DATETIME NULL")

    # Admin platform: tutorial manager fields copied from IM_BOXER.
    await _add_column_if_missing("boxing_tutorials", "lesson_key", "`lesson_key` VARCHAR(100) NULL")
    await _add_column_if_missing("boxing_tutorials", "subtitle", "`subtitle` VARCHAR(255) NULL")
    await _add_column_if_missing("boxing_tutorials", "category", "`category` VARCHAR(50) NOT NULL DEFAULT 'basic'")
    await _add_column_if_missing("boxing_tutorials", "difficulty", "`difficulty` VARCHAR(30) NOT NULL DEFAULT 'beginner'")
    await _add_column_if_missing("boxing_tutorials", "guide_mp3_url", "`guide_mp3_url` VARCHAR(255) NULL")
    await _add_column_if_missing("boxing_tutorials", "silhouette_url", "`silhouette_url` VARCHAR(255) NULL")
    await _add_column_if_missing("boxing_tutorials", "coach_tip", "`coach_tip` TEXT NULL")
    await _add_column_if_missing("boxing_tutorials", "is_active", "`is_active` BOOLEAN NOT NULL DEFAULT TRUE")
    await _add_column_if_missing("boxing_tutorials", "updated_at", "`updated_at` DATETIME NULL")
    # users tier additions: allow admin accounts for admin.html access.
    await conn.execute(
        text(
            "ALTER TABLE `users` "
            "MODIFY COLUMN `tier` ENUM('free', 'premium', 'admin') NOT NULL DEFAULT 'free'"
        )
    )
    # round_results additions (already used by frontend scoring)
    await _add_column_if_missing("round_results", "attack_type", "`attack_type` VARCHAR(30) NULL")
    await _add_column_if_missing("round_results", "dodge_direction", "`dodge_direction` VARCHAR(30) NULL")
    await _add_column_if_missing("round_results", "accuracy_score", "`accuracy_score` INT NOT NULL DEFAULT 0")
    await _add_column_if_missing("round_results", "judge_label", "`judge_label` VARCHAR(20) NULL")
    await _add_column_if_missing("round_results", "earned_score_per_attack", "`earned_score_per_attack` INT NOT NULL DEFAULT 0")
    await _add_column_if_missing("round_results", "outcome", "`outcome` VARCHAR(20) NULL")

    # attack_timestamps judge metadata
    await _add_column_if_missing("attack_timestamps", "hitbox_radius", "`hitbox_radius` FLOAT DEFAULT 0.15")
    await _add_column_if_missing("attack_timestamps", "judge_shape", "`judge_shape` VARCHAR(20) NULL")
    await _add_column_if_missing("attack_timestamps", "target_zone", "`target_zone` VARCHAR(20) NULL")
    await _add_column_if_missing("attack_timestamps", "required_move", "`required_move` VARCHAR(20) NULL")
    await _add_column_if_missing("attack_timestamps", "min_displacement", "`min_displacement` FLOAT NULL")
    await _add_column_if_missing("attack_timestamps", "attack_type", "`attack_type` VARCHAR(30) NULL")
    await _add_column_if_missing("attack_timestamps", "dodge_window_ms", "`dodge_window_ms` INT NOT NULL DEFAULT 300")

    await _add_column_if_missing("attack_videos", "is_active", "`is_active` BOOLEAN NOT NULL DEFAULT TRUE")

    # attack_videos difficulty: 기존 3단계와 신규 4단계를 모두 허용한다.
    await conn.execute(
        text(
            "ALTER TABLE `attack_videos` "
            "MODIFY COLUMN `difficulty` ENUM("
            "'easy', 'medium', 'hard', 'beginner', 'intermediate', 'advanced', 'pro'"
            ") NOT NULL DEFAULT 'beginner'"
        )
    )


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


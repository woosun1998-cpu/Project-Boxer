from datetime import datetime

from sqlalchemy import DateTime, Enum, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    tier: Mapped[str] = mapped_column(
        Enum("free", "premium", name="user_tier"),
        default="free",
        nullable=False,
    )
    coins: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    injury_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    skill_level: Mapped[str] = mapped_column(
        Enum("beginner", "intermediate", "advanced", name="skill_level"),
        default="beginner",
        nullable=False,
    )
    profile_image: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False),
        server_default=func.now(),
        nullable=False,
    )

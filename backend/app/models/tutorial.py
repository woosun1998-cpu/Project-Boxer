from datetime import datetime

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class BoxingTutorial(Base):
    __tablename__ = "boxing_tutorials"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    lesson_key: Mapped[str | None] = mapped_column(String(100), nullable=True)
    title: Mapped[str] = mapped_column(String(100), nullable=False)
    subtitle: Mapped[str | None] = mapped_column(String(255), nullable=True)
    category: Mapped[str] = mapped_column(String(50), default="basic", nullable=False)
    difficulty: Mapped[str] = mapped_column(String(30), default="beginner", nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    coach_tip: Mapped[str | None] = mapped_column(Text, nullable=True)
    target_pose_json: Mapped[dict | list | None] = mapped_column(JSON, nullable=True)
    video_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    guide_mp3_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    thumbnail_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    silhouette_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    difficulty_level: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    is_premium: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    reward_exp: Mapped[int] = mapped_column(Integer, default=100, nullable=False)
    reward_coins: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    order_sequence: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False),
        server_default=func.now(),
        nullable=False,
    )

    progress_records: Mapped[list["UserProgress"]] = relationship(
        back_populates="tutorial",
        cascade="all, delete-orphan",
    )


class UserProgress(Base):
    __tablename__ = "user_progress"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        primary_key=True,
    )
    tutorial_id: Mapped[int] = mapped_column(
        ForeignKey("boxing_tutorials.id"),
        primary_key=True,
    )
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    best_accuracy: Mapped[float | None] = mapped_column(Float, nullable=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)

    tutorial: Mapped[BoxingTutorial] = relationship(back_populates="progress_records")

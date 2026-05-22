from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class AttackVideo(Base):
    __tablename__ = "attack_videos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(100), nullable=False)
    file_path: Mapped[str] = mapped_column(String(255), nullable=False)
    attack_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    difficulty: Mapped[str] = mapped_column(
        Enum("easy", "medium", "hard", "beginner", "intermediate", "advanced", "pro", name="video_difficulty"),
        default="beginner",
        nullable=False,
    )
    duration_sec: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    thumbnail_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_premium: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False),
        server_default=func.now(),
        nullable=False,
    )

    timestamps: Mapped[list["AttackTimestamp"]] = relationship(
        back_populates="video",
        cascade="all, delete-orphan",
    )


class AttackTimestamp(Base):
    __tablename__ = "attack_timestamps"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    video_id: Mapped[int] = mapped_column(ForeignKey("attack_videos.id"), nullable=False)
    impact_time: Mapped[float] = mapped_column(Numeric(6, 3), nullable=False)
    dodge_window_ms: Mapped[int] = mapped_column(Integer, default=300, nullable=False)
    hitbox_radius: Mapped[float] = mapped_column(Numeric(5, 2), default=0.15, nullable=False)
    attack_type: Mapped[str | None] = mapped_column(String(30), nullable=True)
    judge_shape: Mapped[str | None] = mapped_column(String(20), nullable=True)
    target_zone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    required_move: Mapped[str | None] = mapped_column(String(20), nullable=True)
    min_displacement: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)

    video: Mapped[AttackVideo] = relationship(back_populates="timestamps")

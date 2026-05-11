from datetime import datetime

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class TrainingSession(Base):
    __tablename__ = "training_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    session_type: Mapped[str] = mapped_column(
        Enum("tutorial", "sparring", "rehab", name="session_type"),
        nullable=False,
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False),
        server_default=func.now(),
        nullable=False,
    )
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)
    total_score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_combo: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_rounds: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    exp_earned: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class RoundResult(Base):
    __tablename__ = "round_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("training_sessions.id"), nullable=False)
    video_id: Mapped[int] = mapped_column(ForeignKey("attack_videos.id"), nullable=False)
    result: Mapped[str] = mapped_column(
        Enum("dodge", "hit", name="round_result"),
        nullable=False,
    )
    reaction_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    score_earned: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    earned_score_per_attack: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    combo_at_time: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    attack_type: Mapped[str | None] = mapped_column(String(30), nullable=True)
    dodge_direction: Mapped[str | None] = mapped_column(String(30), nullable=True)
    accuracy_score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    judge_label: Mapped[str | None] = mapped_column(String(20), nullable=True)
    outcome: Mapped[str | None] = mapped_column(String(20), nullable=True)
    nose_x: Mapped[float | None] = mapped_column(Float, nullable=True)
    nose_y: Mapped[float | None] = mapped_column(Float, nullable=True)
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False),
        server_default=func.now(),
        nullable=False,
    )


class PoseCorrection(Base):
    __tablename__ = "pose_corrections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("training_sessions.id"), nullable=False)
    pose_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    accuracy: Mapped[float | None] = mapped_column(Float, nullable=True)
    issue_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    feedback_message: Mapped[str | None] = mapped_column(String(255), nullable=True)
    severity: Mapped[str | None] = mapped_column(
        Enum("low", "medium", "high", name="pose_severity"),
        nullable=True,
    )
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False),
        server_default=func.now(),
        nullable=False,
    )

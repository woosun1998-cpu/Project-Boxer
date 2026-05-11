from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Enum, ForeignKey, Integer, Float, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Leaderboard(Base):
    __tablename__ = "leaderboard"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True, nullable=False)
    total_score: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    max_combo: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_dodges: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    win_rate: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    rank_tier: Mapped[str] = mapped_column(
        Enum("Bronze", "Silver", "Gold", "Platinum", "Diamond", name="rank_tier"),
        default="Bronze",
        nullable=False,
    )
    rank_points: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    season: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

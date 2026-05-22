from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.leaderboard import Leaderboard
from app.models.user import User
from app.schemas.leaderboard import (
    LeaderboardItem,
    LeaderboardUpdateData,
    LeaderboardUpdateRequest,
)


def calculate_rank_tier(score: int) -> str:
    if score >= 6000:
        return "Diamond"
    if score >= 3000:
        return "Platinum"
    if score >= 1500:
        return "Gold"
    if score >= 500:
        return "Silver"
    return "Bronze"


class LeaderboardService:
    async def list_leaderboard(self, db: AsyncSession, limit: int) -> list[LeaderboardItem]:
        rows = (
            await db.execute(
                select(Leaderboard, User.username)
                .join(User, User.id == Leaderboard.user_id)
                .order_by(desc(Leaderboard.total_score), desc(Leaderboard.max_combo), Leaderboard.id.asc())
                .limit(limit)
            )
        ).all()

        result: list[LeaderboardItem] = []
        for idx, row in enumerate(rows, start=1):
            board, username = row
            result.append(
                LeaderboardItem(
                    rank=idx,
                    username=username,
                    total_score=board.total_score,
                    max_combo=board.max_combo,
                    total_dodges=board.total_dodges,
                    win_rate=board.win_rate,
                    rank_tier=board.rank_tier,
                )
            )
        return result

    async def update_me(
        self,
        db: AsyncSession,
        current_user: User,
        payload: LeaderboardUpdateRequest,
    ) -> LeaderboardUpdateData:
        entry = (
            await db.execute(select(Leaderboard).where(Leaderboard.user_id == current_user.id))
        ).scalar_one_or_none()

        if entry is None:
            entry = Leaderboard(user_id=current_user.id)
            db.add(entry)

        entry.total_score = payload.total_score
        entry.max_combo = payload.max_combo
        entry.total_dodges = payload.total_dodges
        entry.win_rate = payload.win_rate
        entry.rank_points = payload.total_score
        entry.rank_tier = calculate_rank_tier(payload.total_score)

        await db.flush()
        await db.refresh(entry)

        return LeaderboardUpdateData(
            user_id=current_user.id,
            total_score=entry.total_score,
            max_combo=entry.max_combo,
            total_dodges=entry.total_dodges,
            win_rate=entry.win_rate,
            rank_tier=entry.rank_tier,
            rank_points=entry.rank_points,
        )

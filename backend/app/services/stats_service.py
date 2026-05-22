from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.session import RoundResult, TrainingSession
from app.models.user import User
from app.models.video import AttackVideo
from app.schemas.stats import AttackTypeStatsItem, StatsData, WeeklyStatsItem


class StatsService:
    async def get_my_stats(self, db: AsyncSession, current_user: User) -> StatsData:
        summary_row = (
            await db.execute(
                select(
                    func.count(TrainingSession.id),
                    func.coalesce(func.sum(TrainingSession.total_score), 0),
                    func.coalesce(func.max(TrainingSession.max_combo), 0),
                ).where(TrainingSession.user_id == current_user.id)
            )
        ).one()

        round_row = (
            await db.execute(
                select(
                    func.count(RoundResult.id),
                    func.coalesce(func.sum(case((RoundResult.result == "dodge", 1), else_=0)), 0),
                    func.coalesce(func.sum(case((RoundResult.result == "hit", 1), else_=0)), 0),
                )
                .select_from(RoundResult)
                .join(TrainingSession, TrainingSession.id == RoundResult.session_id)
                .where(TrainingSession.user_id == current_user.id)
            )
        ).one()

        weekly_rows = (
            await db.execute(
                select(
                    func.date(RoundResult.recorded_at).label("date"),
                    (
                        func.sum(case((RoundResult.result == "dodge", 1), else_=0))
                        / func.count(RoundResult.id)
                    ).label("dodge_rate"),
                    func.avg(RoundResult.reaction_ms).label("avg_reaction_ms"),
                )
                .select_from(RoundResult)
                .join(TrainingSession, TrainingSession.id == RoundResult.session_id)
                .where(TrainingSession.user_id == current_user.id)
                .group_by(func.date(RoundResult.recorded_at))
                .order_by(func.date(RoundResult.recorded_at).desc())
                .limit(30)
            )
        ).all()

        attack_rows = (
            await db.execute(
                select(
                    AttackVideo.attack_type,
                    (
                        func.sum(case((RoundResult.result == "dodge", 1), else_=0))
                        / func.count(RoundResult.id)
                    ).label("success_rate"),
                )
                .select_from(RoundResult)
                .join(TrainingSession, TrainingSession.id == RoundResult.session_id)
                .join(AttackVideo, AttackVideo.id == RoundResult.video_id)
                .where(TrainingSession.user_id == current_user.id)
                .group_by(AttackVideo.attack_type)
            )
        ).all()

        total_rounds = int(round_row[0] or 0)
        total_dodges = int(round_row[1] or 0)
        total_hits = int(round_row[2] or 0)
        win_rate = round(total_dodges / total_rounds, 3) if total_rounds else 0.0

        return StatsData(
            total_sessions=int(summary_row[0] or 0),
            total_score=int(summary_row[1] or 0),
            max_combo=int(summary_row[2] or 0),
            total_dodges=total_dodges,
            total_hits=total_hits,
            win_rate=win_rate,
            weekly_stats=[
                WeeklyStatsItem(
                    date=str(row.date),
                    dodge_rate=round(float(row.dodge_rate or 0), 3),
                    avg_reaction_ms=round(float(row.avg_reaction_ms), 2) if row.avg_reaction_ms is not None else None,
                )
                for row in weekly_rows
            ],
            attack_type_stats=[
                AttackTypeStatsItem(
                    type=row.attack_type or "unknown",
                    success_rate=round(float(row.success_rate or 0), 3),
                )
                for row in attack_rows
            ],
        )

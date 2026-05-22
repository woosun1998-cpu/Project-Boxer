from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.session import RoundResult, TrainingSession
from app.models.user import User
from app.models.video import AttackVideo
from app.schemas.coaching import CoachingData
from app.services.gemini_service import GeminiService


class CoachingService:
    def __init__(self) -> None:
        self.gemini_service = GeminiService()

    async def get_coaching(self, db: AsyncSession, current_user: User) -> CoachingData:
        summary = (
            await db.execute(
                select(
                    func.coalesce(func.max(TrainingSession.max_combo), 0).label("max_combo"),
                    func.avg(RoundResult.reaction_ms).label("avg_reaction_ms"),
                    (
                        func.sum(case((RoundResult.result == "dodge", 1), else_=0))
                        / func.nullif(func.count(RoundResult.id), 0)
                    ).label("win_rate"),
                )
                .select_from(RoundResult)
                .join(TrainingSession, TrainingSession.id == RoundResult.session_id)
                .where(TrainingSession.user_id == current_user.id)
            )
        ).mappings().one()

        weak_attack_row = (
            await db.execute(
                select(
                    AttackVideo.attack_type,
                    func.sum(case((RoundResult.result == "hit", 1), else_=0)).label("hits"),
                )
                .select_from(RoundResult)
                .join(TrainingSession, TrainingSession.id == RoundResult.session_id)
                .join(AttackVideo, AttackVideo.id == RoundResult.video_id)
                .where(TrainingSession.user_id == current_user.id)
                .group_by(AttackVideo.attack_type)
                .order_by(func.sum(case((RoundResult.result == "hit", 1), else_=0)).desc())
                .limit(1)
            )
        ).mappings().one_or_none()

        payload = {
            "max_combo": int(summary["max_combo"] or 0),
            "avg_reaction_ms": float(summary["avg_reaction_ms"] or 0),
            "win_rate": float(summary["win_rate"] or 0),
            "weak_attack": (weak_attack_row["attack_type"] if weak_attack_row else "unknown") or "unknown",
        }
        result = await self.gemini_service.get_coaching(payload)
        return CoachingData(**result)

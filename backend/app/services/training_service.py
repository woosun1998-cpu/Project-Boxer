from __future__ import annotations

import logging
from statistics import mean

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from app.models.training_log import TrainingLog
from app.models.user import User
from app.schemas.training import (
    GeminiCoachingResponse,
    TrainingLogCreateRequest,
    TrainingLogRead,
    TrainingStatsData,
    TrainingStatsSummary,
    TrainingStatsTrend,
)
from app.services.gemini_service import GeminiService


logger = logging.getLogger(__name__)
class TrainingService:
    def __init__(self) -> None:
        self.gemini_service = GeminiService()

    async def save_training_log(
        self,
        db: AsyncSession,
        current_user: User,
        payload: TrainingLogCreateRequest,
    ) -> TrainingLog:
        if payload.session_uid:
            existing = await db.execute(
                select(TrainingLog).where(
                    TrainingLog.user_id == current_user.id,
                    TrainingLog.session_uid == payload.session_uid,
                )
            )
            row = existing.scalar_one_or_none()
            if row is not None:
                logger.info("training.log.duplicate_session user_id=%s session_uid=%s", current_user.id, payload.session_uid)
                return row

        row = TrainingLog(
            user_id=current_user.id,
            session_uid=payload.session_uid,
            session_mode=payload.session_mode,
            session_started_at=payload.session_started_at,
            session_ended_at=payload.session_ended_at,
            session_duration_sec=payload.session_duration_sec,
            avg_punch_speed=payload.avg_punch_speed,
            max_punch_speed=payload.max_punch_speed,
            punch_count_left=payload.punch_count_left,
            punch_count_right=payload.punch_count_right,
            total_punch_count=payload.total_punch_count,
            guard_success_rate=payload.guard_success_rate,
            guard_fail_count=payload.guard_fail_count,
            avg_reaction_ms=payload.avg_reaction_ms,
            best_reaction_ms=payload.best_reaction_ms,
            reaction_success_count=payload.reaction_success_count,
            reaction_miss_count=payload.reaction_miss_count,
            false_start_count=payload.false_start_count,
            avg_pivot_score=payload.avg_pivot_score,
            pivot_engagement_rate=payload.pivot_engagement_rate,
            device_fps_avg=payload.device_fps_avg,
            model_confidence_avg=payload.model_confidence_avg,
            stance=payload.stance,
            client_version=payload.client_version,
            raw_summary_json=payload.raw_summary_json,
            notes=payload.notes,
        )
        db.add(row)
        try:
            await db.flush()
        except IntegrityError:
            await db.rollback()
            existing = await db.execute(
                select(TrainingLog).where(
                    TrainingLog.user_id == current_user.id,
                    TrainingLog.session_uid == payload.session_uid,
                )
            )
            row = existing.scalar_one()
            logger.warning("training.log.integrity_recovered user_id=%s session_uid=%s", current_user.id, payload.session_uid)
        await db.refresh(row)
        return row

    async def get_training_stats(self, db: AsyncSession, current_user: User, limit: int = 8) -> TrainingStatsData:
        limit = max(1, min(50, limit))
        rows = (
            await db.execute(
                select(TrainingLog)
                .where(TrainingLog.user_id == current_user.id)
                .order_by(TrainingLog.session_ended_at.desc().nullslast(), TrainingLog.created_at.desc(), TrainingLog.id.desc())
                .limit(limit)
            )
        ).scalars().all()

        summary = self._build_summary(rows)
        trend = self._build_trend(rows)
        raw_summary_json = {
            "summary": summary.model_dump(),
            "trend": trend.model_dump(),
        }

        coaching = await self.gemini_service.generate_training_feedback(
            {
                "summary": summary.model_dump(),
                "trend": trend.model_dump(),
                "recent_sessions": [TrainingLogRead.model_validate(row).model_dump(mode="json") for row in rows],
            }
        )

        return TrainingStatsData(
            summary=summary,
            trend=trend,
            coaching_feedback=coaching.coaching_feedback,
            generated_by=coaching.generated_by,
            raw_summary_json=raw_summary_json,
            recent_sessions=[TrainingLogRead.model_validate(row) for row in rows],
        )

    def _build_summary(self, rows: list[TrainingLog]) -> TrainingStatsSummary:
        if not rows:
            return TrainingStatsSummary(
                session_count=0,
                avg_punch_speed=0.0,
                max_punch_speed=0.0,
                guard_success_rate=0.0,
                avg_reaction_ms=0.0,
                best_reaction_ms=0.0,
                avg_pivot_score=0.0,
                pivot_engagement_rate=0.0,
                total_punch_count=0,
                false_start_count=0,
                device_fps_avg=0.0,
                model_confidence_avg=0.0,
            )

        return TrainingStatsSummary(
            session_count=len(rows),
            avg_punch_speed=round(mean(row.avg_punch_speed for row in rows), 2),
            max_punch_speed=round(max(row.max_punch_speed for row in rows), 2),
            guard_success_rate=round(mean(row.guard_success_rate for row in rows), 1),
            avg_reaction_ms=round(self._mean_positive(row.avg_reaction_ms for row in rows), 1),
            best_reaction_ms=round(self._min_positive(row.best_reaction_ms for row in rows), 1),
            avg_pivot_score=round(mean(row.avg_pivot_score for row in rows), 2),
            pivot_engagement_rate=round(mean(row.pivot_engagement_rate for row in rows), 1),
            total_punch_count=sum(row.total_punch_count for row in rows),
            false_start_count=sum(row.false_start_count for row in rows),
            device_fps_avg=round(mean(row.device_fps_avg for row in rows), 2),
            model_confidence_avg=round(mean(row.model_confidence_avg for row in rows), 2),
        )

    def _build_trend(self, rows: list[TrainingLog]) -> TrainingStatsTrend:
        if len(rows) < 2:
            return TrainingStatsTrend(
                punch_speed_trend="flat",
                guard_trend="flat",
                reaction_trend="flat",
                pivot_trend="flat",
            )

        midpoint = max(1, len(rows) // 2)
        recent = rows[:midpoint]
        past = rows[midpoint:]
        if not past:
            past = rows[-1:]

        speed = self._trend_pair(recent, past, "avg_punch_speed")
        guard = self._trend_pair(recent, past, "guard_success_rate")
        reaction = self._trend_pair(recent, past, "avg_reaction_ms", lower_is_better=True)
        pivot = self._trend_pair(recent, past, "avg_pivot_score")

        return TrainingStatsTrend(
            punch_speed_trend=speed,
            guard_trend=guard,
            reaction_trend=reaction,
            pivot_trend=pivot,
        )

    def _trend_pair(
        self,
        recent: list[TrainingLog],
        past: list[TrainingLog],
        field: str,
        lower_is_better: bool = False,
    ) -> str:
        recent_avg = mean(getattr(row, field) for row in recent)
        past_avg = mean(getattr(row, field) for row in past)
        diff = recent_avg - past_avg
        if lower_is_better:
            diff = -diff
        if diff > 0.5:
            return "up" if not lower_is_better else "improving"
        if diff < -0.5:
            return "down" if not lower_is_better else "worsening"
        return "flat" if not lower_is_better else "flat"

    def _mean_positive(self, values: list[float] | tuple[float, ...] | Any) -> float:
        filtered = [float(value) for value in values if float(value) > 0]
        return mean(filtered) if filtered else 0.0

    def _min_positive(self, values: list[float] | tuple[float, ...] | Any) -> float:
        filtered = [float(value) for value in values if float(value) > 0]
        return min(filtered) if filtered else 0.0

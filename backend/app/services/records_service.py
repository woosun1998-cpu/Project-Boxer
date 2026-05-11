from collections import Counter

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.workout_log import WorkoutLog
from app.schemas.workout import WorkoutRecordCreate, WorkoutRecordData
from app.services.gemini_service import GeminiService


class RecordsService:
    def __init__(self) -> None:
        self.gemini_service = GeminiService()

    async def save_workout_records(
        self,
        db: AsyncSession,
        current_user: User,
        payload: WorkoutRecordCreate,
    ) -> WorkoutRecordData:
        saved_logs: list[WorkoutLog] = []
        totals: Counter[str] = Counter()

        for item in payload.logs:
            log = WorkoutLog(
                user_id=current_user.id,
                punch_type=item.punch_type,
                count=item.count,
            )
            db.add(log)
            saved_logs.append(log)
            totals[item.punch_type] += item.count

        await db.flush()

        total_punches = sum(totals.values())
        feedback = None
        if payload.generate_feedback:
            feedback = await self.gemini_service.generate_workout_feedback(
                {
                    "user_id": current_user.id,
                    "username": current_user.username,
                    "mode": payload.mode,
                    "duration_sec": payload.duration_sec,
                    "total_punches": total_punches,
                    "totals_by_type": dict(totals),
                    "notes": payload.notes or "",
                }
            )

        return WorkoutRecordData(
            mode=payload.mode,
            duration_sec=payload.duration_sec,
            total_punches=total_punches,
            totals_by_type=dict(totals),
            saved_logs=saved_logs,
            feedback=feedback,
        )

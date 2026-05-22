from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.workout import WorkoutRecordCreate, WorkoutRecordResponse
from app.services.records_service import RecordsService
from app.utils.dependencies import get_current_user


router = APIRouter()
records_service = RecordsService()


@router.post(
    "",
    response_model=WorkoutRecordResponse,
    summary="Save workout logs",
    description="Store sparring or tutorial punch logs for the current authenticated user.",
)
async def save_records(
    payload: WorkoutRecordCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WorkoutRecordResponse:
    data = await records_service.save_workout_records(db, current_user, payload)
    return WorkoutRecordResponse(
        success=True,
        message="Workout logs saved successfully.",
        data=data,
    )

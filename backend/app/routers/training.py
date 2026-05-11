from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import SQLAlchemyError

from app.database import get_db
from app.deps.auth import get_current_user
from app.models.user import User
from app.schemas.training import (
    TrainingLogCreateRequest,
    TrainingLogRead,
    TrainingLogResponse,
    TrainingStatsData,
    TrainingStatsResponse,
)
from app.services.training_service import TrainingService


logger = logging.getLogger(__name__)
router = APIRouter()
training_service = TrainingService()


@router.post(
    "/log",
    response_model=TrainingLogResponse,
    summary="Save a training summary",
    description="Persist one coaching session summary for the authenticated user.",
)
async def create_training_log(
    payload: TrainingLogCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TrainingLogResponse:
    try:
        row = await training_service.save_training_log(db, current_user, payload)
        logger.info(
            "training.log.saved user_id=%s session_uid=%s total_punch_count=%s",
            current_user.id,
            row.session_uid,
            row.total_punch_count,
        )
        return TrainingLogResponse(
            success=True,
            message="Training summary saved successfully.",
            data=TrainingLogRead.model_validate(row),
        )
    except SQLAlchemyError as exc:
        logger.exception("training.log.db_error user_id=%s", current_user.id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save training summary.",
        ) from exc


@router.get(
    "/stats",
    response_model=TrainingStatsResponse,
    summary="Get training stats and AI feedback",
    description="Aggregate the user's training logs and generate personalized coaching feedback.",
)
async def get_training_stats(
    limit: int = Query(default=8, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TrainingStatsResponse:
    try:
        stats: TrainingStatsData = await training_service.get_training_stats(db, current_user, limit=limit)
        return TrainingStatsResponse(
            success=True,
            message="Training stats generated successfully.",
            data=stats,
        )
    except SQLAlchemyError as exc:
        logger.exception("training.stats.db_error user_id=%s", current_user.id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate training stats.",
        ) from exc

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.leaderboard import (
    LeaderboardResponse,
    LeaderboardUpdateRequest,
    LeaderboardUpdateResponse,
)
from app.services.leaderboard_service import LeaderboardService
from app.utils.dependencies import get_current_user


router = APIRouter()
leaderboard_service = LeaderboardService()


@router.get(
    "",
    response_model=LeaderboardResponse,
    summary="Get leaderboard",
    description="Return top ranked Boxer users.",
)
async def list_leaderboard(
    limit: int = Query(default=100, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> LeaderboardResponse:
    items = await leaderboard_service.list_leaderboard(db, limit)
    return LeaderboardResponse(
        success=True,
        message="Leaderboard loaded successfully.",
        data=items,
    )


@router.put(
    "/me",
    response_model=LeaderboardUpdateResponse,
    summary="Update my leaderboard",
    description="Update the current user's leaderboard entry and rank tier.",
)
async def update_my_leaderboard(
    payload: LeaderboardUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LeaderboardUpdateResponse:
    item = await leaderboard_service.update_me(db, current_user, payload)
    return LeaderboardUpdateResponse(
        success=True,
        message="Leaderboard updated successfully.",
        data=item,
    )

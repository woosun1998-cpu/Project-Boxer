from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.stats import StatsResponse
from app.services.stats_service import StatsService
from app.utils.dependencies import get_current_user


router = APIRouter()
stats_service = StatsService()


@router.get(
    "/me",
    response_model=StatsResponse,
    summary="Get my stats",
    description="Return summary stats for the authenticated user.",
)
async def get_my_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StatsResponse:
    stats = await stats_service.get_my_stats(db, current_user)
    return StatsResponse(
        success=True,
        message="Stats loaded successfully.",
        data=stats,
    )

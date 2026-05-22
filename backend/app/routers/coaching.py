from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.coaching import CoachingResponse
from app.services.coaching_service import CoachingService
from app.utils.dependencies import get_current_user


router = APIRouter()
coaching_service = CoachingService()


@router.post(
    "",
    response_model=CoachingResponse,
    summary="Get AI coaching",
    description="Generate personalized coaching advice for the authenticated user.",
)
async def get_coaching(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CoachingResponse:
    coaching = await coaching_service.get_coaching(db, current_user)
    return CoachingResponse(
        success=True,
        message="Coaching advice generated successfully.",
        data=coaching,
    )

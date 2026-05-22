from fastapi import APIRouter, Depends

from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.auth import UserProfileResponse, UserUpdateRequest
from app.schemas.tutorial import UserProgressResponse
from app.services.tutorial_service import TutorialService
from app.services.user_service import UserService
from app.utils.dependencies import get_current_user


router = APIRouter()
user_service = UserService()
tutorial_service = TutorialService()


@router.get(
    "/me",
    response_model=UserProfileResponse,
    summary="Get current user",
    description="Return the profile of the authenticated user from the JWT token.",
)
async def get_me(
    current_user: User = Depends(get_current_user),
) -> UserProfileResponse:
    profile = await user_service.get_me(current_user)
    return UserProfileResponse(
        success=True,
        message="Current user loaded successfully.",
        data=profile,
    )


@router.put(
    "/me",
    response_model=UserProfileResponse,
    summary="Update current user",
    description="Update the authenticated user's basic profile fields.",
)
async def update_me(
    payload: UserUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserProfileResponse:
    try:
        profile = await user_service.update_me(db, current_user, payload)
    except ValueError as exc:
        from fastapi import HTTPException, status

        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    return UserProfileResponse(
        success=True,
        message="Current user updated successfully.",
        data=profile,
    )


@router.get(
    "/me/progress",
    response_model=UserProgressResponse,
    summary="Get tutorial progress",
    description="Return tutorial progress records for the authenticated user.",
)
async def get_my_progress(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserProgressResponse:
    progress = await tutorial_service.get_user_progress(db, current_user)
    return UserProgressResponse(
        success=True,
        message="User progress loaded successfully.",
        data=progress,
    )

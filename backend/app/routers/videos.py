from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.video import VideoDetailResponse, VideoListResponse
from app.services.session_service import SessionService
from app.utils.dependencies import get_current_user


router = APIRouter()
session_service = SessionService()


@router.get(
    "",
    response_model=VideoListResponse,
    summary="List attack videos",
    description="Return sparring videos available to the authenticated user.",
)
async def list_videos(
    difficulty: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> VideoListResponse:
    videos = await session_service.list_videos(db, current_user)
    if difficulty:
        normalized_difficulty = difficulty.strip().lower()
        videos = [video for video in videos if video.difficulty == normalized_difficulty]
    return VideoListResponse(
        success=True,
        message="Video list loaded successfully.",
        data=videos,
    )


@router.get(
    "/{video_id}",
    response_model=VideoDetailResponse,
    summary="Get attack video detail",
    description="Return a single attack video with its timestamps.",
)
async def get_video(
    video_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> VideoDetailResponse:
    try:
        video = await session_service.get_video(db, video_id, current_user)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc

    return VideoDetailResponse(
        success=True,
        message="Video detail loaded successfully.",
        data=video,
    )

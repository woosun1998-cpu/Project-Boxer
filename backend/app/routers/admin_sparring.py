from __future__ import annotations

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.user import User
from app.models.video import AttackTimestamp, AttackVideo
from app.schemas.admin_timestamp import (
    AdminSparringVideoCreate,
    AdminSparringVideoListResponse,
    AdminSparringVideoResponse,
    AdminSparringVideoUpdate,
)
from app.utils.dependencies import get_current_user


router = APIRouter(prefix="/sparring", tags=["admin-sparring"])


def require_admin_user(current_user: User = Depends(get_current_user)) -> User:
    if current_user.tier != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access is required.")
    return current_user


async def _video_or_404(db: AsyncSession, video_id: int) -> AttackVideo:
    video = await db.get(AttackVideo, video_id)
    if video is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sparring video not found.")
    return video


async def _video_response(db: AsyncSession, video: AttackVideo) -> AdminSparringVideoResponse:
    count = await db.scalar(select(func.count(AttackTimestamp.id)).where(AttackTimestamp.video_id == video.id))
    return AdminSparringVideoResponse(
        id=video.id,
        title=video.title,
        video_url=video.file_path,
        difficulty=video.difficulty,
        is_active=bool(getattr(video, "is_active", True)),
        timestamp_count=int(count or 0),
        created_at=video.created_at,
    )


@router.get("/videos", response_model=AdminSparringVideoListResponse)
async def list_sparring_videos(
    difficulty: str | None = None,
    active: bool | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_user),
) -> AdminSparringVideoListResponse:
    _ = current_user
    statement = select(AttackVideo)
    if difficulty:
        statement = statement.where(AttackVideo.difficulty == difficulty)
    if active is not None and hasattr(AttackVideo, "is_active"):
        statement = statement.where(AttackVideo.is_active.is_(active))
    statement = statement.order_by(AttackVideo.created_at.desc(), AttackVideo.id.desc())
    result = await db.execute(statement)
    videos = list(result.scalars().all())
    items = [await _video_response(db, video) for video in videos]
    return AdminSparringVideoListResponse(items=items, count=len(items))


@router.post("/videos", response_model=AdminSparringVideoResponse, status_code=status.HTTP_201_CREATED)
async def create_sparring_video(
    payload: AdminSparringVideoCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_user),
) -> AdminSparringVideoResponse:
    _ = current_user
    video = AttackVideo(
        title=payload.title.strip(),
        file_path=payload.video_url.strip(),
        attack_type="mixed",
        difficulty=payload.difficulty,
        duration_sec=Decimal("5.00"),
        is_premium=False,
        is_active=payload.is_active,
    )
    db.add(video)
    await db.flush()
    await db.refresh(video)
    return await _video_response(db, video)


@router.put("/videos/{video_id}", response_model=AdminSparringVideoResponse)
async def update_sparring_video(
    video_id: int,
    payload: AdminSparringVideoUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_user),
) -> AdminSparringVideoResponse:
    _ = current_user
    video = await _video_or_404(db, video_id)
    data = payload.model_dump(exclude_unset=True)
    if "title" in data and data["title"] is not None:
        video.title = data["title"].strip()
    if "video_url" in data and data["video_url"] is not None:
        video.file_path = data["video_url"].strip()
    if "difficulty" in data and data["difficulty"] is not None:
        video.difficulty = data["difficulty"]
    if "is_active" in data and data["is_active"] is not None and hasattr(video, "is_active"):
        video.is_active = data["is_active"]
    await db.flush()
    await db.refresh(video)
    return await _video_response(db, video)


@router.patch("/videos/{video_id}/active", response_model=AdminSparringVideoResponse)
async def toggle_sparring_video_active(
    video_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_user),
) -> AdminSparringVideoResponse:
    _ = current_user
    video = await _video_or_404(db, video_id)
    if hasattr(video, "is_active"):
        video.is_active = not bool(video.is_active)
    await db.flush()
    await db.refresh(video)
    return await _video_response(db, video)


@router.delete("/videos/{video_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sparring_video(
    video_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_user),
) -> Response:
    _ = current_user
    query = select(AttackVideo).options(selectinload(AttackVideo.timestamps)).where(AttackVideo.id == video_id)
    video = (await db.execute(query)).scalar_one_or_none()
    if video is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sparring video not found.")
    await db.delete(video)
    await db.flush()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.user import User
from app.models.video import AttackTimestamp, AttackVideo
from app.schemas.admin_videos import AdminVideoCreateRequest, AdminVideoCreateResponse
from app.utils.dependencies import get_current_user


router = APIRouter()


def _ensure_admin_access(_: User) -> None:
    # Project currently has no role/permission model.
    # Keep it gated behind authentication for now.
    return


@router.post(
    "/videos",
    response_model=AdminVideoCreateResponse,
    summary="Create attack video (admin)",
)
async def create_admin_video(
    payload: AdminVideoCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AdminVideoCreateResponse:
    _ensure_admin_access(current_user)

    video = AttackVideo(
        title=payload.title,
        file_path=payload.file_path,
        attack_type=payload.attack_type,
        difficulty=payload.difficulty,
        duration_sec=payload.duration_sec,
        thumbnail_url=payload.thumbnail_url,
        is_premium=payload.is_premium,
    )
    db.add(video)
    await db.flush()

    for ts in payload.timestamps:
        db.add(
            AttackTimestamp(
                video_id=video.id,
                impact_time=ts.impact_time,
                dodge_window_ms=ts.dodge_window_ms,
                hitbox_radius=ts.hitbox_radius,
                attack_type=ts.attack_type,
                judge_shape=ts.judge_shape,
                target_zone=ts.target_zone,
                required_move=ts.required_move,
                min_displacement=ts.min_displacement,
            )
        )

    await db.flush()
    await db.refresh(video)

    return AdminVideoCreateResponse(
        success=True,
        message="Video created successfully.",
        data={"id": video.id},
    )


@router.delete(
    "/videos/{video_id}",
    response_model=AdminVideoCreateResponse,
    summary="Delete attack video (admin)",
)
async def delete_admin_video(
    video_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AdminVideoCreateResponse:
    _ensure_admin_access(current_user)

    video = (await db.execute(select(AttackVideo).where(AttackVideo.id == video_id))).scalar_one_or_none()
    if video is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video not found.")

    await db.delete(video)
    return AdminVideoCreateResponse(
        success=True,
        message="Video deleted successfully.",
        data={"id": video_id},
    )


@router.put(
    "/videos/{video_id}",
    response_model=AdminVideoCreateResponse,
    summary="Update attack video (admin)",
)
async def update_admin_video(
    video_id: int,
    payload: AdminVideoCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AdminVideoCreateResponse:
    _ensure_admin_access(current_user)

    query = (
        select(AttackVideo)
        .options(selectinload(AttackVideo.timestamps))
        .where(AttackVideo.id == video_id)
    )
    video = (await db.execute(query)).scalar_one_or_none()
    if video is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video not found.")

    video.title = payload.title
    video.file_path = payload.file_path
    video.attack_type = payload.attack_type
    video.difficulty = payload.difficulty
    video.duration_sec = payload.duration_sec
    video.thumbnail_url = payload.thumbnail_url
    video.is_premium = payload.is_premium

    for ts in list(video.timestamps):
        await db.delete(ts)
    video.timestamps = []
    await db.flush()

    for ts in payload.timestamps:
        db.add(
            AttackTimestamp(
                video_id=video.id,
                impact_time=ts.impact_time,
                dodge_window_ms=ts.dodge_window_ms,
                hitbox_radius=ts.hitbox_radius,
                attack_type=ts.attack_type,
                judge_shape=ts.judge_shape,
                target_zone=ts.target_zone,
                required_move=ts.required_move,
                min_displacement=ts.min_displacement,
            )
        )

    await db.flush()
    await db.refresh(video)

    return AdminVideoCreateResponse(
        success=True,
        message="Video updated successfully.",
        data={"id": video.id},
    )

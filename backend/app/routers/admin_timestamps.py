from __future__ import annotations

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.video import AttackTimestamp, AttackVideo
from app.schemas.admin_timestamp import (
    TimestampMarkerCreate,
    TimestampMarkerListResponse,
    TimestampMarkerResponse,
    TimestampMarkerUpdate,
    TimestampPresetResponse,
)
from app.utils.dependencies import get_current_user


router = APIRouter(tags=["admin-timestamps"])

DIFFICULTY_PRESETS: dict[str, dict[str, float | int]] = {
    "easy": {"dodge_window_ms": 650, "hitbox_radius": 0.22},
    "medium": {"dodge_window_ms": 450, "hitbox_radius": 0.18},
    "hard": {"dodge_window_ms": 300, "hitbox_radius": 0.15},
    "beginner": {"dodge_window_ms": 650, "hitbox_radius": 0.22},
    "intermediate": {"dodge_window_ms": 450, "hitbox_radius": 0.18},
    "advanced": {"dodge_window_ms": 300, "hitbox_radius": 0.15},
    "pro": {"dodge_window_ms": 200, "hitbox_radius": 0.12},
}


def require_admin_user(current_user: User = Depends(get_current_user)) -> User:
    if current_user.tier != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access is required.")
    return current_user


async def _video_or_404(db: AsyncSession, video_id: int) -> AttackVideo:
    video = await db.get(AttackVideo, video_id)
    if video is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sparring video not found.")
    return video


async def _marker_or_404(db: AsyncSession, marker_id: int) -> AttackTimestamp:
    marker = await db.get(AttackTimestamp, marker_id)
    if marker is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Timestamp marker not found.")
    return marker


def _marker_response(marker: AttackTimestamp) -> TimestampMarkerResponse:
    return TimestampMarkerResponse(
        id=marker.id,
        video_id=marker.video_id,
        impact_time=float(marker.impact_time),
        attack_type=marker.attack_type or "jab",
        required_move=marker.required_move or "auto",
        target_zone=marker.target_zone or "head",
        dodge_window_ms=int(marker.dodge_window_ms),
        hitbox_radius=float(marker.hitbox_radius),
        impact_delay_ms=int(getattr(marker, "impact_delay_ms", 0) or 0),
        created_at=getattr(marker, "created_at", None),
    )


@router.get("/videos/{video_id}/timestamps", response_model=TimestampMarkerListResponse)
async def list_video_timestamps(
    video_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_user),
) -> TimestampMarkerListResponse:
    _ = current_user
    await _video_or_404(db, video_id)
    result = await db.execute(
        select(AttackTimestamp)
        .where(AttackTimestamp.video_id == video_id)
        .order_by(AttackTimestamp.impact_time.asc(), AttackTimestamp.id.asc())
    )
    items = [_marker_response(marker) for marker in result.scalars().all()]
    return TimestampMarkerListResponse(items=items, count=len(items))


@router.post("/videos/{video_id}/timestamps", response_model=TimestampMarkerResponse, status_code=status.HTTP_201_CREATED)
async def create_video_timestamp(
    video_id: int,
    payload: TimestampMarkerCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_user),
) -> TimestampMarkerResponse:
    _ = current_user
    await _video_or_404(db, video_id)
    marker = AttackTimestamp(
        video_id=video_id,
        impact_time=Decimal(str(payload.impact_time)),
        attack_type="straight" if payload.attack_type == "cross" else payload.attack_type,
        required_move=payload.required_move,
        target_zone=payload.target_zone,
        dodge_window_ms=payload.dodge_window_ms,
        hitbox_radius=Decimal(str(payload.hitbox_radius)),
        judge_shape="circle",
    )
    if hasattr(marker, "impact_delay_ms"):
        marker.impact_delay_ms = payload.impact_delay_ms
    db.add(marker)
    await db.flush()
    await db.refresh(marker)
    return _marker_response(marker)


@router.get("/timestamps/presets/{difficulty}", response_model=TimestampPresetResponse)
async def read_timestamp_preset(
    difficulty: str,
    current_user: User = Depends(require_admin_user),
) -> TimestampPresetResponse:
    _ = current_user
    preset = DIFFICULTY_PRESETS.get(difficulty)
    if preset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Difficulty preset not found.")
    return TimestampPresetResponse(difficulty=difficulty, **preset)


@router.put("/timestamps/{marker_id}", response_model=TimestampMarkerResponse)
async def update_timestamp_marker(
    marker_id: int,
    payload: TimestampMarkerUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_user),
) -> TimestampMarkerResponse:
    _ = current_user
    marker = await _marker_or_404(db, marker_id)
    data = payload.model_dump(exclude_unset=True)
    if "impact_time" in data and data["impact_time"] is not None:
        marker.impact_time = Decimal(str(data["impact_time"]))
    if "attack_type" in data and data["attack_type"] is not None:
        marker.attack_type = "straight" if data["attack_type"] == "cross" else data["attack_type"]
    if "required_move" in data and data["required_move"] is not None:
        marker.required_move = data["required_move"]
    if "target_zone" in data and data["target_zone"] is not None:
        marker.target_zone = data["target_zone"]
    if "dodge_window_ms" in data and data["dodge_window_ms"] is not None:
        marker.dodge_window_ms = data["dodge_window_ms"]
    if "hitbox_radius" in data and data["hitbox_radius"] is not None:
        marker.hitbox_radius = Decimal(str(data["hitbox_radius"]))
    if "impact_delay_ms" in data and data["impact_delay_ms"] is not None and hasattr(marker, "impact_delay_ms"):
        marker.impact_delay_ms = data["impact_delay_ms"]
    await db.flush()
    await db.refresh(marker)
    return _marker_response(marker)


@router.delete("/timestamps/{marker_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_timestamp_marker(
    marker_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_user),
) -> Response:
    _ = current_user
    marker = await _marker_or_404(db, marker_id)
    await db.delete(marker)
    await db.flush()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
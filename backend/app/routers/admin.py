from __future__ import annotations

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.session import TrainingSession
from app.models.tutorial import BoxingTutorial, UserProgress
from app.models.user import User
from app.utils.dependencies import get_current_user


router = APIRouter()


class AdminTutorialPayload(BaseModel):
    lesson_key: str | None = Field(default=None, max_length=100)
    title: str = Field(min_length=1, max_length=100)
    subtitle: str | None = Field(default=None, max_length=255)
    category: str = Field(default="basic", max_length=50)
    difficulty: str = Field(default="beginner", max_length=30)
    description: str | None = None
    coach_tip: str | None = None
    video_url: str | None = Field(default=None, max_length=255)
    guide_mp3_url: str | None = Field(default=None, max_length=255)
    thumbnail_url: str | None = Field(default=None, max_length=255)
    silhouette_url: str | None = Field(default=None, max_length=255)
    target_pose_json: dict | list | None = None
    order_sequence: int | None = Field(default=None, ge=0)
    is_premium: bool = False
    is_active: bool = True
    reward_exp: int = Field(default=100, ge=0, le=100000)
    reward_coins: int = Field(default=10, ge=0, le=100000)


class AdminUserTierPayload(BaseModel):
    tier: str = Field(pattern="^(free|premium|admin)$")


class AdminUserActivePayload(BaseModel):
    is_active: bool


DIFFICULTY_LEVELS = {"beginner": 1, "intermediate": 2, "advanced": 3, "pro": 4}


def _ensure_admin_access(current_user: User) -> None:
    if current_user.tier != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access is required.",
        )


def _tutorial_item(row: BoxingTutorial) -> dict:
    difficulty = row.difficulty or {1: "beginner", 2: "intermediate", 3: "advanced", 4: "pro"}.get(row.difficulty_level, "beginner")
    lesson_key = row.lesson_key or f"tutorial-{row.id}"
    return {
        "id": row.id,
        "lesson_key": lesson_key,
        "title": row.title,
        "subtitle": row.subtitle,
        "category": row.category or "basic",
        "difficulty": difficulty,
        "difficulty_level": row.difficulty_level,
        "description": row.description,
        "coach_tip": row.coach_tip,
        "video_url": row.video_url,
        "guide_mp3_url": row.guide_mp3_url,
        "thumbnail_url": row.thumbnail_url,
        "silhouette_url": row.silhouette_url,
        "target_pose_json": row.target_pose_json,
        "order_sequence": row.order_sequence,
        "is_premium": bool(row.is_premium),
        "is_active": bool(row.is_active),
        "reward_exp": row.reward_exp,
        "reward_coins": row.reward_coins,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def _apply_tutorial_payload(row: BoxingTutorial, payload: AdminTutorialPayload) -> None:
    row.lesson_key = payload.lesson_key or None
    row.title = payload.title
    row.subtitle = payload.subtitle or None
    row.category = payload.category or "basic"
    row.difficulty = payload.difficulty or "beginner"
    row.difficulty_level = DIFFICULTY_LEVELS.get(row.difficulty, 1)
    row.description = payload.description or None
    row.coach_tip = payload.coach_tip or None
    row.video_url = payload.video_url or None
    row.guide_mp3_url = payload.guide_mp3_url or None
    row.thumbnail_url = payload.thumbnail_url or None
    row.silhouette_url = payload.silhouette_url or None
    row.target_pose_json = payload.target_pose_json
    row.order_sequence = int(payload.order_sequence or row.order_sequence or 0)
    row.is_premium = bool(payload.is_premium)
    row.is_active = bool(payload.is_active)
    row.reward_exp = payload.reward_exp
    row.reward_coins = payload.reward_coins
    row.updated_at = datetime.utcnow()


def _user_item(row: User, training_count: int = 0, sparring_count: int = 0) -> dict:
    return {
        "id": row.id,
        "username": row.username,
        "email": row.email,
        "tier": row.tier,
        "role": row.role,
        "is_admin": row.is_admin,
        "coins": row.coins,
        "level": getattr(row, "level", 1),
        "skill_level": row.skill_level,
        "is_active": bool(getattr(row, "is_active", True)),
        "last_login_at": row.last_login_at.isoformat() if getattr(row, "last_login_at", None) else None,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "recent_training_count": training_count,
        "recent_sparring_count": sparring_count,
    }


async def _user_metrics(db: AsyncSession) -> dict:
    total = int(await db.scalar(select(func.count(User.id))) or 0)
    active = int(await db.scalar(select(func.count(User.id)).where(User.is_active.is_(True))) or 0)
    premium = int(await db.scalar(select(func.count(User.id)).where(User.tier == "premium")) or 0)
    admin = int(await db.scalar(select(func.count(User.id)).where(User.tier == "admin")) or 0)
    return {
        "total_users": total,
        "active_users": active,
        "suspended_users": max(total - active, 0),
        "premium_users": premium,
        "admin_users": admin,
    }


@router.get("/tutorials", summary="List tutorials for admin")
async def list_tutorials(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _ensure_admin_access(current_user)
    rows = (await db.execute(select(BoxingTutorial).order_by(BoxingTutorial.order_sequence.asc(), BoxingTutorial.id.asc()))).scalars().all()
    items = [_tutorial_item(row) for row in rows]
    return {"items": items, "tutorials": items, "success": True, "data": {"items": items}}


@router.post("/tutorials", summary="Create tutorial (admin)")
async def create_tutorial(
    payload: AdminTutorialPayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _ensure_admin_access(current_user)
    next_order = payload.order_sequence
    if next_order is None:
        max_order = await db.scalar(select(func.max(BoxingTutorial.order_sequence)))
        next_order = int(max_order or 0) + 1
    tutorial = BoxingTutorial(title=payload.title, order_sequence=next_order)
    _apply_tutorial_payload(tutorial, payload)
    tutorial.order_sequence = int(next_order)
    db.add(tutorial)
    await db.flush()
    await db.refresh(tutorial)
    return {"success": True, "message": "Tutorial created successfully.", "item": _tutorial_item(tutorial), "data": {"id": tutorial.id}}


@router.put("/tutorials/{tutorial_id}", summary="Update tutorial (admin)")
async def update_tutorial(
    tutorial_id: int,
    payload: AdminTutorialPayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _ensure_admin_access(current_user)
    tutorial = await db.get(BoxingTutorial, tutorial_id)
    if tutorial is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tutorial not found.")
    _apply_tutorial_payload(tutorial, payload)
    await db.flush()
    await db.refresh(tutorial)
    return {"success": True, "message": "Tutorial updated successfully.", "item": _tutorial_item(tutorial)}


@router.patch("/tutorials/{tutorial_id}/toggle", summary="Toggle tutorial active state")
async def toggle_tutorial(
    tutorial_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _ensure_admin_access(current_user)
    tutorial = await db.get(BoxingTutorial, tutorial_id)
    if tutorial is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tutorial not found.")
    tutorial.is_active = not bool(tutorial.is_active)
    tutorial.updated_at = datetime.utcnow()
    await db.flush()
    await db.refresh(tutorial)
    return {"success": True, "item": _tutorial_item(tutorial)}


@router.delete("/tutorials/{tutorial_id}", summary="Delete tutorial (admin)")
async def delete_tutorial(
    tutorial_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _ensure_admin_access(current_user)
    tutorial = await db.get(BoxingTutorial, tutorial_id)
    if tutorial is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tutorial not found.")
    await db.delete(tutorial)
    await db.flush()
    return {"success": True, "message": "Tutorial deleted successfully.", "data": {"id": tutorial_id}}


@router.get("/users", summary="List users for admin")
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _ensure_admin_access(current_user)
    rows = (await db.execute(select(User).order_by(User.id.asc()))).scalars().all()
    since = datetime.utcnow() - timedelta(days=30)
    items = []
    for row in rows:
        training_count = int(await db.scalar(select(func.count(TrainingSession.id)).where(TrainingSession.user_id == row.id, TrainingSession.session_type == "tutorial", TrainingSession.started_at >= since)) or 0)
        sparring_count = int(await db.scalar(select(func.count(TrainingSession.id)).where(TrainingSession.user_id == row.id, TrainingSession.session_type == "sparring", TrainingSession.started_at >= since)) or 0)
        items.append(_user_item(row, training_count, sparring_count))
    metrics = await _user_metrics(db)
    return {"items": items, "users": items, "metrics": metrics, "success": True, "data": {"items": items}}


@router.get("/users/{user_id}", summary="Read user detail for admin")
async def get_user_detail(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _ensure_admin_access(current_user)
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    training_count = int(await db.scalar(select(func.count(TrainingSession.id)).where(TrainingSession.user_id == user.id, TrainingSession.session_type == "tutorial")) or 0)
    sparring_count = int(await db.scalar(select(func.count(TrainingSession.id)).where(TrainingSession.user_id == user.id, TrainingSession.session_type == "sparring")) or 0)
    return _user_item(user, training_count, sparring_count)


@router.put("/users/{user_id}/tier", summary="Update user tier (admin)")
@router.patch("/users/{user_id}/tier", summary="Update user tier (admin)")
async def update_user_tier(
    user_id: int,
    payload: AdminUserTierPayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _ensure_admin_access(current_user)
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    user.tier = payload.tier
    await db.flush()
    await db.refresh(user)
    return {"success": True, "message": "User tier updated successfully.", "item": _user_item(user), "data": {"id": user_id, "tier": user.tier}}


@router.patch("/users/{user_id}/active", summary="Update user active state")
async def update_user_active(
    user_id: int,
    payload: AdminUserActivePayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _ensure_admin_access(current_user)
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    user.is_active = payload.is_active
    await db.flush()
    await db.refresh(user)
    return {"success": True, "item": _user_item(user)}


@router.delete("/users/{user_id}", summary="Delete user (admin)")
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _ensure_admin_access(current_user)
    if user_id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot delete the signed-in admin account.")
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    await db.delete(user)
    await db.flush()
    return {"success": True, "message": "User deleted successfully.", "data": {"id": user_id}}

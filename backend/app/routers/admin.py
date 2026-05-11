from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import APIRouter, Depends, HTTPException, status

from app.database import get_db
from app.models.tutorial import BoxingTutorial
from app.models.user import User
from app.schemas.admin import (
    AdminTutorialCreateRequest,
    AdminTutorialResponse,
    AdminUserResponse,
    AdminUserTierUpdateRequest,
)
from app.utils.dependencies import get_current_user


router = APIRouter()


def _ensure_admin_access(_: User) -> None:
    # 현재 프로젝트는 역할(Role) 테이블이 없어서 로그인된 사용자만 허용합니다.
    return


@router.post(
    "/tutorials",
    response_model=AdminTutorialResponse,
    summary="Create tutorial (admin)",
)
async def create_tutorial(
    payload: AdminTutorialCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AdminTutorialResponse:
    _ensure_admin_access(current_user)

    next_order = payload.order_sequence
    if next_order is None:
        max_order = await db.scalar(select(func.max(BoxingTutorial.order_sequence)))
        next_order = int(max_order or 0) + 1

    tutorial = BoxingTutorial(
        title=payload.title,
        description=payload.description,
        difficulty_level=payload.difficulty_level,
        is_premium=payload.is_premium,
        reward_exp=payload.reward_exp,
        reward_coins=payload.reward_coins,
        video_url=payload.video_url,
        target_pose_json=payload.target_pose_json,
        order_sequence=next_order,
    )
    db.add(tutorial)
    await db.flush()
    await db.refresh(tutorial)

    return AdminTutorialResponse(
        success=True,
        message="Tutorial created successfully.",
        data={"id": tutorial.id},
    )


@router.delete(
    "/tutorials/{tutorial_id}",
    response_model=AdminTutorialResponse,
    summary="Delete tutorial (admin)",
)
async def delete_tutorial(
    tutorial_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AdminTutorialResponse:
    _ensure_admin_access(current_user)

    tutorial = await db.get(BoxingTutorial, tutorial_id)
    if tutorial is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tutorial not found.")

    await db.delete(tutorial)
    await db.flush()

    return AdminTutorialResponse(
        success=True,
        message="Tutorial deleted successfully.",
        data={"id": tutorial_id},
    )


@router.get(
    "/users",
    response_model=AdminUserResponse,
    summary="List users for admin",
)
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AdminUserResponse:
    _ensure_admin_access(current_user)

    rows = (await db.execute(select(User).order_by(User.id.asc()))).scalars().all()
    data = [
        {
            "id": row.id,
            "username": row.username,
            "email": row.email,
            "tier": row.tier,
            "coins": row.coins,
        }
        for row in rows
    ]
    return AdminUserResponse(success=True, message="Users loaded successfully.", data={"items": data})


@router.put(
    "/users/{user_id}/tier",
    response_model=AdminUserResponse,
    summary="Update user tier (admin)",
)
async def update_user_tier(
    user_id: int,
    payload: AdminUserTierUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AdminUserResponse:
    _ensure_admin_access(current_user)

    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    user.tier = payload.tier
    await db.flush()

    return AdminUserResponse(
        success=True,
        message="User tier updated successfully.",
        data={"id": user_id, "tier": user.tier},
    )

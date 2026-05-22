from __future__ import annotations

from pydantic import BaseModel, Field


class AdminTutorialCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    description: str | None = None
    difficulty_level: int = Field(default=1, ge=1, le=3)
    is_premium: bool = False
    reward_exp: int = Field(default=100, ge=0, le=100000)
    reward_coins: int = Field(default=10, ge=0, le=100000)
    video_url: str | None = Field(default=None, max_length=255)
    target_pose_json: dict | list | None = None
    order_sequence: int | None = Field(default=None, ge=0)


class AdminTutorialResponse(BaseModel):
    success: bool
    message: str
    data: dict


class AdminUserTierUpdateRequest(BaseModel):
    tier: str = Field(pattern="^(free|premium|admin)$")


class AdminUserResponse(BaseModel):
    success: bool
    message: str
    data: dict

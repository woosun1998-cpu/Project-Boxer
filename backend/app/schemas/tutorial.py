from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class TutorialListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str | None
    video_url: str | None
    thumbnail_url: str | None
    difficulty_level: int
    is_premium: bool
    reward_exp: int
    reward_coins: int
    order_sequence: int


class TutorialDetailResponse(BaseModel):
    success: bool
    message: str
    data: TutorialDetail


class TutorialDetail(TutorialListItem):
    target_pose_json: dict | list | None = None


class TutorialListResponse(BaseModel):
    success: bool
    message: str
    data: list[TutorialListItem]


class TutorialCompleteRequest(BaseModel):
    accuracy: float = Field(ge=0, le=100)
    attempts: int = Field(ge=1, le=10000)


class TutorialCompleteData(BaseModel):
    tutorial_id: int
    is_completed: bool
    best_accuracy: float | None
    attempts: int
    exp_earned: int
    coins_earned: int


class TutorialCompleteResponse(BaseModel):
    success: bool
    message: str
    data: TutorialCompleteData


class UserProgressItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    tutorial_id: int
    is_completed: bool
    best_accuracy: float | None
    attempts: int
    completed_at: datetime | None


class UserProgressResponse(BaseModel):
    success: bool
    message: str
    data: list[UserProgressItem]

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


Difficulty = Literal["easy", "medium", "hard", "beginner", "intermediate", "advanced", "pro"]
AttackType = Literal["jab", "straight", "cross", "hook", "uppercut", "mixed"]
RequiredMove = Literal["slip_left", "slip_right", "slip_side", "duck", "lean_back", "step_out", "auto"]
TargetZone = Literal["head", "left_head", "right_head", "body"]


class AdminSparringVideoCreate(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    video_url: str = Field(min_length=1, max_length=255)
    difficulty: Difficulty = "beginner"
    is_active: bool = True


class AdminSparringVideoUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=100)
    video_url: str | None = Field(default=None, min_length=1, max_length=255)
    difficulty: Difficulty | None = None
    is_active: bool | None = None


class AdminSparringVideoResponse(BaseModel):
    id: int
    title: str
    video_url: str
    difficulty: str
    is_active: bool = True
    timestamp_count: int = 0
    created_at: datetime | None = None


class AdminSparringVideoListResponse(BaseModel):
    items: list[AdminSparringVideoResponse]
    count: int


class TimestampMarkerCreate(BaseModel):
    impact_time: float = Field(ge=0)
    attack_type: AttackType = "jab"
    required_move: RequiredMove = "auto"
    target_zone: TargetZone = "head"
    dodge_window_ms: int = Field(default=650, ge=1)
    hitbox_radius: float = Field(default=0.22, ge=0)
    impact_delay_ms: int = 0


class TimestampMarkerUpdate(BaseModel):
    impact_time: float | None = Field(default=None, ge=0)
    attack_type: AttackType | None = None
    required_move: RequiredMove | None = None
    target_zone: TargetZone | None = None
    dodge_window_ms: int | None = Field(default=None, ge=1)
    hitbox_radius: float | None = Field(default=None, ge=0)
    impact_delay_ms: int | None = None


class TimestampMarkerResponse(BaseModel):
    id: int
    video_id: int
    impact_time: float
    attack_type: str = "jab"
    required_move: str = "auto"
    target_zone: str = "head"
    dodge_window_ms: int
    hitbox_radius: float
    impact_delay_ms: int = 0
    created_at: datetime | None = None


class TimestampMarkerListResponse(BaseModel):
    items: list[TimestampMarkerResponse]
    count: int


class TimestampPresetResponse(BaseModel):
    difficulty: str
    dodge_window_ms: int
    hitbox_radius: float
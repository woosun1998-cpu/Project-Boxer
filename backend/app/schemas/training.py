from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationInfo, field_validator, model_validator


def _normalize_text(value: str | None, max_length: int = 500) -> str | None:
    if value is None:
        return None
    trimmed = value.strip()
    if not trimmed:
        return None
    return trimmed[:max_length]


class TrainingLogCreateRequest(BaseModel):
    session_uid: str | None = Field(default=None, max_length=64)
    session_mode: Literal["coach", "tutorial", "sparring"] = "coach"
    session_started_at: datetime
    session_ended_at: datetime
    session_duration_sec: int = Field(default=60, ge=0, le=86_400)
    avg_punch_speed: float = Field(default=0.0, ge=0)
    max_punch_speed: float = Field(default=0.0, ge=0)
    punch_count_left: int = Field(default=0, ge=0)
    punch_count_right: int = Field(default=0, ge=0)
    total_punch_count: int = Field(default=0, ge=0)
    guard_success_rate: float = Field(default=0.0, ge=0, le=100)
    guard_fail_count: int = Field(default=0, ge=0)
    avg_reaction_ms: float = Field(default=0.0, ge=0)
    best_reaction_ms: float = Field(default=0.0, ge=0)
    reaction_success_count: int = Field(default=0, ge=0)
    reaction_miss_count: int = Field(default=0, ge=0)
    false_start_count: int = Field(default=0, ge=0)
    avg_pivot_score: float = Field(default=0.0, ge=0, le=1)
    pivot_engagement_rate: float = Field(default=0.0, ge=0, le=100)
    device_fps_avg: float = Field(default=0.0, ge=0)
    model_confidence_avg: float = Field(default=0.0, ge=0, le=1)
    stance: str | None = Field(default=None, max_length=50)
    client_version: str | None = Field(default=None, max_length=50)
    raw_summary_json: dict[str, Any] | None = None
    notes: str | None = Field(default=None, max_length=500)

    @field_validator("session_uid", "stance", "client_version", "notes")
    @classmethod
    def normalize_optional_text(cls, value: str | None, info: ValidationInfo) -> str | None:
        max_length = 500
        field = info.field_name or ""
        if field == "session_uid":
            max_length = 64
        elif field in {"stance", "client_version"}:
            max_length = 50
        return _normalize_text(value, max_length)

    @model_validator(mode="after")
    def validate_temporal_and_counts(self) -> "TrainingLogCreateRequest":
        if self.session_started_at >= self.session_ended_at:
            raise ValueError("session_started_at must be earlier than session_ended_at.")
        if self.total_punch_count != self.punch_count_left + self.punch_count_right:
            raise ValueError("total_punch_count must equal punch_count_left + punch_count_right.")
        if self.session_duration_sec > 86_400:
            raise ValueError("session_duration_sec is too large.")
        return self


class TrainingLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    session_uid: str | None
    session_mode: str
    session_started_at: datetime | None
    session_ended_at: datetime | None
    session_duration_sec: int
    avg_punch_speed: float
    max_punch_speed: float
    punch_count_left: int
    punch_count_right: int
    total_punch_count: int
    guard_success_rate: float
    guard_fail_count: int
    avg_reaction_ms: float
    best_reaction_ms: float
    reaction_success_count: int
    reaction_miss_count: int
    false_start_count: int
    avg_pivot_score: float
    pivot_engagement_rate: float
    device_fps_avg: float
    model_confidence_avg: float
    stance: str | None
    client_version: str | None
    raw_summary_json: dict[str, Any] | None
    notes: str | None
    created_at: datetime


class TrainingStatsSummary(BaseModel):
    session_count: int
    avg_punch_speed: float
    max_punch_speed: float
    guard_success_rate: float
    avg_reaction_ms: float
    best_reaction_ms: float
    avg_pivot_score: float
    pivot_engagement_rate: float
    total_punch_count: int
    false_start_count: int
    device_fps_avg: float
    model_confidence_avg: float


class TrainingStatsTrend(BaseModel):
    punch_speed_trend: Literal["up", "down", "flat"]
    guard_trend: Literal["up", "down", "flat"]
    reaction_trend: Literal["improving", "worsening", "flat"]
    pivot_trend: Literal["up", "down", "flat"]


class GeminiCoachingResponse(BaseModel):
    coaching_feedback: str
    generated_by: Literal["gemini", "fallback"] = "fallback"
    raw_text: str | None = None


class TrainingStatsData(BaseModel):
    summary: TrainingStatsSummary
    trend: TrainingStatsTrend
    coaching_feedback: str
    generated_by: Literal["gemini", "fallback"]
    raw_summary_json: dict[str, Any] | None = None
    recent_sessions: list[TrainingLogRead] = Field(default_factory=list)


class TrainingLogResponse(BaseModel):
    success: bool
    message: str
    data: TrainingLogRead


class TrainingStatsResponse(BaseModel):
    success: bool
    message: str
    data: TrainingStatsData


# Backward-compatible aliases for existing imports.
TrainingLogCreate = TrainingLogCreateRequest

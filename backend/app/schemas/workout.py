from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class WorkoutLogItem(BaseModel):
    punch_type: str = Field(min_length=1, max_length=30)
    count: int = Field(ge=1, le=100000)

    @field_validator("punch_type")
    @classmethod
    def normalize_punch_type(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not normalized:
            raise ValueError("punch_type cannot be empty.")
        return normalized


class WorkoutRecordCreate(BaseModel):
    mode: Literal["tutorial", "sparring"] = "sparring"
    logs: list[WorkoutLogItem] = Field(default_factory=list)
    duration_sec: int | None = Field(default=None, ge=0, le=24 * 60 * 60)
    generate_feedback: bool = True
    notes: str | None = Field(default=None, max_length=500)


class WorkoutLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    punch_type: str
    count: int
    created_at: datetime


class WorkoutRecordData(BaseModel):
    mode: str
    duration_sec: int | None
    total_punches: int
    totals_by_type: dict[str, int]
    saved_logs: list[WorkoutLogRead]
    feedback: str | None = None


class WorkoutRecordResponse(BaseModel):
    success: bool
    message: str
    data: WorkoutRecordData

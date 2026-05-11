from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


ALLOWED_JUDGE_LABELS = {"Perfect", "Clean", "Late", "Unsafe", "Miss"}
ALLOWED_DODGE_DIRECTIONS = {"left", "right", "down", "back", "side", "none", "unknown"}
ALLOWED_OUTCOMES = {"success", "fail"}


class TimestampSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    impact_time: float
    dodge_window_ms: int
    hitbox_radius: float
    attack_type: str | None
    judge_shape: str | None = None
    target_zone: str | None = None
    required_move: str | None = None
    min_displacement: float | None = None


class VideoListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    file_path: str
    attack_type: str | None
    difficulty: str
    duration_sec: float | None
    thumbnail_url: str | None
    is_premium: bool


class VideoListResponse(BaseModel):
    success: bool
    message: str
    data: list[VideoListItem]


class VideoDetailResponse(BaseModel):
    success: bool
    message: str
    data: "VideoDetail"


class VideoDetail(VideoListItem):
    timestamps: list[TimestampSchema]


class SessionCreateRequest(BaseModel):
    session_type: str = Field(pattern="^(tutorial|sparring|rehab)$")


class SessionCreateData(BaseModel):
    session_id: int
    started_at: datetime
    session_type: str


class SessionCreateResponse(BaseModel):
    success: bool
    message: str
    data: SessionCreateData


class SessionEndRequest(BaseModel):
    total_score: int = Field(ge=0)
    max_combo: int = Field(ge=0)
    total_rounds: int = Field(ge=0)
    exp_earned: int = Field(ge=0)


class SessionEndData(BaseModel):
    session_id: int
    ended_at: datetime
    total_score: int
    max_combo: int
    total_rounds: int
    exp_earned: int


class SessionEndResponse(BaseModel):
    success: bool
    message: str
    data: SessionEndData


class RoundResultCreateRequest(BaseModel):
    session_id: int
    video_id: int
    result: str = Field(pattern="^(dodge|hit)$")
    reaction_ms: int | None = Field(default=None, ge=0)
    score_earned: int = Field(default=0, ge=0)
    earned_score_per_attack: int = Field(default=0, ge=0)
    combo_at_time: int = Field(default=0, ge=0)
    attack_type: str | None = Field(default=None, max_length=30)
    dodge_direction: str | None = Field(default=None, max_length=30)
    accuracy_score: int = Field(default=0, ge=0, le=100)
    judge_label: str | None = Field(default=None, pattern="^(Perfect|Clean|Late|Unsafe|Miss)$")
    outcome: str | None = Field(default=None, pattern="^(success|fail)$")
    nose_x: float | None = None
    nose_y: float | None = None

    @field_validator("attack_type", "dodge_direction", "outcome", mode="before")
    @classmethod
    def _normalize_optional_lower(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = str(value).strip().lower()
        return normalized or None

    @field_validator("dodge_direction")
    @classmethod
    def _validate_dodge_direction(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if value not in ALLOWED_DODGE_DIRECTIONS:
            raise ValueError(f"dodge_direction must be one of: {', '.join(sorted(ALLOWED_DODGE_DIRECTIONS))}")
        return value

    @field_validator("outcome")
    @classmethod
    def _validate_outcome(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if value not in ALLOWED_OUTCOMES:
            raise ValueError(f"outcome must be one of: {', '.join(sorted(ALLOWED_OUTCOMES))}")
        return value


class RoundResultData(BaseModel):
    id: int
    session_id: int
    video_id: int
    result: str
    reaction_ms: int | None
    score_earned: int
    earned_score_per_attack: int
    combo_at_time: int
    attack_type: str | None
    dodge_direction: str | None
    accuracy_score: int
    judge_label: str | None
    outcome: str | None


class RoundResultResponse(BaseModel):
    success: bool
    message: str
    data: RoundResultData


class PoseCorrectionCreateRequest(BaseModel):
    session_id: int
    pose_type: str | None = Field(default=None, max_length=50)
    accuracy: float | None = Field(default=None, ge=0, le=100)
    issue_type: str | None = Field(default=None, max_length=100)
    feedback_message: str | None = Field(default=None, max_length=255)
    severity: str | None = Field(default=None, pattern="^(low|medium|high)$")


class PoseCorrectionData(BaseModel):
    id: int
    session_id: int
    pose_type: str | None
    accuracy: float | None
    issue_type: str | None
    severity: str | None


class PoseCorrectionResponse(BaseModel):
    success: bool
    message: str
    data: PoseCorrectionData

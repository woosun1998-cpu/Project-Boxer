from __future__ import annotations

from pydantic import BaseModel, Field, field_validator


ALLOWED_DIFFICULTIES = {"easy", "medium", "hard", "beginner", "intermediate", "advanced", "pro"}
ALLOWED_ATTACK_TYPES = {"jab", "straight", "hook", "uppercut", "mixed"}
ALLOWED_JUDGE_SHAPES = {"circle", "ellipse", "lane"}
ALLOWED_TARGET_ZONES = {"head", "left_head", "right_head", "body"}
ALLOWED_REQUIRED_MOVES = {"slip_left", "slip_right", "slip_side", "duck", "lean_back", "step_out", "auto"}


class AdminTimestampCreate(BaseModel):
    impact_time: float = Field(gt=0)
    dodge_window_ms: int = Field(default=500, ge=150, le=4000)
    hitbox_radius: float = Field(default=0.15, gt=0.03, le=0.6)
    attack_type: str | None = Field(default=None, max_length=30)
    judge_shape: str | None = Field(default=None, max_length=20)
    target_zone: str | None = Field(default=None, max_length=20)
    required_move: str | None = Field(default=None, max_length=20)
    min_displacement: float | None = Field(default=None, gt=0.0, le=1.0)

    @field_validator("attack_type", "judge_shape", "target_zone", "required_move", mode="before")
    @classmethod
    def _normalize_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = str(value).strip().lower()
        return normalized or None

    @field_validator("attack_type")
    @classmethod
    def _validate_attack_type(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if value not in ALLOWED_ATTACK_TYPES:
            raise ValueError(f"attack_type must be one of: {', '.join(sorted(ALLOWED_ATTACK_TYPES))}")
        return value

    @field_validator("judge_shape")
    @classmethod
    def _validate_judge_shape(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if value not in ALLOWED_JUDGE_SHAPES:
            raise ValueError(f"judge_shape must be one of: {', '.join(sorted(ALLOWED_JUDGE_SHAPES))}")
        return value

    @field_validator("target_zone")
    @classmethod
    def _validate_target_zone(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if value not in ALLOWED_TARGET_ZONES:
            raise ValueError(f"target_zone must be one of: {', '.join(sorted(ALLOWED_TARGET_ZONES))}")
        return value

    @field_validator("required_move")
    @classmethod
    def _validate_required_move(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if value not in ALLOWED_REQUIRED_MOVES:
            raise ValueError(f"required_move must be one of: {', '.join(sorted(ALLOWED_REQUIRED_MOVES))}")
        return value


class AdminVideoCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    file_path: str = Field(min_length=1, max_length=255)
    attack_type: str | None = Field(default=None, max_length=50)
    difficulty: str = Field(default="beginner", pattern="^(easy|medium|hard|beginner|intermediate|advanced|pro)$")
    duration_sec: float | None = Field(default=None, ge=0)
    thumbnail_url: str | None = Field(default=None, max_length=255)
    is_premium: bool = False
    timestamps: list[AdminTimestampCreate] = Field(default_factory=list)

    @field_validator("attack_type", mode="before")
    @classmethod
    def _normalize_attack_type(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = str(value).strip().lower()
        return normalized or None

    @field_validator("difficulty", mode="before")
    @classmethod
    def _normalize_difficulty(cls, value: str) -> str:
        normalized = str(value).strip().lower()
        if normalized not in ALLOWED_DIFFICULTIES:
            raise ValueError(f"difficulty must be one of: {', '.join(sorted(ALLOWED_DIFFICULTIES))}")
        return normalized


class AdminVideoCreateResponse(BaseModel):
    success: bool
    message: str
    data: dict

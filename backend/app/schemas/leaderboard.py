from pydantic import BaseModel, Field


class LeaderboardItem(BaseModel):
    rank: int
    username: str
    total_score: int
    max_combo: int
    total_dodges: int
    win_rate: float
    rank_tier: str


class LeaderboardResponse(BaseModel):
    success: bool
    message: str
    data: list[LeaderboardItem]


class LeaderboardUpdateRequest(BaseModel):
    total_score: int = Field(ge=0)
    max_combo: int = Field(ge=0)
    total_dodges: int = Field(ge=0)
    win_rate: float = Field(ge=0, le=1)


class LeaderboardUpdateData(BaseModel):
    user_id: int
    total_score: int
    max_combo: int
    total_dodges: int
    win_rate: float
    rank_tier: str
    rank_points: int


class LeaderboardUpdateResponse(BaseModel):
    success: bool
    message: str
    data: LeaderboardUpdateData

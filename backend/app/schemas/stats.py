from pydantic import BaseModel


class WeeklyStatsItem(BaseModel):
    date: str
    dodge_rate: float
    avg_reaction_ms: float | None


class AttackTypeStatsItem(BaseModel):
    type: str
    success_rate: float


class StatsData(BaseModel):
    total_score: int
    max_combo: int
    total_dodges: int
    total_hits: int
    win_rate: float
    total_sessions: int
    weekly_stats: list[WeeklyStatsItem]
    attack_type_stats: list[AttackTypeStatsItem]


class StatsResponse(BaseModel):
    success: bool
    message: str
    data: StatsData

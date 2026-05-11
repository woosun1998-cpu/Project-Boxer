from pydantic import BaseModel


class CoachingData(BaseModel):
    advice: str
    focus_area: str
    next_goal: str


class CoachingResponse(BaseModel):
    success: bool
    message: str
    data: CoachingData

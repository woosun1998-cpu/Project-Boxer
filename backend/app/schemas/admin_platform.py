from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel


AdminModuleStatus = Literal["live", "legacy", "planned"]


class AdminPlatformMetric(BaseModel):
    key: str
    label: str
    value: int | float
    unit: str = ""


class AdminPlatformModule(BaseModel):
    key: str
    title: str
    status: AdminModuleStatus
    description: str
    frontend_path: str | None = None
    api_prefix: str | None = None


class AdminRecentUser(BaseModel):
    id: int
    username: str
    email: str
    tier: str
    is_active: bool = True
    created_at: datetime | None = None


class AdminPlatformOverviewResponse(BaseModel):
    metrics: list[AdminPlatformMetric]
    modules: list[AdminPlatformModule]
    recent_users: list[AdminRecentUser]
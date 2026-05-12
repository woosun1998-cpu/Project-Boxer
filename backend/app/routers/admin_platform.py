from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.session import RoundResult, TrainingSession
from app.models.tutorial import BoxingTutorial
from app.models.user import User
from app.models.video import AttackVideo
from app.schemas.admin_platform import (
    AdminPlatformMetric,
    AdminPlatformModule,
    AdminPlatformOverviewResponse,
    AdminRecentUser,
)
from app.utils.dependencies import get_current_user


router = APIRouter(prefix="/platform", tags=["admin-platform"])


ADMIN_MODULES: list[AdminPlatformModule] = [
    AdminPlatformModule(key="overview", title="Operation Overview", status="live", description="관리자 운영 현황 대시보드", frontend_path="/admin.html", api_prefix="/api/admin/platform"),
    AdminPlatformModule(key="tutorials", title="Tutorial Manager", status="live", description="튜토리얼 CRUD 관리", frontend_path="/admin/tutorials.html", api_prefix="/api/admin/tutorials"),
    AdminPlatformModule(key="sparring-videos", title="Sparring Manager", status="live", description="스파링 영상과 활성 상태 관리", frontend_path="/admin/sparring.html", api_prefix="/api/admin/sparring/videos"),
    AdminPlatformModule(key="timestamp-editor", title="Timestamp Visual Editor", status="live", description="스파링 영상 공격 마커 편집", frontend_path="/admin/timestamp-editor.html", api_prefix="/api/admin/videos/{id}/timestamps"),
    AdminPlatformModule(key="users", title="Users Manager", status="live", description="사용자 조회 및 tier 변경", frontend_path="/admin/users.html", api_prefix="/api/admin/users"),
    AdminPlatformModule(key="media-library", title="Media Library", status="live", description="미디어 파일 관리", frontend_path="/admin/media-library.html"),
    AdminPlatformModule(key="analytics", title="Analytics", status="live", description="훈련 및 스파링 통계", frontend_path="/admin/analytics.html"),
    AdminPlatformModule(key="premium", title="Premium Manager", status="live", description="Premium 사용자 관리", frontend_path="/admin/premium.html"),
    AdminPlatformModule(key="settings", title="Settings", status="planned", description="시스템 설정", frontend_path="/admin/settings.html"),
]


def require_admin_user(current_user: User = Depends(get_current_user)) -> User:
    if current_user.tier != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access is required.")
    return current_user


async def _scalar_int(db: AsyncSession, statement) -> int:
    value = await db.scalar(statement)
    return int(value or 0)


async def _scalar_float(db: AsyncSession, statement) -> float:
    value = await db.scalar(statement)
    return round(float(value or 0), 2)


@router.get("/modules", response_model=list[AdminPlatformModule])
async def list_admin_platform_modules(current_user: User = Depends(require_admin_user)) -> list[AdminPlatformModule]:
    _ = current_user
    return ADMIN_MODULES


@router.get("/overview", response_model=AdminPlatformOverviewResponse)
async def read_admin_platform_overview(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_user),
) -> AdminPlatformOverviewResponse:
    _ = current_user

    total_users = await _scalar_int(db, select(func.count(User.id)))
    admin_users = await _scalar_int(db, select(func.count(User.id)).where(User.tier == "admin"))
    premium_users = await _scalar_int(db, select(func.count(User.id)).where(User.tier == "premium"))
    active_tutorials = await _scalar_int(db, select(func.count(BoxingTutorial.id)))
    total_videos = await _scalar_int(db, select(func.count(AttackVideo.id)))
    total_training = await _scalar_int(db, select(func.count(TrainingSession.id)).where(TrainingSession.session_type == "tutorial"))
    total_sparring = await _scalar_int(db, select(func.count(TrainingSession.id)).where(TrainingSession.session_type == "sparring"))
    avg_training_score = await _scalar_float(db, select(func.avg(TrainingSession.total_score)))

    total_rounds = await _scalar_int(db, select(func.count(RoundResult.id)))
    dodges = await _scalar_int(db, select(func.count(RoundResult.id)).where(RoundResult.result == "dodge"))
    avg_dodge = round((dodges / total_rounds) * 100, 2) if total_rounds else 0

    recent_result = await db.execute(select(User).order_by(desc(User.created_at), desc(User.id)).limit(5))
    recent_users = [
        AdminRecentUser(
            id=user.id,
            username=user.username,
            email=user.email,
            tier=user.tier,
            is_active=True,
            created_at=user.created_at,
        )
        for user in recent_result.scalars().all()
    ]

    metrics = [
        AdminPlatformMetric(key="total_users", label="총 사용자", value=total_users),
        AdminPlatformMetric(key="admin_users", label="관리자", value=admin_users),
        AdminPlatformMetric(key="premium_users", label="Premium 사용자", value=premium_users),
        AdminPlatformMetric(key="active_tutorials", label="튜토리얼", value=active_tutorials),
        AdminPlatformMetric(key="total_videos", label="스파링 영상", value=total_videos),
        AdminPlatformMetric(key="total_training", label="훈련 기록", value=total_training),
        AdminPlatformMetric(key="total_sparring", label="스파링 기록", value=total_sparring),
        AdminPlatformMetric(key="favorite_gyms", label="관심 체육관 저장", value=0),
        AdminPlatformMetric(key="avg_training_score", label="평균 훈련 점수", value=avg_training_score),
        AdminPlatformMetric(key="avg_dodge", label="평균 회피율", value=avg_dodge, unit="%"),
    ]

    return AdminPlatformOverviewResponse(metrics=metrics, modules=ADMIN_MODULES, recent_users=recent_users)
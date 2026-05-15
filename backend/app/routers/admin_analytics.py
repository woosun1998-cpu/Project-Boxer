from __future__ import annotations

from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.session import RoundResult, TrainingSession
from app.models.tutorial import BoxingTutorial, UserProgress
from app.models.user import User
from app.models.video import AttackVideo
from app.utils.dependencies import get_current_user


router = APIRouter(prefix="/analytics", tags=["admin-analytics"])


def _ensure_admin(current_user: User) -> None:
    if current_user.tier != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access is required.")


async def _count(db: AsyncSession, stmt) -> int:
    return int(await db.scalar(stmt) or 0)


async def _avg(db: AsyncSession, stmt) -> float:
    value = await db.scalar(stmt)
    return round(float(value or 0), 2)


def _last7_dates() -> list[date]:
    today = datetime.utcnow().date()
    return [today - timedelta(days=offset) for offset in range(6, -1, -1)]


@router.get("/overview")
async def overview(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _ensure_admin(current_user)
    total_training = await _count(db, select(func.count(TrainingSession.id)).where(TrainingSession.session_type == "tutorial"))
    total_sparring = await _count(db, select(func.count(TrainingSession.id)).where(TrainingSession.session_type == "sparring"))
    avg_training_score = await _avg(db, select(func.avg(TrainingSession.total_score)).where(TrainingSession.session_type == "tutorial"))
    total_rounds = await _count(db, select(func.count(RoundResult.id)))
    dodges = await _count(db, select(func.count(RoundResult.id)).where(RoundResult.result == "dodge"))
    avg_dodge_rate = round((dodges / total_rounds) * 100, 2) if total_rounds else 0
    avg_reaction_ms = await _avg(db, select(func.avg(RoundResult.reaction_ms)).where(RoundResult.reaction_ms.is_not(None)))
    progress_total = await _count(db, select(func.count(UserProgress.tutorial_id)))
    progress_done = await _count(db, select(func.count(UserProgress.tutorial_id)).where(UserProgress.is_completed.is_(True)))
    tutorial_completion_rate = round((progress_done / progress_total) * 100, 2) if progress_total else 0

    dates = _last7_dates()
    since = datetime.combine(dates[0], datetime.min.time())
    rows = (await db.execute(select(TrainingSession.user_id, TrainingSession.started_at).where(TrainingSession.started_at >= since))).all()
    daily = []
    for day in dates:
        users = {user_id for user_id, started_at in rows if started_at and started_at.date() == day}
        daily.append(len(users))

    return {
        "avg_training_score": avg_training_score,
        "avg_dodge_rate": avg_dodge_rate,
        "avg_reaction_ms": avg_reaction_ms,
        "tutorial_completion_rate": tutorial_completion_rate,
        "total_training_sessions": total_training,
        "total_sparring_sessions": total_sparring,
        "daily_active_users_7d": daily,
    }


@router.get("/training")
async def training(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _ensure_admin(current_user)
    tutorials = (await db.execute(select(BoxingTutorial).order_by(BoxingTutorial.order_sequence.asc(), BoxingTutorial.id.asc()))).scalars().all()
    rows = []
    for item in tutorials:
        attempts = await _count(db, select(func.coalesce(func.sum(UserProgress.attempts), 0)).where(UserProgress.tutorial_id == item.id))
        passed = await _count(db, select(func.count(UserProgress.tutorial_id)).where(UserProgress.tutorial_id == item.id, UserProgress.is_completed.is_(True)))
        participants = await _count(db, select(func.count(UserProgress.tutorial_id)).where(UserProgress.tutorial_id == item.id))
        rate_base = participants or attempts
        completion_rate = round((passed / rate_base) * 100, 2) if rate_base else 0
        rows.append({
            "lesson_key": item.lesson_key or f"tutorial-{item.id}",
            "title": item.title,
            "attempts": attempts,
            "passed": passed,
            "completion_rate": completion_rate,
        })
    return {"items": rows, "lessons": rows}


@router.get("/sparring")
async def sparring(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _ensure_admin(current_user)
    avg_score = await _avg(db, select(func.avg(TrainingSession.total_score)).where(TrainingSession.session_type == "sparring"))
    total_rounds = await _count(db, select(func.count(RoundResult.id)))
    dodges = await _count(db, select(func.count(RoundResult.id)).where(RoundResult.result == "dodge"))
    avg_dodge_rate = round((dodges / total_rounds) * 100, 2) if total_rounds else 0
    avg_reaction_ms = await _avg(db, select(func.avg(RoundResult.reaction_ms)).where(RoundResult.reaction_ms.is_not(None)))

    modes = ["beginner", "intermediate", "advanced", "pro"]
    mode_stats = []
    for mode in modes:
        video_ids = (await db.execute(select(AttackVideo.id).where(AttackVideo.difficulty == mode))).scalars().all()
        if not video_ids:
            mode_stats.append({"mode": mode, "total_sessions": 0, "avg_score": 0, "avg_dodge_rate": 0, "avg_reaction_ms": 0})
            continue
        rounds = await _count(db, select(func.count(RoundResult.id)).where(RoundResult.video_id.in_(video_ids)))
        mode_dodges = await _count(db, select(func.count(RoundResult.id)).where(RoundResult.video_id.in_(video_ids), RoundResult.result == "dodge"))
        mode_score = await _avg(db, select(func.avg(RoundResult.score_earned)).where(RoundResult.video_id.in_(video_ids)))
        mode_reaction = await _avg(db, select(func.avg(RoundResult.reaction_ms)).where(RoundResult.video_id.in_(video_ids), RoundResult.reaction_ms.is_not(None)))
        mode_stats.append({
            "mode": mode,
            "total_sessions": rounds,
            "avg_score": mode_score,
            "avg_dodge_rate": round((mode_dodges / rounds) * 100, 2) if rounds else 0,
            "avg_reaction_ms": mode_reaction,
        })

    return {
        "avg_score": avg_score,
        "avg_dodge_rate": avg_dodge_rate,
        "avg_reaction_ms": avg_reaction_ms,
        "mode_stats": mode_stats,
    }


@router.get("/users")
async def users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _ensure_admin(current_user)
    total = await _count(db, select(func.count(User.id)))
    active = await _count(db, select(func.count(User.id)).where(User.is_active.is_(True)))
    premium = await _count(db, select(func.count(User.id)).where(User.tier == "premium"))
    admin = await _count(db, select(func.count(User.id)).where(User.tier == "admin"))
    dates = _last7_dates()
    since = datetime.combine(dates[0], datetime.min.time())
    rows = (await db.execute(select(User.created_at).where(User.created_at >= since))).scalars().all()
    new_last_7d = [sum(1 for created_at in rows if created_at and created_at.date() == day) for day in dates]
    return {
        "total": total,
        "active": active,
        "inactive": max(total - active, 0),
        "premium": premium,
        "admin": admin,
        "new_last_7d": new_last_7d,
    }

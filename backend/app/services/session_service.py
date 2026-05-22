from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.session import PoseCorrection, RoundResult, TrainingSession
from app.models.user import User
from app.models.video import AttackVideo
from app.schemas.video import (
    PoseCorrectionCreateRequest,
    PoseCorrectionData,
    RoundResultCreateRequest,
    RoundResultData,
    SessionCreateData,
    SessionCreateRequest,
    SessionEndData,
    SessionEndRequest,
    VideoDetail,
    VideoListItem,
)


class SessionService:
    async def list_videos(self, db: AsyncSession, current_user: User) -> list[VideoListItem]:
        query = select(AttackVideo).order_by(AttackVideo.id.asc())
        if current_user.tier != "premium":
            query = query.where(AttackVideo.is_premium.is_(False))
        videos = (await db.execute(query)).scalars().all()
        return [VideoListItem.model_validate(video) for video in videos]

    async def get_video(
        self,
        db: AsyncSession,
        video_id: int,
        current_user: User,
    ) -> VideoDetail:
        query = (
            select(AttackVideo)
            .options(selectinload(AttackVideo.timestamps))
            .where(AttackVideo.id == video_id)
        )
        video = (await db.execute(query)).scalar_one_or_none()
        if video is None:
            raise LookupError("Video not found.")
        if video.is_premium and current_user.tier != "premium":
            raise PermissionError("Premium membership is required for this video.")
        return VideoDetail.model_validate(video)

    async def create_session(
        self,
        db: AsyncSession,
        current_user: User,
        payload: SessionCreateRequest,
    ) -> SessionCreateData:
        session = TrainingSession(user_id=current_user.id, session_type=payload.session_type)
        db.add(session)
        await db.flush()
        await db.refresh(session)
        return SessionCreateData(
            session_id=session.id,
            started_at=session.started_at,
            session_type=session.session_type,
        )

    async def end_session(
        self,
        db: AsyncSession,
        session_id: int,
        current_user: User,
        payload: SessionEndRequest,
    ) -> SessionEndData:
        session = (
            await db.execute(select(TrainingSession).where(TrainingSession.id == session_id))
        ).scalar_one_or_none()
        if session is None:
            raise LookupError("Session not found.")
        if session.user_id != current_user.id:
            raise PermissionError("You do not have access to this session.")

        session.ended_at = datetime.utcnow()
        session.total_score = payload.total_score
        session.max_combo = payload.max_combo
        session.total_rounds = payload.total_rounds
        session.exp_earned = payload.exp_earned

        await db.flush()
        return SessionEndData(
            session_id=session.id,
            ended_at=session.ended_at,
            total_score=session.total_score,
            max_combo=session.max_combo,
            total_rounds=session.total_rounds,
            exp_earned=session.exp_earned,
        )

    async def create_round_result(
        self,
        db: AsyncSession,
        current_user: User,
        payload: RoundResultCreateRequest,
    ) -> RoundResultData:
        session = (
            await db.execute(select(TrainingSession).where(TrainingSession.id == payload.session_id))
        ).scalar_one_or_none()
        if session is None:
            raise LookupError("Session not found.")
        if session.user_id != current_user.id:
            raise PermissionError("You do not have access to this session.")

        video = (await db.execute(select(AttackVideo).where(AttackVideo.id == payload.video_id))).scalar_one_or_none()
        if video is None:
            raise LookupError("Video not found.")

        payload_data = payload.model_dump()
        payload_data["earned_score_per_attack"] = payload_data.get("earned_score_per_attack") or payload_data.get("score_earned", 0)
        payload_data["outcome"] = payload_data.get("outcome") or ("success" if payload_data.get("result") == "dodge" else "fail")
        payload_data["dodge_direction"] = payload_data.get("dodge_direction") or "unknown"
        round_result = RoundResult(**payload_data)
        db.add(round_result)
        await db.flush()
        await db.refresh(round_result)

        return RoundResultData(
            id=round_result.id,
            session_id=round_result.session_id,
            video_id=round_result.video_id,
            result=round_result.result,
            reaction_ms=round_result.reaction_ms,
            score_earned=round_result.score_earned,
            earned_score_per_attack=round_result.earned_score_per_attack,
            combo_at_time=round_result.combo_at_time,
            attack_type=round_result.attack_type,
            dodge_direction=round_result.dodge_direction,
            accuracy_score=round_result.accuracy_score,
            judge_label=round_result.judge_label,
            outcome=round_result.outcome,
        )

    async def create_pose_correction(
        self,
        db: AsyncSession,
        current_user: User,
        payload: PoseCorrectionCreateRequest,
    ) -> PoseCorrectionData:
        session = (
            await db.execute(select(TrainingSession).where(TrainingSession.id == payload.session_id))
        ).scalar_one_or_none()
        if session is None:
            raise LookupError("Session not found.")
        if session.user_id != current_user.id:
            raise PermissionError("You do not have access to this session.")

        correction = PoseCorrection(**payload.model_dump())
        db.add(correction)
        await db.flush()
        await db.refresh(correction)

        return PoseCorrectionData(
            id=correction.id,
            session_id=correction.session_id,
            pose_type=correction.pose_type,
            accuracy=correction.accuracy,
            issue_type=correction.issue_type,
            severity=correction.severity,
        )

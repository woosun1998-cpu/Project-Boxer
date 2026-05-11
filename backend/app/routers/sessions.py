from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.video import (
    PoseCorrectionCreateRequest,
    PoseCorrectionResponse,
    RoundResultCreateRequest,
    RoundResultResponse,
    SessionCreateRequest,
    SessionCreateResponse,
    SessionEndRequest,
    SessionEndResponse,
)
from app.services.session_service import SessionService
from app.utils.dependencies import get_current_user


router = APIRouter()
session_service = SessionService()


@router.post(
    "",
    response_model=SessionCreateResponse,
    summary="Create training session",
    description="Create a new training session for the authenticated user.",
)
async def create_session(
    payload: SessionCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SessionCreateResponse:
    session = await session_service.create_session(db, current_user, payload)
    return SessionCreateResponse(
        success=True,
        message="Training session created successfully.",
        data=session,
    )


@router.put(
    "/{session_id}/end",
    response_model=SessionEndResponse,
    summary="End training session",
    description="Finish a session and save its summary stats.",
)
async def end_session(
    session_id: int,
    payload: SessionEndRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SessionEndResponse:
    try:
        session = await session_service.end_session(db, session_id, current_user, payload)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc

    return SessionEndResponse(
        success=True,
        message="Training session ended successfully.",
        data=session,
    )


@router.post(
    "/rounds",
    response_model=RoundResultResponse,
    summary="Save round result",
    description="Save the result of a single sparring round.",
)
async def create_round_result(
    payload: RoundResultCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> RoundResultResponse:
    try:
        result = await session_service.create_round_result(db, current_user, payload)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc

    return RoundResultResponse(
        success=True,
        message="Round result saved successfully.",
        data=result,
    )


@router.post(
    "/pose-corrections",
    response_model=PoseCorrectionResponse,
    summary="Save pose correction",
    description="Save a pose correction record for the current user session.",
)
async def create_pose_correction(
    payload: PoseCorrectionCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PoseCorrectionResponse:
    try:
        result = await session_service.create_pose_correction(db, current_user, payload)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc

    return PoseCorrectionResponse(
        success=True,
        message="Pose correction saved successfully.",
        data=result,
    )

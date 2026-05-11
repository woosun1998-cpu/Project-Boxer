from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.tutorial import (
    TutorialCompleteRequest,
    TutorialCompleteResponse,
    TutorialDetailResponse,
    TutorialListResponse,
)
from app.services.tutorial_service import TutorialService
from app.utils.dependencies import get_current_user


router = APIRouter()
tutorial_service = TutorialService()


@router.get(
    "",
    response_model=TutorialListResponse,
    summary="List tutorials",
    description="Return tutorials available to the current user. Free users cannot access premium tutorials.",
)
async def list_tutorials(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TutorialListResponse:
    tutorials = await tutorial_service.list_tutorials(db, current_user)
    return TutorialListResponse(
        success=True,
        message="Tutorial list loaded successfully.",
        data=tutorials,
    )


@router.get(
    "/{tutorial_id}",
    response_model=TutorialDetailResponse,
    summary="Get tutorial detail",
    description="Return a single tutorial including target pose data.",
)
async def get_tutorial(
    tutorial_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TutorialDetailResponse:
    try:
        tutorial = await tutorial_service.get_tutorial(db, tutorial_id, current_user)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc

    return TutorialDetailResponse(
        success=True,
        message="Tutorial detail loaded successfully.",
        data=tutorial,
    )


@router.post(
    "/{tutorial_id}/complete",
    response_model=TutorialCompleteResponse,
    summary="Complete tutorial",
    description="Mark a tutorial as completed and reward the user.",
)
async def complete_tutorial(
    tutorial_id: int,
    payload: TutorialCompleteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TutorialCompleteResponse:
    try:
        result = await tutorial_service.complete_tutorial(db, tutorial_id, payload, current_user)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc

    return TutorialCompleteResponse(
        success=True,
        message="Tutorial completion saved successfully.",
        data=result,
    )

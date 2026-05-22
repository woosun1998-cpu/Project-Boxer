from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.auth import AuthResponse, LoginRequest, SignupRequest
from app.services.auth_service import AuthService
from app.utils.security import PasswordValidationError


router = APIRouter()
auth_service = AuthService()


@router.post(
    "/signup",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create account",
    description="Register a new Boxer user and return a JWT access token.",
)
async def signup(
    payload: SignupRequest,
    db: AsyncSession = Depends(get_db),
) -> AuthResponse:
    try:
        result = await auth_service.signup(db, payload)
    except PasswordValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc

    return AuthResponse(
        success=True,
        message="User created successfully.",
        data=result,
    )


@router.post(
    "/login",
    response_model=AuthResponse,
    summary="Login",
    description="Authenticate with email and password and return a JWT access token.",
)
async def login(
    payload: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> AuthResponse:
    try:
        result = await auth_service.login(db, payload)
    except PermissionError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc

    return AuthResponse(
        success=True,
        message="Login successful.",
        data=result,
    )

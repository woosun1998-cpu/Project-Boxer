from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.schemas.auth import AuthPayload, LoginRequest, SignupRequest
from app.utils.jwt import create_access_token
from app.utils.security import hash_password, verify_password


class AuthService:
    async def signup(self, db: AsyncSession, payload: SignupRequest) -> AuthPayload:
        query = select(User).where(
            or_(User.username == payload.username, User.email == payload.email)
        )
        existing_user = (await db.execute(query)).scalar_one_or_none()
        if existing_user:
            field_name = "username" if existing_user.username == payload.username else "email"
            raise ValueError(f"{field_name} is already in use.")

        user = User(
            username=payload.username,
            email=payload.email,
            password_hash=hash_password(payload.password),
        )
        db.add(user)
        await db.flush()
        await db.refresh(user)

        token = create_access_token(user_id=user.id, username=user.username)
        return AuthPayload(
            user_id=user.id,
            username=user.username,
            token=token,
            tier=user.tier,
            role=user.role,
            is_admin=user.is_admin,
        )

    async def login(self, db: AsyncSession, payload: LoginRequest) -> AuthPayload:
        query = select(User).where(User.email == payload.email)
        user = (await db.execute(query)).scalar_one_or_none()
        if not user or not verify_password(payload.password, user.password_hash):
            raise PermissionError("Invalid email or password.")

        token = create_access_token(user_id=user.id, username=user.username)
        return AuthPayload(
            user_id=user.id,
            username=user.username,
            token=token,
            tier=user.tier,
            role=user.role,
            is_admin=user.is_admin,
        )

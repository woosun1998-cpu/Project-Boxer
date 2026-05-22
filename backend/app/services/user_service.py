from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.schemas.auth import UserRead, UserUpdateRequest


class UserService:
    async def get_me(self, current_user: User) -> UserRead:
        return UserRead.model_validate(current_user)

    async def update_me(
        self,
        db: AsyncSession,
        current_user: User,
        payload: UserUpdateRequest,
    ) -> UserRead:
        updates = payload.model_dump(exclude_unset=True)

        if "username" in updates and updates["username"] != current_user.username:
            existing_user = (
                await db.execute(select(User).where(User.username == updates["username"]))
            ).scalar_one_or_none()
            if existing_user and existing_user.id != current_user.id:
                raise ValueError("username is already in use.")

        for field, value in updates.items():
            setattr(current_user, field, value)

        db.add(current_user)
        await db.flush()
        await db.refresh(current_user)
        return UserRead.model_validate(current_user)

from datetime import datetime

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tutorial import BoxingTutorial, UserProgress
from app.models.user import User
from app.schemas.tutorial import (
    TutorialCompleteData,
    TutorialCompleteRequest,
    TutorialDetail,
    TutorialListItem,
    UserProgressItem,
)


class TutorialService:
    async def list_tutorials(
        self,
        db: AsyncSession,
        current_user: User,
    ) -> list[TutorialListItem]:
        query = select(BoxingTutorial).order_by(
            BoxingTutorial.order_sequence.asc(),
            BoxingTutorial.id.asc(),
        )
        if current_user.tier != "premium":
            query = query.where(BoxingTutorial.is_premium.is_(False))

        tutorials = (await db.execute(query)).scalars().all()
        return [TutorialListItem.model_validate(item) for item in tutorials]

    async def get_tutorial(
        self,
        db: AsyncSession,
        tutorial_id: int,
        current_user: User,
    ) -> TutorialDetail:
        tutorial = (
            await db.execute(
                select(BoxingTutorial).where(BoxingTutorial.id == tutorial_id)
            )
        ).scalar_one_or_none()
        if tutorial is None:
            raise LookupError("Tutorial not found.")
        if tutorial.is_premium and current_user.tier != "premium":
            raise PermissionError("Premium membership is required for this tutorial.")
        return TutorialDetail.model_validate(tutorial)

    async def complete_tutorial(
        self,
        db: AsyncSession,
        tutorial_id: int,
        payload: TutorialCompleteRequest,
        current_user: User,
    ) -> TutorialCompleteData:
        tutorial = (
            await db.execute(
                select(BoxingTutorial).where(BoxingTutorial.id == tutorial_id)
            )
        ).scalar_one_or_none()
        if tutorial is None:
            raise LookupError("Tutorial not found.")
        if tutorial.is_premium and current_user.tier != "premium":
            raise PermissionError("Premium membership is required for this tutorial.")

        progress = (
            await db.execute(
                select(UserProgress).where(
                    and_(
                        UserProgress.user_id == current_user.id,
                        UserProgress.tutorial_id == tutorial_id,
                    )
                )
            )
        ).scalar_one_or_none()

        coins_earned = 0
        if progress is None:
            progress = UserProgress(
                user_id=current_user.id,
                tutorial_id=tutorial_id,
            )
            db.add(progress)

        previous_completed = progress.is_completed
        progress.is_completed = True
        progress.attempts = payload.attempts
        progress.best_accuracy = (
            payload.accuracy
            if progress.best_accuracy is None
            else max(progress.best_accuracy, payload.accuracy)
        )
        progress.completed_at = datetime.utcnow()

        if not previous_completed:
            current_user.coins += tutorial.reward_coins
            db.add(current_user)
            coins_earned = tutorial.reward_coins

        await db.flush()

        return TutorialCompleteData(
            tutorial_id=tutorial_id,
            is_completed=progress.is_completed,
            best_accuracy=progress.best_accuracy,
            attempts=progress.attempts,
            exp_earned=tutorial.reward_exp,
            coins_earned=coins_earned,
        )

    async def get_user_progress(
        self,
        db: AsyncSession,
        current_user: User,
    ) -> list[UserProgressItem]:
        progress_rows = (
            await db.execute(
                select(UserProgress)
                .where(UserProgress.user_id == current_user.id)
                .order_by(UserProgress.tutorial_id.asc())
            )
        ).scalars().all()
        return [UserProgressItem.model_validate(item) for item in progress_rows]

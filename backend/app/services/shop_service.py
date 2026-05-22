from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.shop import ShopItem, UserPurchase
from app.models.user import User
from app.schemas.shop import PurchaseData, PurchaseRequest, ShopItemData


class ShopService:
    async def list_items(
        self,
        db: AsyncSession,
        current_user: User,
        item_type: str | None,
    ) -> list[ShopItemData]:
        query = select(ShopItem).where(ShopItem.is_active.is_(True)).order_by(ShopItem.id.asc())
        if item_type:
            query = query.where(ShopItem.item_type == item_type)
        items = (await db.execute(query)).scalars().all()

        purchased_ids = set(
            (
                await db.execute(
                    select(UserPurchase.item_id).where(UserPurchase.user_id == current_user.id)
                )
            )
            .scalars()
            .all()
        )

        return [
            ShopItemData(
                id=item.id,
                name=item.name,
                description=item.description,
                item_type=item.item_type,
                price_coins=item.price_coins,
                thumbnail=item.thumbnail,
                is_active=item.is_active,
                is_purchased=item.id in purchased_ids,
            )
            for item in items
        ]

    async def purchase(
        self,
        db: AsyncSession,
        current_user: User,
        payload: PurchaseRequest,
    ) -> PurchaseData:
        item = (
            await db.execute(select(ShopItem).where(ShopItem.id == payload.item_id))
        ).scalar_one_or_none()
        if item is None or not item.is_active:
            raise LookupError("Shop item not found.")

        existing_purchase = (
            await db.execute(
                select(UserPurchase).where(
                    UserPurchase.user_id == current_user.id,
                    UserPurchase.item_id == payload.item_id,
                )
            )
        ).scalar_one_or_none()
        if existing_purchase:
            raise ValueError("Item has already been purchased.")

        if payload.payment_type == "premium_upgrade":
            current_user.tier = "premium"
        else:
            if current_user.coins < item.price_coins:
                raise PermissionError("Not enough coins.")
            current_user.coins -= item.price_coins

        purchase = UserPurchase(user_id=current_user.id, item_id=item.id)
        db.add(current_user)
        db.add(purchase)
        await db.flush()

        return PurchaseData(
            success=True,
            remaining_coins=current_user.coins,
            purchased_item=ShopItemData(
                id=item.id,
                name=item.name,
                description=item.description,
                item_type=item.item_type,
                price_coins=item.price_coins,
                thumbnail=item.thumbnail,
                is_active=item.is_active,
                is_purchased=True,
            ),
        )

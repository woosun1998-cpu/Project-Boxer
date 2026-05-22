from pydantic import BaseModel, ConfigDict, Field


class ShopItemData(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None
    item_type: str
    price_coins: int
    thumbnail: str | None
    is_active: bool
    is_purchased: bool = False


class ShopItemsResponse(BaseModel):
    success: bool
    message: str
    data: list[ShopItemData]


class PurchaseRequest(BaseModel):
    item_id: int
    payment_type: str = Field(pattern="^(coin|premium_upgrade)$")


class PurchaseData(BaseModel):
    success: bool
    remaining_coins: int
    purchased_item: ShopItemData


class PurchaseResponse(BaseModel):
    success: bool
    message: str
    data: PurchaseData

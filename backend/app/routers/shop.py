from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.shop import PurchaseRequest, PurchaseResponse, ShopItemsResponse
from app.services.shop_service import ShopService
from app.utils.dependencies import get_current_user


router = APIRouter()
shop_service = ShopService()


@router.get(
    "/items",
    response_model=ShopItemsResponse,
    summary="List shop items",
    description="Return available shop items and whether the current user already purchased them.",
)
async def list_shop_items(
    item_type: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ShopItemsResponse:
    items = await shop_service.list_items(db, current_user, item_type)
    return ShopItemsResponse(
        success=True,
        message="Shop items loaded successfully.",
        data=items,
    )


@router.post(
    "/purchase",
    response_model=PurchaseResponse,
    summary="Purchase shop item",
    description="Purchase a shop item using coins or upgrade the current user to premium.",
)
async def purchase_item(
    payload: PurchaseRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PurchaseResponse:
    try:
        result = await shop_service.purchase(db, current_user, payload)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc

    return PurchaseResponse(
        success=True,
        message="Purchase completed successfully.",
        data=result,
    )

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from fastapi import APIRouter, Depends

from app.database import get_db


router = APIRouter()


@router.get(
    "",
    summary="API health check",
    description="Return a simple health response for the API server.",
)
async def api_health() -> dict[str, str]:
    return {"status": "ok", "service": "boxer-api"}


@router.get(
    "/db",
    summary="Database health check",
    description="Verify that the API can reach the configured database.",
)
async def db_health(db: AsyncSession = Depends(get_db)) -> dict[str, str]:
    await db.execute(text("SELECT 1"))
    return {"status": "ok", "database": "connected"}

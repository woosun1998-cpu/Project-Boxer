from __future__ import annotations

import shutil
import re
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.media_asset import MediaAsset
from app.models.user import User
from app.utils.dependencies import get_current_user


router = APIRouter(prefix="/media", tags=["admin-media"])
_PROJECT_ROOT = Path(__file__).resolve().parents[3]
_UPLOAD_ROOT = _PROJECT_ROOT / "uploads" / "admin"
_SAFE_NAME_RE = re.compile(r"[^A-Za-z0-9._-]+")


class MediaUpdatePayload(BaseModel):
    filename: str | None = Field(default=None, max_length=255)
    type: str | None = Field(default=None, max_length=40)
    category: str | None = Field(default=None, max_length=80)
    thumbnail_url: str | None = Field(default=None, max_length=500)
    duration: float | None = None


def _ensure_admin(current_user: User) -> None:
    if current_user.tier != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access is required.")


def _safe_filename(name: str) -> str:
    cleaned = _SAFE_NAME_RE.sub("_", Path(name).name).strip("._")
    return cleaned or "upload.bin"


def _item(asset: MediaAsset) -> dict:
    return {
        "id": asset.id,
        "filename": asset.filename,
        "file_url": asset.file_url,
        "type": asset.type,
        "category": asset.category,
        "size_bytes": asset.size_bytes,
        "thumbnail_url": asset.thumbnail_url,
        "duration": asset.duration,
        "created_at": asset.created_at.isoformat() if asset.created_at else None,
    }


@router.get("")
async def list_media(
    type: str | None = None,
    category: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _ensure_admin(current_user)
    stmt = select(MediaAsset).order_by(MediaAsset.created_at.desc(), MediaAsset.id.desc())
    if type:
        stmt = stmt.where(MediaAsset.type == type)
    if category:
        stmt = stmt.where(MediaAsset.category == category)
    rows = (await db.execute(stmt)).scalars().all()
    items = [_item(row) for row in rows]
    return {"items": items, "media": items, "success": True}


@router.post("/upload")
async def upload_media(
    file: UploadFile = File(...),
    type: str = Form("file"),
    category: str = Form("general"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _ensure_admin(current_user)
    filename = _safe_filename(file.filename or "upload.bin")
    target_dir = _UPLOAD_ROOT / type / category
    target_dir.mkdir(parents=True, exist_ok=True)
    target = target_dir / filename
    suffix = target.suffix
    stem = target.stem
    counter = 1
    while target.exists():
        target = target_dir / f"{stem}_{counter}{suffix}"
        counter += 1
    with target.open("wb") as out:
        shutil.copyfileobj(file.file, out)
    rel = target.relative_to(_PROJECT_ROOT).as_posix()
    asset = MediaAsset(
        filename=target.name,
        file_url=f"/{rel}",
        type=type,
        category=category,
        size_bytes=target.stat().st_size,
    )
    db.add(asset)
    await db.flush()
    await db.refresh(asset)
    item = _item(asset)
    return {"success": True, "item": item, **item}


@router.put("/{asset_id}")
async def update_media(
    asset_id: int,
    payload: MediaUpdatePayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _ensure_admin(current_user)
    asset = await db.get(MediaAsset, asset_id)
    if asset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media asset not found.")
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        if value is not None:
            setattr(asset, key, value)
    await db.flush()
    await db.refresh(asset)
    return {"success": True, "item": _item(asset)}


@router.delete("/{asset_id}")
async def delete_media(
    asset_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _ensure_admin(current_user)
    asset = await db.get(MediaAsset, asset_id)
    if asset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media asset not found.")
    await db.delete(asset)
    await db.flush()
    return {"success": True, "data": {"id": asset_id}}

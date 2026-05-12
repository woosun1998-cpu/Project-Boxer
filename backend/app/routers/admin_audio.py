from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.media_asset import MediaAsset
from app.models.user import User
from app.routers.admin_media import _UPLOAD_ROOT, _ensure_admin, _item, _safe_filename
from app.utils.dependencies import get_current_user


router = APIRouter(prefix="/audio", tags=["admin-audio"])


class AudioUpdatePayload(BaseModel):
    filename: str | None = Field(default=None, max_length=255)
    category: str | None = Field(default=None, max_length=80)
    duration: float | None = None


@router.get("")
async def list_audio(
    category: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _ensure_admin(current_user)
    stmt = select(MediaAsset).where(MediaAsset.type == "audio").order_by(MediaAsset.created_at.desc(), MediaAsset.id.desc())
    if category:
        stmt = stmt.where(MediaAsset.category == category)
    rows = (await db.execute(stmt)).scalars().all()
    items = [_item(row) for row in rows]
    return {"items": items, "audio": items, "success": True}


@router.post("/upload")
async def upload_audio(
    file: UploadFile = File(...),
    category: str = Form("bgm"),
    duration: float | None = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _ensure_admin(current_user)
    filename = _safe_filename(file.filename or "audio.bin")
    target_dir = _UPLOAD_ROOT / "audio" / category
    target_dir.mkdir(parents=True, exist_ok=True)
    target = target_dir / filename
    suffix = target.suffix
    stem = target.stem
    counter = 1
    while target.exists():
        target = target_dir / f"{stem}_{counter}{suffix}"
        counter += 1
    with target.open("wb") as out:
        while chunk := await file.read(1024 * 1024):
            out.write(chunk)
    from pathlib import Path
    project_root = Path(__file__).resolve().parents[3]
    rel = target.relative_to(project_root).as_posix()
    asset = MediaAsset(
        filename=target.name,
        file_url=f"/{rel}",
        type="audio",
        category=category,
        duration=duration,
        size_bytes=target.stat().st_size,
    )
    db.add(asset)
    await db.flush()
    await db.refresh(asset)
    item = _item(asset)
    return {"success": True, "item": item, **item}


@router.put("/{asset_id}")
async def update_audio(
    asset_id: int,
    payload: AudioUpdatePayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _ensure_admin(current_user)
    asset = await db.get(MediaAsset, asset_id)
    if asset is None or asset.type != "audio":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Audio asset not found.")
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        if value is not None:
            setattr(asset, key, value)
    await db.flush()
    await db.refresh(asset)
    return {"success": True, "item": _item(asset)}


@router.delete("/{asset_id}")
async def delete_audio(
    asset_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _ensure_admin(current_user)
    asset = await db.get(MediaAsset, asset_id)
    if asset is None or asset.type != "audio":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Audio asset not found.")
    await db.delete(asset)
    await db.flush()
    return {"success": True, "data": {"id": asset_id}}

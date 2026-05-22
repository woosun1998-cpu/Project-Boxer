from __future__ import annotations

import base64
import json
import re
import shutil
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.media_asset import MediaAsset
from app.models.user import User
from app.utils.dependencies import get_current_user


router = APIRouter(prefix="/datasets", tags=["admin-datasets"])
_PROJECT_ROOT = Path(__file__).resolve().parents[3]
_DATASET_ROOT = _PROJECT_ROOT / "dataset" / "admin"
_SAFE_RE = re.compile(r"[^A-Za-z0-9._-]+")


class DatasetFrame(BaseModel):
    filename: str
    label: str
    time_sec: float | None = None
    data_url: str
    dataset_project: str | None = None


class DatasetExportPayload(BaseModel):
    project: str = "user_action"
    source_name: str = "dataset"
    source_type: str | None = None
    source_video_filename: str | None = None
    exported_width: int | None = None
    exported_height: int | None = None
    interval_ms: int | None = None
    frames: list[DatasetFrame] = Field(default_factory=list)


class DatasetClipPayload(BaseModel):
    project: str = "user_action"
    source_name: str = "dataset"
    source_video_filename: str
    start_sec: float = 0
    end_sec: float = 0


def _ensure_admin(current_user: User) -> None:
    if current_user.tier != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access is required.")


def _safe(value: str) -> str:
    cleaned = _SAFE_RE.sub("_", value or "dataset").strip("._")
    return cleaned or "dataset"


def _decode_data_url(data_url: str) -> bytes:
    if "," not in data_url:
        raise ValueError("Invalid data URL")
    return base64.b64decode(data_url.split(",", 1)[1])


@router.get("/bootstrap")
async def bootstrap(current_user: User = Depends(get_current_user)) -> dict:
    _ensure_admin(current_user)
    return {
        "success": True,
        "data": {
            "dataset_root": str(_DATASET_ROOT),
            "ffmpeg_available": shutil.which("ffmpeg") is not None,
            "projects": ["user_action", "posture_state"],
        },
    }


@router.post("/upload-video")
async def upload_video(
    project: str = Form("user_action"),
    source_name: str = Form("dataset"),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _ensure_admin(current_user)
    project_name = _safe(project)
    source = _safe(source_name)
    filename = _safe(file.filename or f"{source}.mp4")
    target_dir = _DATASET_ROOT / project_name / source / "raw"
    target_dir.mkdir(parents=True, exist_ok=True)
    target = target_dir / filename
    with target.open("wb") as out:
        shutil.copyfileobj(file.file, out)
    rel = target.relative_to(_PROJECT_ROOT).as_posix()
    asset = MediaAsset(
        filename=target.name,
        file_url=f"/{rel}",
        type="dataset",
        category=project_name,
        size_bytes=target.stat().st_size,
    )
    db.add(asset)
    await db.flush()
    return {
        "success": True,
        "data": {
            "filename": target.name,
            "raw_video_path": str(target),
            "raw_video_url": f"/{rel}",
        },
    }


@router.post("/create-clip")
async def create_clip(payload: DatasetClipPayload, current_user: User = Depends(get_current_user)) -> dict:
    _ensure_admin(current_user)
    project_name = _safe(payload.project)
    source = _safe(payload.source_name)
    raw = _DATASET_ROOT / project_name / source / "raw" / _safe(payload.source_video_filename)
    if not raw.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source video not found.")
    clip_dir = _DATASET_ROOT / project_name / source / "clips"
    clip_dir.mkdir(parents=True, exist_ok=True)
    clip_name = f"{source}_{payload.start_sec:g}_{payload.end_sec:g}{raw.suffix or '.mp4'}"
    clip_path = clip_dir / _safe(clip_name)
    shutil.copy2(raw, clip_path)
    rel = clip_path.relative_to(_PROJECT_ROOT).as_posix()
    return {"success": True, "data": {"clip_path": str(clip_path), "clip_url": f"/{rel}", "ffmpeg_used": False}}


@router.post("/export")
async def export_dataset(
    payload: DatasetExportPayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _ensure_admin(current_user)
    project_name = _safe(payload.project)
    source = _safe(payload.source_name)
    export_dir = _DATASET_ROOT / project_name / source / "frames"
    export_dir.mkdir(parents=True, exist_ok=True)
    saved_items = []
    for frame in payload.frames:
        filename = _safe(frame.filename)
        target = export_dir / filename
        target.write_bytes(_decode_data_url(frame.data_url))
        rel = target.relative_to(_PROJECT_ROOT).as_posix()
        saved_items.append({"filename": filename, "label": frame.label, "time_sec": frame.time_sec, "url": f"/{rel}"})
        db.add(MediaAsset(filename=filename, file_url=f"/{rel}", type="dataset", category=project_name, size_bytes=target.stat().st_size))
    manifest = payload.model_dump(exclude={"frames"})
    manifest["saved_items"] = saved_items
    manifest["saved_count"] = len(saved_items)
    manifest_path = _DATASET_ROOT / project_name / source / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    await db.flush()
    return {"success": True, "data": {**manifest, "manifest_path": str(manifest_path)}}

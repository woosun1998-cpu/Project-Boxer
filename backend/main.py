from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import engine, init_database
from app.routers import admin, admin_videos, auth, coaching, detect, health, leaderboard, sessions, shop, stats, tutorials, users, videos

_PROJECT_ROOT = Path(__file__).resolve().parent.parent
_FRONTEND_DIR = _PROJECT_ROOT / "frontend"


@asynccontextmanager
async def lifespan(_: FastAPI):
    await init_database()
    yield
    await engine.dispose()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="AI boxing training backend API for the Boxer project.",
    lifespan=lifespan,
)

# DEBUG일 때 localhost/127.0.0.1 + 임의 포트(예: http.server 5501)에서 프론트를 열어도
# /api/detect 등 크로스 오리진 요청이 CORS로 막히지 않도록 정규식을 추가합니다.
_cors = dict(
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# Starlette는 allow_origin_regex에 re.fullmatch()를 쓰므로 전체 Origin 문자열이
# 끝까지 맞아야 합니다. (:\d+)? 뒤에 $ 없이 두면 "http://localhost:5501"에서
# 포트가 잡히지 않고 fullmatch가 실패 → CORS 헤더가 붙지 않습니다.
if settings.DEBUG:
    _cors["allow_origin_regex"] = r"https?://(localhost|127\.0\.0\.1)(:\d+)?$"

app.add_middleware(CORSMiddleware, **_cors)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(tutorials.router, prefix="/api/tutorials", tags=["tutorials"])
app.include_router(videos.router, prefix="/api/videos", tags=["videos"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(admin_videos.router, prefix="/api/admin", tags=["admin"])
app.include_router(sessions.router, prefix="/api/sessions", tags=["sessions"])
app.include_router(stats.router, prefix="/api/stats", tags=["stats"])
app.include_router(leaderboard.router, prefix="/api/leaderboard", tags=["leaderboard"])
app.include_router(health.router, prefix="/api/health", tags=["health"])
app.include_router(coaching.router, prefix="/api/coaching", tags=["coaching"])
app.include_router(shop.router, prefix="/api/shop", tags=["shop"])
app.include_router(detect.router, prefix="/api/detect", tags=["detect"])

# API·/docs 등이 먼저 매칭되고, 나머지 경로는 frontend 정적 파일( index.html 등 )로 넘깁니다.
if _FRONTEND_DIR.is_dir():
    app.mount(
        "/",
        StaticFiles(directory=str(_FRONTEND_DIR), html=True),
        name="frontend",
    )

# BACKEND.md - Codex 전용 작업 지시서
## Boxer 백엔드 FastAPI (Python) MySQL

> 이 파일은 Codex가 백엔드 작업 시 읽는 파일입니다.
> 프론트엔드 작업은 FRONTEND.md를 읽으세요.
> 전체 컨텍스트는 CLAUDE.md를 먼저 읽으세요.

---

## 기술 스펙

| 항목 | 버전 / 설정 |
|------|------------|
| Python | 3.11+ |
| 웹 프레임워크 | FastAPI 0.110.x |
| ASGI 서버 | Uvicorn 0.29.x |
| DB 드라이버 | aiomysql (비동기) + PyMySQL |
| ORM | SQLAlchemy 2.x (비동기 Core) |
| 마이그레이션 | Alembic |
| 인증 | python-jose (JWT) + passlib (bcrypt) |
| 유효성 검사 | Pydantic v2 |
| AI | google-generativeai (Gemini) |
| HTTP 클라이언트 | httpx |
| 기본 포트 | 8000 |
| DB 이름 | boxer_db |

---

## requirements.txt

```
fastapi==0.110.0
uvicorn[standard]==0.29.0
sqlalchemy==2.0.29
aiomysql==0.2.0
pymysql==1.1.0
alembic==1.13.1
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.9
pydantic==2.6.4
pydantic-settings==2.2.1
httpx==0.27.0
google-generativeai==0.5.0
python-dotenv==1.0.1
```

```bash
pip install -r requirements.txt
```

---

## 환경 설정 (.env)

```
APP_NAME=Boxer API
APP_VERSION=3.0.0
DEBUG=True
HOST=0.0.0.0
PORT=8000

DB_HOST=localhost
DB_PORT=3306
DB_NAME=boxer_db
DB_USER=root
DB_PASSWORD=YOUR_PASSWORD
DATABASE_URL=mysql+aiomysql://root:YOUR_PASSWORD@localhost:3306/boxer_db?charset=utf8mb4

JWT_SECRET_KEY=boxer-super-secret-key-2026-must-be-256-bits-long!!
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=1440

CORS_ORIGINS=["http://localhost:3000","http://localhost:5500","http://127.0.0.1:5500"]

GEMINI_API_KEY=YOUR_GEMINI_API_KEY
```

---

## 프로젝트 폴더 구조

```
backend/
├── main.py                       ← FastAPI 앱 진입점
├── requirements.txt
├── .env
├── alembic.ini
├── alembic/
│   └── versions/                 ← DB 마이그레이션
│
├── app/
│   ├── __init__.py
│   ├── config.py                 ← 환경변수 (Pydantic Settings)
│   ├── database.py               ← 비동기 DB 연결
│   │
│   ├── models/                   ← SQLAlchemy 테이블 모델
│   │   ├── user.py
│   │   ├── tutorial.py
│   │   ├── video.py
│   │   ├── session.py
│   │   ├── leaderboard.py
│   │   └── shop.py
│   │
│   ├── schemas/                  ← Pydantic 요청/응답 스키마
│   │   ├── auth.py
│   │   ├── tutorial.py
│   │   ├── video.py
│   │   ├── session.py
│   │   ├── stats.py
│   │   ├── leaderboard.py
│   │   └── shop.py
│   │
│   ├── routers/                  ← API 라우터 (Controller 역할)
│   │   ├── auth.py
│   │   ├── users.py
│   │   ├── tutorials.py
│   │   ├── videos.py
│   │   ├── sessions.py
│   │   ├── stats.py
│   │   ├── leaderboard.py
│   │   ├── coaching.py
│   │   └── shop.py
│   │
│   ├── services/                 ← 비즈니스 로직
│   │   ├── auth_service.py
│   │   ├── tutorial_service.py
│   │   ├── session_service.py
│   │   ├── stats_service.py
│   │   ├── leaderboard_service.py
│   │   ├── gemini_service.py
│   │   └── shop_service.py
│   │
│   └── utils/
│       ├── jwt.py                ← JWT 생성/검증
│       ├── security.py           ← bcrypt 해싱
│       └── dependencies.py       ← FastAPI Depends 함수
│
└── docker/
    ├── Dockerfile
    ├── docker-compose.yml
    └── nginx.conf
```

---

## 핵심 구현 코드

### main.py

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import (
    auth, users, tutorials, videos,
    sessions, stats, leaderboard, coaching, shop
)

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="AI 기반 복싱 스파링 & 코칭 플랫폼 API"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,        prefix="/api/auth",        tags=["인증"])
app.include_router(users.router,       prefix="/api/users",       tags=["유저"])
app.include_router(tutorials.router,   prefix="/api/tutorials",   tags=["튜토리얼"])
app.include_router(videos.router,      prefix="/api/videos",      tags=["영상"])
app.include_router(sessions.router,    prefix="/api/sessions",    tags=["세션"])
app.include_router(stats.router,       prefix="/api/stats",       tags=["통계"])
app.include_router(leaderboard.router, prefix="/api/leaderboard", tags=["랭킹"])
app.include_router(coaching.router,    prefix="/api/coaching",    tags=["AI코칭"])
app.include_router(shop.router,        prefix="/api/shop",        tags=["샵"])

@app.get("/")
async def root():
    return {"message": "Boxer API v3.0 - Ready to Fight!"}
```

---

### app/config.py

```python
from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    APP_NAME: str = "Boxer API"
    APP_VERSION: str = "3.0.0"
    DEBUG: bool = True
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    DATABASE_URL: str
    DB_HOST: str = "localhost"
    DB_PORT: int = 3306
    DB_NAME: str = "boxer_db"
    DB_USER: str = "root"
    DB_PASSWORD: str

    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 1440

    CORS_ORIGINS: List[str] = ["http://localhost:5500"]
    GEMINI_API_KEY: str = ""

    class Config:
        env_file = ".env"

settings = Settings()
```

---

### app/database.py

```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True
)

AsyncSessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

class Base(DeclarativeBase):
    pass

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
```

---

### app/utils/jwt.py

```python
from datetime import datetime, timedelta
from jose import JWTError, jwt
from app.config import settings

def create_access_token(user_id: int, username: str) -> str:
    payload = {
        "sub": str(user_id),
        "username": username,
        "exp": datetime.utcnow() + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except JWTError:
        return None

def get_user_id(token: str) -> int | None:
    payload = decode_token(token)
    return int(payload.get("sub")) if payload else None
```

---

### app/utils/security.py

```python
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)
```

---

### app/utils/dependencies.py

```python
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.user import User
from app.utils.jwt import decode_token

bearer_scheme = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    """현재 로그인 유저 반환 - 모든 인증 필요 엔드포인트에서 사용"""
    payload = decode_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="유효하지 않은 토큰입니다.")
    result = await db.execute(select(User).where(User.id == int(payload["sub"])))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다.")
    return user

async def get_premium_user(current_user: User = Depends(get_current_user)) -> User:
    """프리미엄 유저만 허용"""
    if current_user.tier != "premium":
        raise HTTPException(status_code=403, detail="프리미엄 구독이 필요합니다.")
    return current_user
```

---

### app/models/user.py (SQLAlchemy 모델 예시)

```python
from sqlalchemy import Column, Integer, String, Enum, TIMESTAMP
from sqlalchemy.sql import func
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id            = Column(Integer, primary_key=True, autoincrement=True)
    username      = Column(String(50), nullable=False, unique=True)
    email         = Column(String(100), nullable=False, unique=True)
    password_hash = Column(String(255), nullable=False)
    tier          = Column(Enum("free", "premium"), default="free")
    coins         = Column(Integer, default=0)
    injury_type   = Column(String(100))
    skill_level   = Column(Enum("beginner", "intermediate", "advanced"), default="beginner")
    profile_image = Column(String(255))
    created_at    = Column(TIMESTAMP, server_default=func.now())
```

---

### app/schemas/video.py (1:N 응답 예시)

```python
from pydantic import BaseModel
from typing import List

class TimestampSchema(BaseModel):
    id: int
    impact_time: float
    dodge_window_ms: int
    hitbox_radius: float
    attack_type: str | None

    class Config:
        from_attributes = True   # Pydantic v2 - orm_mode 대체

class VideoDetailResponse(BaseModel):
    id: int
    title: str
    file_path: str
    attack_type: str | None
    difficulty: str
    duration_sec: float | None
    timestamps: List[TimestampSchema]

    class Config:
        from_attributes = True
```

---

### app/services/gemini_service.py

```python
import google.generativeai as genai
import json
from app.config import settings

class GeminiService:
    def __init__(self):
        genai.configure(api_key=settings.GEMINI_API_KEY)
        self.model = genai.GenerativeModel("gemini-pro")

    async def get_coaching(self, user_stats: dict) -> dict:
        """유저 통계 기반 개인화 코칭 생성"""
        win_pct = round(user_stats.get("win_rate", 0) * 100, 1)
        avg_ms  = round(user_stats.get("avg_reaction_ms", 0))
        combo   = user_stats.get("max_combo", 0)
        weak    = user_stats.get("weak_attack", "없음")

        prompt = (
            "당신은 프로 복싱 코치입니다.\n"
            "아래 데이터를 분석해서 JSON 형식으로만 응답하세요.\n\n"
            "유저 통계:\n"
            "- 회피율: " + str(win_pct) + "%\n"
            "- 평균 반응속도: " + str(avg_ms) + "ms\n"
            "- 최고 콤보: " + str(combo) + "\n"
            "- 취약 공격 유형: " + weak + "\n\n"
            "응답 형식 (JSON만):\n"
            '{\n'
            '  "advice": "이번 주 핵심 조언 2-3문장",\n'
            '  "focus_area": "집중할 기술명",\n'
            '  "next_goal": "구체적인 다음 목표"\n'
            '}'
        )
        try:
            response = self.model.generate_content(prompt)
            text = response.text.strip()
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0].strip()
            return json.loads(text)
        except Exception:
            return {
                "advice": "꾸준한 훈련이 최고입니다. 매일 조금씩 연습하세요!",
                "focus_area": "기본 가드 자세",
                "next_goal": "회피율 70% 달성"
            }
```

---

## 모듈별 Codex 프롬프트

---

### MODULE 1: 인증 (Auth)

```
CLAUDE.md와 BACKEND.md를 읽었어.
FastAPI 인증 모듈을 구현해줘.

파일:
- app/routers/auth.py
- app/services/auth_service.py
- app/schemas/auth.py (SignupRequest, LoginRequest, AuthResponse)
- app/models/user.py
- app/utils/jwt.py, security.py (위 코드 그대로)

API:
- POST /api/auth/signup  -> 회원가입
  body: { username, email, password }
  응답: { success, message, data: { user_id, username, token } }

- POST /api/auth/login   -> 로그인 (JWT 반환)
  body: { email, password }
  응답: { success, message, data: { token, user_id, username, tier } }

요구사항:
- Pydantic v2, SQLAlchemy 비동기 쿼리
- username/email 중복 -> 409 에러 (한국어 메시지)
- 비밀번호 불일치 -> 401 에러 (한국어 메시지)
- 응답: { success: bool, message: str, data: ... } 구조
- boxer_db users 테이블 사용
```

---

### MODULE 2: 튜토리얼 (Tutorial)

```
CLAUDE.md와 BACKEND.md를 읽었어.
튜토리얼 모듈을 FastAPI로 구현해줘.

API:
- GET  /api/tutorials           -> 목록 (free 유저: is_premium=False만)
- GET  /api/tutorials/{id}      -> 상세 (target_pose_json 포함)
- POST /api/tutorials/{id}/complete
  body: { accuracy: float, attempts: int }
  로직: user_progress upsert + coins/exp 지급
  응답: { exp_earned, coins_earned, best_accuracy }
- GET  /api/users/me/progress   -> 나의 전체 진행도

파일:
- app/routers/tutorials.py
- app/services/tutorial_service.py
- app/schemas/tutorial.py
- app/models/tutorial.py (BoxingTutorial, UserProgress)

요구사항:
- Depends(get_current_user) 인증 필수
- target_pose_json: JSON 타입 저장/반환
- Pydantic v2 from_attributes = True
```

---

### MODULE 3: 게임 세션 + 영상

```
CLAUDE.md와 BACKEND.md를 읽었어.
게임 핵심 API를 FastAPI로 구현해줘.

API:
1. GET  /api/videos             -> 영상 목록 (difficulty 필터)
2. GET  /api/videos/{id}        -> 영상 + 타임스탬프 배열 (VideoDetailResponse)
3. POST /api/sessions           -> 세션 시작
   body: { session_type: "sparring"|"tutorial"|"rehab" }
   응답: { session_id, started_at }
4. PUT  /api/sessions/{id}/end  -> 세션 종료
   body: { total_score, max_combo, total_rounds, exp_earned }
5. POST /api/rounds             -> 라운드 결과 저장
   body: { session_id, video_id, result, reaction_ms,
           score_earned, combo_at_time, nose_x, nose_y }
6. POST /api/pose-corrections   -> 자세 교정 데이터 저장

파일:
- app/routers/videos.py, sessions.py
- app/services/session_service.py
- app/schemas/video.py (VideoDetailResponse 위 코드 그대로), session.py
- app/models/video.py, session.py

요구사항:
- 인증 필수, 세션 소유권 확인
- 영상+타임스탬프: selectinload 또는 JOIN으로 한번에 로드
```

---

### MODULE 4: 통계 & 랭킹

```
CLAUDE.md와 BACKEND.md를 읽었어.
통계 & 랭킹 API를 FastAPI로 구현해줘.

API:
1. GET /api/stats/me
   응답: {
     total_score, max_combo, total_dodges, total_hits,
     win_rate, total_sessions,
     weekly_stats: [{ date, dodge_rate, avg_reaction_ms }],
     attack_type_stats: [{ type, success_rate }]
   }

2. GET /api/leaderboard?limit=100
   응답: [{ rank, username, total_score, max_combo, rank_tier }]

3. PUT /api/leaderboard/me
   body: { total_score, max_combo, total_dodges, win_rate }
   랭크 자동 계산:
     0~499     -> Bronze
     500~1499  -> Silver
     1500~2999 -> Gold
     3000~5999 -> Platinum
     6000+     -> Diamond

통계 쿼리 예시 (SQLAlchemy text() 사용):
from sqlalchemy import text

sql = text("""
    SELECT DATE(rr.recorded_at) as date,
           ROUND(SUM(rr.result='dodge')/COUNT(*), 3) as dodge_rate,
           ROUND(AVG(rr.reaction_ms), 0) as avg_reaction_ms
    FROM round_results rr
    JOIN training_sessions ts ON rr.session_id = ts.id
    WHERE ts.user_id = :user_id
      AND rr.recorded_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    GROUP BY DATE(rr.recorded_at)
    ORDER BY date
""")
rows = (await db.execute(sql, {"user_id": user.id})).mappings().all()
```

---

### MODULE 5: Gemini AI 코칭

```
CLAUDE.md와 BACKEND.md를 읽었어.
Gemini AI 코칭 API를 FastAPI로 구현해줘.

API:
- POST /api/coaching
  body: {} (JWT에서 user_id 자동 추출)
  응답: { advice, focus_area, next_goal }

로직:
1. 최근 10세션 통계 조회
2. 취약 공격 유형 분석 (hit가 많은 attack_type 추출)
3. GeminiService.get_coaching(user_stats) 호출 (위 코드 그대로)
4. JSON 응답 반환

파일:
- app/routers/coaching.py
- app/services/gemini_service.py (위 코드 그대로)
```

---

### MODULE 6: Shop (수익화)

```
CLAUDE.md와 BACKEND.md를 읽었어.
Shop API를 FastAPI로 구현해줘.

API:
- GET  /api/shop/items?item_type=skin
  응답: 상품 목록 + 내 구매 여부 포함

- POST /api/shop/purchase
  body: { item_id: int, payment_type: "coin" | "premium_upgrade" }
  로직:
    1. 상품 존재 확인
    2. coin: 잔액 확인 -> 차감 -> user_purchases INSERT
    3. premium_upgrade: users.tier = "premium"
    4. 중복 구매 -> 409 에러 (한국어)
  응답: { success, remaining_coins, purchased_item }

추가 테이블 (schema.sql에 포함):
CREATE TABLE shop_items (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  item_type   ENUM('skin','tutorial','report','premium') NOT NULL,
  price_coins INT DEFAULT 0,
  thumbnail   VARCHAR(255),
  is_active   BOOLEAN DEFAULT TRUE
);
CREATE TABLE user_purchases (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT NOT NULL,
  item_id      INT NOT NULL,
  purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (item_id) REFERENCES shop_items(id)
);
```

---

### MODULE 7: Docker 배포

```
CLAUDE.md와 BACKEND.md를 읽었어.
Python FastAPI용 Docker 배포 설정을 만들어줘.

1. docker/Dockerfile
   - FROM python:3.11-slim
   - requirements.txt 설치
   - uvicorn main:app --host 0.0.0.0 --port 8000
   - 비루트 사용자 실행

2. docker/docker-compose.yml
   - api 서비스: FastAPI (포트 8000)
   - db 서비스: MySQL 8.0 (포트 3306)
   - volumes: boxer-db-data
   - .env 파일에서 환경변수 읽기
   - healthcheck으로 DB 준비 후 앱 실행

3. docker/nginx.conf
   - /api  -> FastAPI 8000 리버스 프록시
   - /     -> frontend/ 정적 파일 서빙
   - gzip 활성화

4. .env.example
   DB_PASSWORD=
   JWT_SECRET_KEY=
   GEMINI_API_KEY=

요구사항:
- docker-compose up -d 한 번으로 전체 실행
- MySQL 초기화 시 schema.sql 자동 실행 (init 볼륨)
```

---

## Codex 작업 순서

```
STEP 1  -> DB 스키마 실행
           mysql -u root -p boxer_db < app/db/schema.sql

STEP 2  -> 프로젝트 셋업
           pip install -r requirements.txt
           main.py / config.py / database.py 생성

STEP 3  -> 공통 유틸 (jwt.py / security.py / dependencies.py)

STEP 4  -> 인증 모듈 <- 먼저 완성 필수
           uvicorn main:app --reload
           http://localhost:8000/docs 에서 Swagger 확인

STEP 5  -> 영상 + 타임스탬프 API
STEP 6  -> 세션 + 라운드 API
STEP 7  -> 튜토리얼 API
STEP 8  -> 통계 + 랭킹 API
STEP 9  -> Gemini AI 코칭 API
STEP 10 -> Shop API
STEP 11 -> Docker 설정
```

---

## 로컬 실행 방법

```bash
# 1. 가상환경 생성 및 활성화
python -m venv venv
source venv/bin/activate          # Mac/Linux
venv\Scripts\activate             # Windows

# 2. 패키지 설치
pip install -r requirements.txt

# 3. .env 파일 설정
cp .env.example .env
# DB_PASSWORD, JWT_SECRET_KEY 값 입력

# 4. DB 스키마 실행
mysql -u root -p boxer_db < app/db/schema.sql

# 5. 서버 실행
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# 6. Swagger UI 접속
# http://localhost:8000/docs
```

---

## 작업 시 주의사항

1. **async/await 일관성**: 모든 DB 작업은 await 필수. sync 함수 혼용 금지
2. **Pydantic v2**: orm_mode=True 대신 from_attributes=True 사용
3. **SQLAlchemy 비동기**: session.query() 금지 -> await db.execute(select(...)) 사용
4. **한국어 메시지**: 모든 에러/성공 메시지 한국어
5. **의존성 주입**: Depends(get_db), Depends(get_current_user) 적극 활용
6. **트랜잭션**: 다중 테이블 변경 시 async with db.begin(): 사용
7. **환경변수**: 하드코딩 절대 금지, settings.* 에서만 읽기
8. **Swagger 문서**: 각 엔드포인트 summary, description 한국어 작성

---

*BACKEND.md v3.0 (Python/FastAPI) | Codex 전용 | 2026-04-12*
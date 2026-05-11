# BOXER - CLAUDE.md (Master v4.0)
## AI 기반 실시간 복싱 스파링 · 자세교정 · 입문자 코칭 플랫폼
### "복싱을 가장 재미있게 배우는 방법"

---

## 이 파일의 목적

Claude Code / Codex 가 이 프로젝트를 처음 접할 때 가장 먼저 읽는 마스터 컨텍스트 파일입니다.
모든 작업 시작 전 반드시 이 파일을 읽고 프로젝트 구조를 파악한 후 작업하세요.

> 하위 파일 구조
> - CLAUDE.md  <- 지금 이 파일 (전체 컨텍스트 · 마스터)
> - FRONTEND.md <- Claude Code 전용 (프론트엔드 상세 작업 지시서)
> - BACKEND.md  <- Codex 전용 (백엔드 상세 작업 지시서 · Python/FastAPI)

---

## 서비스 핵심 가치 & 수익 모델

### 핵심 3대 가치

| 가치 | 내용 | 기술 구현 |
|------|------|----------|
| Fun (재미) | AI 복서 공격을 피하고 콤보를 쌓는 아케이드 게임 경험 | HP 바 · 콤보 카운터 · 이펙트 애니메이션 |
| Growth (성장) | 밀리초 단위 자세 교정으로 실제 복싱 실력 향상 | MediaPipe Pose · 각도 분석 · 피드백 |
| Monetize (수익) | 구독 · 코인 · 프리미엄 강좌로 지속 수익 창출 | Freemium 모델 · 인앱 결제 설계 |

### 수익 모델 설계

```
FREE TIER
  - 기초 튜토리얼 3개 무료
  - 1일 3판 스파링 제한
  - 기본 자세 교정 (5개 체크포인트)

PREMIUM (월 9,900원)
  - 무제한 스파링
  - 전체 튜토리얼 30개
  - 정밀 자세 분석 리포트 (PDF 다운로드)
  - AI 코치 조언 (Gemini 연동)
  - 랭킹 참여 자격

COIN SHOP
  - 특수 AI 복서 스킨 언락
  - 프리미엄 영상 강좌 개별 구매
  - 자세 분석 리포트 1회권
```

---

## 전체 기술 스택

```
┌─────────────────────────────────────────────────────────┐
│                    BOXER PLATFORM                        │
├─────────────────────────┬───────────────────────────────┤
│    FRONTEND             │    BACKEND                     │
│  (Claude Code 담당)     │  (Codex 담당)                  │
├─────────────────────────┼───────────────────────────────┤
│ HTML5 + CSS3            │ Python 3.11+                   │
│ Vanilla JS (ES6+)       │ FastAPI 0.110.x                │
│ MediaPipe Pose (CDN)    │ SQLAlchemy 2.x (비동기 ORM)   │
│ Chart.js (통계)         │ Alembic (마이그레이션)         │
│ Canvas API (이펙트)     │ MySQL 8.0 (boxer_db)           │
│ Web Audio API (사운드)  │ python-jose (JWT 인증)         │
│ CSS Animations          │ Gemini AI API                  │
│                         │ Uvicorn (ASGI 서버)            │
│                         │ Docker + Nginx                 │
└─────────────────────────┴───────────────────────────────┘
```

---

## 백엔드 핵심 설정 (Python / FastAPI)

### 기술 스펙 요약

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
| 기본 포트 | 8000 |
| DB 이름 | boxer_db |

### requirements.txt

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

### 환경 설정 (.env)

```
APP_NAME=Boxer API
APP_VERSION=4.0.0
DEBUG=True
HOST=0.0.0.0
PORT=8000

DB_HOST=localhost
DB_PORT=3306
DB_NAME=boxer_db
DB_USER=root
DB_PASSWORD=12345
DATABASE_URL=mysql+aiomysql://root:YOUR_PASSWORD@localhost:3306/boxer_db?charset=utf8mb4

JWT_SECRET_KEY=boxer-super-secret-key-2026-must-be-256-bits-long!!
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=1440

CORS_ORIGINS=["http://localhost:3000","http://localhost:5500","http://127.0.0.1:5500"]

GEMINI_API_KEY=YOUR_GEMINI_API_KEY
```

### 로컬 실행 방법

```bash
# 1. 가상환경 생성 및 활성화
python -m venv venv
source venv/bin/activate        # Mac/Linux
venv\Scripts\activate          # Windows

# 2. 패키지 설치
pip install -r requirements.txt

# 3. .env 설정 후 DB 스키마 실행
mysql -u root -p boxer_db < app/db/schema.sql

# 4. 서버 실행
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# 5. Swagger UI 확인
# http://localhost:8000/docs
```

---

## 데이터베이스 전체 스키마 (boxer_db)

### 테이블 목록 (총 11개)

```sql
-- ============================================
-- 0. DB 생성
-- ============================================
CREATE DATABASE IF NOT EXISTS boxer_db
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE boxer_db;

-- ============================================
-- 1. 회원
-- ============================================
CREATE TABLE users (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  username        VARCHAR(50)  NOT NULL UNIQUE,
  email           VARCHAR(100) NOT NULL UNIQUE,
  password_hash   VARCHAR(255) NOT NULL,
  tier            ENUM('free','premium') DEFAULT 'free',
  coins           INT DEFAULT 0,
  injury_type     VARCHAR(100),
  skill_level     ENUM('beginner','intermediate','advanced') DEFAULT 'beginner',
  profile_image   VARCHAR(255),
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 2. 기초 복싱 튜토리얼 (입문자 코칭)
-- ============================================
CREATE TABLE boxing_tutorials (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  title             VARCHAR(100) NOT NULL,
  description       TEXT,
  target_pose_json  JSON,           -- MediaPipe 정답 각도 데이터
  video_url         VARCHAR(255),
  thumbnail_url     VARCHAR(255),
  difficulty_level  INT DEFAULT 1,  -- 1:입문 2:초급 3:중급
  is_premium        BOOLEAN DEFAULT FALSE,
  reward_exp        INT DEFAULT 100,
  reward_coins      INT DEFAULT 10,
  order_sequence    INT DEFAULT 0,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 3. 유저 튜토리얼 진행도
-- ============================================
CREATE TABLE user_progress (
  user_id         INT,
  tutorial_id     INT,
  is_completed    BOOLEAN DEFAULT FALSE,
  best_accuracy   FLOAT,
  attempts        INT DEFAULT 0,
  completed_at    TIMESTAMP,
  PRIMARY KEY (user_id, tutorial_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (tutorial_id) REFERENCES boxing_tutorials(id)
);

-- ============================================
-- 4. 공격 영상 클립 메타데이터
-- ============================================
CREATE TABLE attack_videos (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  title         VARCHAR(100) NOT NULL,
  file_path     VARCHAR(255) NOT NULL,
  attack_type   VARCHAR(50),
  difficulty    ENUM('easy','medium','hard') DEFAULT 'easy',
  duration_sec  DECIMAL(5,2),
  thumbnail_url VARCHAR(255),
  is_premium    BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 5. 타임스탬프 (판정 정답 데이터)
-- ============================================
CREATE TABLE attack_timestamps (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  video_id        INT NOT NULL,
  impact_time     DECIMAL(6,3) NOT NULL,
  dodge_window_ms INT DEFAULT 300,
  hitbox_radius   FLOAT DEFAULT 0.15,
  attack_type     VARCHAR(30),
  FOREIGN KEY (video_id) REFERENCES attack_videos(id)
);

-- ============================================
-- 6. 훈련 세션
-- ============================================
CREATE TABLE training_sessions (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  user_id       INT NOT NULL,
  session_type  ENUM('tutorial','sparring','rehab') NOT NULL,
  started_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ended_at      TIMESTAMP,
  total_score   INT DEFAULT 0,
  max_combo     INT DEFAULT 0,
  total_rounds  INT DEFAULT 0,
  exp_earned    INT DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ============================================
-- 7. 라운드 결과
-- ============================================
CREATE TABLE round_results (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  session_id    INT NOT NULL,
  video_id      INT NOT NULL,
  result        ENUM('dodge','hit') NOT NULL,
  reaction_ms   INT,
  score_earned  INT DEFAULT 0,
  combo_at_time INT DEFAULT 0,
  nose_x        FLOAT,
  nose_y        FLOAT,
  recorded_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES training_sessions(id),
  FOREIGN KEY (video_id) REFERENCES attack_videos(id)
);

-- ============================================
-- 8. 게임 스코어 & 랭킹
-- ============================================
CREATE TABLE leaderboard (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT NOT NULL UNIQUE,
  total_score  BIGINT DEFAULT 0,
  max_combo    INT DEFAULT 0,
  total_dodges INT DEFAULT 0,
  win_rate     FLOAT DEFAULT 0.0,
  rank_tier    ENUM('Bronze','Silver','Gold','Platinum','Diamond') DEFAULT 'Bronze',
  rank_points  INT DEFAULT 0,
  season       INT DEFAULT 1,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ============================================
-- 9. 자세 교정 기록
-- ============================================
CREATE TABLE pose_corrections (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  session_id       INT NOT NULL,
  pose_type        VARCHAR(50),
  accuracy         FLOAT,
  issue_type       VARCHAR(100),
  feedback_message VARCHAR(255),
  severity         ENUM('low','medium','high'),
  recorded_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES training_sessions(id)
);

-- ============================================
-- 10. 샵 아이템
-- ============================================
CREATE TABLE shop_items (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  item_type   ENUM('skin','tutorial','report','premium') NOT NULL,
  price_coins INT DEFAULT 0,
  thumbnail   VARCHAR(255),
  is_active   BOOLEAN DEFAULT TRUE
);

-- ============================================
-- 11. 유저 구매 내역
-- ============================================
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

## 프로젝트 폴더 구조

```
boxer/
├── CLAUDE.md                    <- 마스터 컨텍스트 (이 파일)
├── FRONTEND.md                  <- Claude Code 전용 지시서
├── BACKEND.md                   <- Codex 전용 지시서 (Python/FastAPI)
│
├── backend/                     <- FastAPI 프로젝트 (Python)
│   ├── main.py                  <- FastAPI 앱 진입점
│   ├── requirements.txt
│   ├── .env                     <- 환경변수 (gitignore 필수)
│   ├── .env.example             <- 환경변수 템플릿
│   ├── alembic.ini
│   ├── alembic/
│   │   └── versions/            <- DB 마이그레이션 파일
│   └── app/
│       ├── __init__.py
│       ├── config.py            <- Pydantic Settings (환경변수 로드)
│       ├── database.py          <- SQLAlchemy 비동기 엔진 & 세션
│       ├── models/              <- SQLAlchemy 테이블 모델
│       │   ├── user.py
│       │   ├── tutorial.py
│       │   ├── video.py
│       │   ├── session.py
│       │   ├── leaderboard.py
│       │   └── shop.py
│       ├── schemas/             <- Pydantic v2 요청/응답 스키마
│       │   ├── auth.py
│       │   ├── tutorial.py
│       │   ├── video.py
│       │   ├── session.py
│       │   ├── stats.py
│       │   ├── leaderboard.py
│       │   └── shop.py
│       ├── routers/             <- API 라우터 (Controller 역할)
│       │   ├── auth.py
│       │   ├── users.py
│       │   ├── tutorials.py
│       │   ├── videos.py
│       │   ├── sessions.py
│       │   ├── stats.py
│       │   ├── leaderboard.py
│       │   ├── coaching.py
│       │   └── shop.py
│       ├── services/            <- 비즈니스 로직
│       │   ├── auth_service.py
│       │   ├── tutorial_service.py
│       │   ├── session_service.py
│       │   ├── stats_service.py
│       │   ├── leaderboard_service.py
│       │   ├── gemini_service.py
│       │   └── shop_service.py
│       ├── utils/
│       │   ├── jwt.py           <- JWT 생성/검증 (python-jose)
│       │   ├── security.py      <- bcrypt 비밀번호 해싱
│       │   └── dependencies.py  <- FastAPI Depends (인증 의존성)
│       └── db/
│           └── schema.sql       <- DB 초기화 스크립트
│
├── frontend/                    <- 프론트엔드 (정적 파일)
│   ├── index.html               <- 랜딩 / 로그인 페이지
│   ├── tutorial.html            <- 입문자 코칭 페이지
│   ├── sparring.html            <- 메인 스파링 게임 페이지
│   ├── dashboard.html           <- 통계 & 랭킹 대시보드
│   ├── shop.html                <- 코인 샵 (수익화)
│   ├── css/
│   │   ├── global.css           <- 공통 디자인 시스템
│   │   ├── game.css             <- 게임 UI
│   │   └── tutorial.css         <- 튜토리얼 UI
│   ├── js/
│   │   ├── core/
│   │   │   ├── api.js           <- fetch 래퍼 (JWT 포함, 포트 8000)
│   │   │   └── auth.js          <- 인증 관리
│   │   ├── engine/
│   │   │   ├── GameEngine.js    <- HP · 스코어 · 콤보 상태관리
│   │   │   ├── HitboxJudge.js   <- 회피 판정 알고리즘
│   │   │   ├── VideoPlayer.js   <- 타임스탬프 이벤트
│   │   │   └── PoseTracker.js   <- MediaPipe 포즈 추적
│   │   ├── tutorial/
│   │   │   └── TutorialEngine.js <- 자세 교정 알고리즘
│   │   └── ui/
│   │       ├── effects.js       <- 시각 이펙트 (Canvas)
│   │       └── sound.js         <- 효과음 (Web Audio API)
│   └── assets/
│       ├── videos/              <- 공격 영상 클립
│       ├── sounds/              <- 효과음
│       └── images/              <- UI 이미지
│
├── docker/
│   ├── Dockerfile               <- Python 3.11-slim 기반
│   ├── docker-compose.yml       <- api + db 서비스
│   └── nginx.conf               <- /api -> 8000, / -> frontend
│
└── .gitignore                   <- .env, venv/, __pycache__/ 포함 필수
```

---

## API 엔드포인트 전체 목록

```
AUTH                               포트: 8000
  POST   /api/auth/signup          회원가입
  POST   /api/auth/login           로그인 (JWT 반환)

USER
  GET    /api/users/me             내 프로필
  PUT    /api/users/me             프로필 수정
  GET    /api/users/me/progress    나의 튜토리얼 진행도

TUTORIAL
  GET    /api/tutorials            튜토리얼 목록 (tier 필터 포함)
  GET    /api/tutorials/{id}       튜토리얼 상세 (target_pose_json 포함)
  POST   /api/tutorials/{id}/complete  완료 처리 + EXP/코인 지급

GAME
  GET    /api/videos               영상 목록 (difficulty 필터)
  GET    /api/videos/{id}          영상 + 타임스탬프 배열 반환
  POST   /api/sessions             세션 시작
  PUT    /api/sessions/{id}/end    세션 종료
  POST   /api/rounds               라운드 결과 저장
  POST   /api/pose-corrections     자세 교정 데이터 저장

STATS & RANKING
  GET    /api/stats/me             나의 통계 (30일 트렌드 포함)
  GET    /api/leaderboard          글로벌 랭킹 TOP 100
  PUT    /api/leaderboard/me       내 랭킹 업데이트 (랭크 자동 계산)

AI COACHING
  POST   /api/coaching             Gemini AI 개인화 코칭 조언

SHOP (수익화)
  GET    /api/shop/items           샵 아이템 목록
  POST   /api/shop/purchase        구매 처리 (코인 차감 / 프리미엄 업그레이드)

Swagger UI: http://localhost:8000/docs  (FastAPI 자동 생성)
```

---

## 랭크 티어 계산 기준

| 랭크 포인트 | 티어 |
|------------|------|
| 0 ~ 499 | Bronze |
| 500 ~ 1499 | Silver |
| 1500 ~ 2999 | Gold |
| 3000 ~ 5999 | Platinum |
| 6000+ | Diamond |

---

## 디자인 시스템 (Design Tokens)

```css
/* global.css 에 적용할 CSS 변수 - 다크 스포츠 테마 */
:root {
  --color-bg-primary:      #0A0A0F;   /* 거의 블랙 */
  --color-bg-secondary:    #12121A;   /* 카드 배경 */
  --color-bg-tertiary:     #1A1A28;   /* 인풋·버튼 배경 */
  --color-accent-red:      #FF2D55;   /* 메인 레드 (공격·위험) */
  --color-accent-blue:     #007AFF;   /* 메인 블루 (플레이어) */
  --color-accent-gold:     #FFD60A;   /* 골드 (랭킹·보상) */
  --color-accent-green:    #30D158;   /* 그린 (성공·회피) */
  --color-text-primary:    #FFFFFF;
  --color-text-secondary:  #8E8E93;
  --color-border:          rgba(255,255,255,0.08);

  /* 타이포그래피 */
  --font-display: 'Bebas Neue', 'Arial Black', sans-serif;
  --font-body:    'Inter', -apple-system, sans-serif;
  --font-mono:    'JetBrains Mono', monospace;

  /* 스페이싱 */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 20px;
  --radius-xl: 32px;

  /* 글로우 그림자 */
  --shadow-glow-red:  0 0 20px rgba(255,45,85,0.4);
  --shadow-glow-blue: 0 0 20px rgba(0,122,255,0.4);
  --shadow-glow-gold: 0 0 20px rgba(255,214,10,0.4);
}
```

---

## 개발 원칙 & 공통 규칙

### Claude Code (프론트엔드) 규칙
1. 작업 시작 전: CLAUDE.md 읽기 -> FRONTEND.md 읽기
2. API 호출 포트는 8000 (FastAPI) 로 통일
3. 모든 fetch 요청은 js/core/api.js 래퍼 사용
4. JWT 토큰은 localStorage에 'boxer_token' 키로 저장
5. 한국어 주석 필수 (JS 파일 전체)
6. 다크 테마 CSS 변수 100% 적용
7. 에러 처리: try-catch + toast 메시지 표시

### Codex (백엔드) 규칙
1. 작업 시작 전: CLAUDE.md 읽기 -> BACKEND.md 읽기
2. async/await 일관성: 모든 DB 작업에 await 필수
3. Pydantic v2: from_attributes = True (orm_mode 사용 금지)
4. SQLAlchemy 비동기: session.query() 금지, await db.execute() 사용
5. 환경변수: 하드코딩 절대 금지, settings.* 에서만 읽기
6. 의존성 주입: Depends(get_db), Depends(get_current_user) 적극 활용
7. 한국어 메시지: 모든 에러/성공 응답 한국어
8. Swagger 문서: 각 엔드포인트 summary/description 한국어 작성

### 공통 규칙
1. 기존 코드 구조 유지 (추가 시 기존 파일 패턴 따르기)
2. 커밋 단위: 기능 하나 완성 후 즉시 git commit
3. .env 파일 절대 git push 금지 (.gitignore 필수)
4. 인코딩: UTF-8 / UTF8MB4 일관 적용

---

## .gitignore 필수 내용

```
.env
__pycache__/
*.pyc
*.pyo
venv/
.venv/
*.egg-info/
.DS_Store
node_modules/
*.log
```

---

*Master v4.0 | Python/FastAPI 백엔드 기준 | 2026-04-12 | 담당: 소연*
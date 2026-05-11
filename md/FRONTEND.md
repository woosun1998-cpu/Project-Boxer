# 🎮 FRONTEND.md — Claude Code 전용 작업 지시서
## Boxer 프론트엔드 · UI/UX · 게임 엔진

> **이 파일은 Claude Code가 프론트엔드 작업 시 읽는 파일입니다.**
> 백엔드 작업은 `BACKEND.md`를 읽으세요.
> 전체 컨텍스트는 `CLAUDE.md`를 먼저 읽으세요.

---

## 🎨 디자인 철학

### 컨셉: "다크 아케이드 스포츠"
- 어두운 배경 + 형광 액센트 (레드·블루·골드)
- 게임 UI처럼 역동적, 스포츠 앱처럼 신뢰감
- 모바일 퍼스트 (터치 최적화), 웹캠 UI 고려
- 애니메이션은 60fps 목표, `requestAnimationFrame` 사용

### UI 컴포넌트 패턴
```css
/* 카드 컴포넌트 공통 스타일 */
.card {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 1.5rem;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-glow-blue);
}

/* 버튼 공통 스타일 */
.btn-primary {
  background: var(--color-accent-red);
  color: white;
  border: none;
  border-radius: var(--radius-sm);
  padding: 14px 28px;
  font-family: var(--font-body);
  font-weight: 600;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: var(--shadow-glow-red);
}
.btn-primary:hover { transform: scale(1.03); }
.btn-primary:active { transform: scale(0.97); }
```

---

## 📄 페이지별 작업 명세

---

### PAGE 1: `index.html` — 랜딩 & 로그인

**UX 목표**: 3초 안에 "이게 뭔지" 이해 + 즉시 시작 버튼 클릭

**레이아웃**:
```
┌──────────────────────────────────┐
│  BOXER 로고         로그인 버튼  │
├──────────────────────────────────┤
│                                  │
│  [배경: 복서 실루엣 애니메이션]  │
│                                  │
│  "AI와 싸워라. 진짜 실력이 된다" │
│                                  │
│  ┌──────────┐  ┌──────────────┐  │
│  │ 무료시작 │  │ 프리미엄 보기│  │
│  └──────────┘  └──────────────┘  │
│                                  │
│  [기능 소개 3칸 카드]            │
│  재미 | 성장 | 수익              │
│                                  │
│  [시작 프로세스: 1→2→3 스텝]    │
│                                  │
│  [실사용 화면 목업 스크린샷]     │
└──────────────────────────────────┘
```

**Claude Code 프롬프트**:
```
CLAUDE.md와 FRONTEND.md를 읽었어.
index.html을 만들어줘.

요구사항:
1. 다크 테마 (--color-bg-primary: #0A0A0F 배경)
2. 상단 네비게이션: BOXER 로고(좌) + 로그인/회원가입 버튼(우)
3. 히어로 섹션:
   - 배경: CSS로 복서 실루엣 (clip-path 또는 SVG)
   - 타이틀: "AI와 싸워라. 진짜 실력이 된다" (Bebas Neue 폰트, 64px)
   - 서브타이틀: "MediaPipe AI가 당신의 자세를 실시간으로 교정합니다"
   - CTA 버튼 2개: "무료로 시작하기" (레드), "프리미엄 보기" (아웃라인)
4. 기능 소개 3칸 카드: 재미/성장/수익 각각 아이콘+제목+설명
5. 3단계 프로세스 섹션: ①카메라 켜기 ②AI 공격 피하기 ③실력 성장 확인
6. 하단: 로그인 모달 (JWT fetch 연동 준비)
global.css 디자인 변수 적용해줘.
```

---

### PAGE 2: `tutorial.html` — 입문자 코칭 페이지

**UX 목표**: 복싱을 처음 접하는 사람이 5분 안에 기본 자세 3개 배우기

**레이아웃**:
```
┌──────────────────────────────────────┐
│ [진행 바]  Step 1 of 5   [뒤로] [X] │
├────────────────┬─────────────────────┤
│                │                     │
│  [튜토리얼     │  [실시간 웹캠        │
│   영상 재생]   │   + 스켈레톤]       │
│                │                     │
│                │  자세 일치도: 87%   │
│                │  ████████░░         │
├────────────────┴─────────────────────┤
│  💡 "양 손목을 코 높이까지 올리세요" │
│                                      │
│  [체크리스트]                        │
│  ✅ 발 너비 어깨 넓이                │
│  ✅ 왼손 앞으로                      │
│  ⬜ 가드 코 높이 이상                │
│                                      │
│  [3초 유지하면 완료!] [진행도 바]   │
└──────────────────────────────────────┘
```

**핵심 알고리즘 (TutorialEngine.js)**:
```javascript
// TutorialEngine.js — 자세 교정 알고리즘
class TutorialEngine {
  constructor(tutorialData) {
    // target_pose_json에서 정답 각도 로드
    this.targetPose = tutorialData.target_pose_json;
    this.holdDuration = 3000; // 3초 유지 필요
    this.holdStartTime = null;
    this.successCallback = null;
  }

  // MediaPipe 랜드마크로 자세 체크
  checkPose(landmarks) {
    const checks = {
      guard: this.checkGuard(landmarks),
      stance: this.checkStance(landmarks),
      balance: this.checkBalance(landmarks)
    };

    const accuracy = this.calcAccuracy(checks);
    const feedback = this.generateFeedback(checks);

    // 정확도 85% 이상 + 3초 유지 → 성공
    if (accuracy >= 0.85) {
      if (!this.holdStartTime) this.holdStartTime = Date.now();
      if (Date.now() - this.holdStartTime >= this.holdDuration) {
        this.successCallback?.({ accuracy, checks });
      }
    } else {
      this.holdStartTime = null;
    }

    return { accuracy, feedback, checks };
  }

  // 가드 자세: 양 손목이 코 높이 이상
  checkGuard(landmarks) {
    const leftWrist  = landmarks[15];
    const rightWrist = landmarks[16];
    const nose       = landmarks[0];
    const isOk = leftWrist.y < nose.y && rightWrist.y < nose.y;
    return { ok: isOk, message: isOk ? "완벽한 가드!" : "가드를 더 올리세요" };
  }

  // 스탠스: 발 너비가 어깨 너비 이상
  checkStance(landmarks) {
    const leftFoot   = landmarks[27];
    const rightFoot  = landmarks[28];
    const leftShoulder  = landmarks[11];
    const rightShoulder = landmarks[12];
    const footWidth     = Math.abs(leftFoot.x - rightFoot.x);
    const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
    const isOk = footWidth >= shoulderWidth * 0.9;
    return { ok: isOk, message: isOk ? "발 간격 좋아요!" : "발을 어깨 넓이로 벌리세요" };
  }

  // 밸런스: 무게중심 (엉덩이 중점이 발 중앙에 있는지)
  checkBalance(landmarks) {
    const leftHip  = landmarks[23];
    const rightHip = landmarks[24];
    const hipCenterX = (leftHip.x + rightHip.x) / 2;
    const leftFoot   = landmarks[27];
    const rightFoot  = landmarks[28];
    const footCenterX = (leftFoot.x + rightFoot.x) / 2;
    const isOk = Math.abs(hipCenterX - footCenterX) < 0.08;
    return { ok: isOk, message: isOk ? "무게중심 완벽!" : "체중을 중앙으로" };
  }

  // 정확도 계산 (가중 평균)
  calcAccuracy(checks) {
    const weights = { guard: 0.5, stance: 0.3, balance: 0.2 };
    return Object.entries(checks).reduce((sum, [key, val]) => {
      return sum + (val.ok ? weights[key] : 0);
    }, 0);
  }

  // 피드백 우선순위: 가장 중요한 미달 항목 먼저
  generateFeedback(checks) {
    if (!checks.guard.ok)   return checks.guard.message;
    if (!checks.stance.ok)  return checks.stance.message;
    if (!checks.balance.ok) return checks.balance.message;
    return "완벽합니다! 유지하세요!";
  }
}
```

**Claude Code 프롬프트**:
```
CLAUDE.md와 FRONTEND.md를 읽었어.
tutorial.html과 TutorialEngine.js를 만들어줘.

요구사항:
1. 화면 좌우 분할: 좌=튜토리얼 영상, 우=실시간 웹캠+스켈레톤
2. TutorialEngine.js 클래스 위의 코드 그대로 구현
3. 실시간 자세 일치도 원형 진행 바 (CSS conic-gradient)
4. 피드백 메시지: 화면 하단 중앙, 말풍선 스타일
5. 체크리스트 항목: 각 체크 통과 시 ⬜→✅ 애니메이션
6. "3초 유지" 홀드 타이머 바 (초록색 진행 바)
7. 완료 시: 파티클 이펙트 + "Perfect! +100 EXP" 팝업
8. GET /api/tutorials/{id} 로 튜토리얼 데이터 로드
9. 완료 시 POST /api/tutorials/{id}/complete 호출
다크 테마 적용, 모바일 반응형으로 만들어줘.
```

---

### PAGE 3: `sparring.html` — 메인 스파링 게임

**UX 목표**: 처음 플레이한 사람이 30초 안에 게임 규칙을 이해하고 몰입

**레이아웃**:
```
┌─────────────────────────────────────────────┐
│ [HP 바 ■■■■■■■■░░]  SCORE: 1,250  3 COMBO │
├─────────────────────┬───────────────────────┤
│                     │                       │
│   [AI 공격 영상]    │   [플레이어 웹캠]     │
│                     │   + 스켈레톤 오버레이  │
│   ← 왼쪽 훅!       │                       │
│                     │   코 좌표: 추적 중    │
│                     │                       │
├─────────────────────┴───────────────────────┤
│     [!!! DODGE NOW !!!]  ← 타임스탬프 알림  │
│                                             │
│  [반응속도: 245ms]  [이번 판: 회피 8/10]  │
└─────────────────────────────────────────────┘
```

**핵심 알고리즘 (GameEngine.js + HitboxJudge.js)**:
```javascript
// =============================================
// GameEngine.js — 게임 상태 관리
// =============================================
class BoxingGame {
  constructor(config = {}) {
    this.playerHP    = 100;
    this.score       = 0;
    this.combo       = 0;
    this.maxCombo    = 0;
    this.dodgeCount  = 0;
    this.hitCount    = 0;
    this.isGameOver  = false;
    this.sessionId   = null;

    // 설정값 (난이도별 조정)
    this.hpLoss      = config.hpLoss   ?? 10;    // 피격 시 HP 손실
    this.baseScore   = config.baseScore ?? 100;  // 기본 점수
    this.comboBonus  = config.comboBonus ?? 0.1; // 콤보 가산율
  }

  // AI 공격 판정 결과 처리
  onJudge(result, reactionMs) {
    if (this.isGameOver) return;

    if (result === 'DODGE') {
      this.combo++;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      this.dodgeCount++;

      // 콤보 가산 + 반응속도 보너스
      const speedBonus = reactionMs < 200 ? 1.5 : reactionMs < 300 ? 1.2 : 1.0;
      const earned = Math.floor(this.baseScore * (1 + this.combo * this.comboBonus) * speedBonus);
      this.score += earned;

      this.showEffect('PERFECT!', '#30D158', earned);
    } else {
      this.playerHP = Math.max(0, this.playerHP - this.hpLoss);
      this.combo = 0;
      this.hitCount++;

      this.showEffect('HIT!', '#FF2D55');
      this.shakeScreen();

      if (this.playerHP <= 0) this.triggerKO();
    }

    this.renderUI();
    return { result, score: this.score, combo: this.combo, hp: this.playerHP };
  }

  renderUI() {
    // HP 바 (빨간색으로 변화)
    const hpBar = document.getElementById('hp-bar');
    if (hpBar) {
      hpBar.style.width = this.playerHP + '%';
      hpBar.style.background = this.playerHP > 50 ? '#30D158'
                             : this.playerHP > 25 ? '#FFD60A' : '#FF2D55';
    }
    // 점수 & 콤보
    const scoreEl = document.getElementById('score-display');
    const comboEl = document.getElementById('combo-display');
    if (scoreEl) scoreEl.textContent = this.score.toLocaleString();
    if (comboEl) comboEl.textContent = this.combo > 0 ? `${this.combo} COMBO` : '';
  }

  showEffect(text, color, score = null) {
    const el = document.createElement('div');
    el.className = 'game-effect';
    el.textContent = score ? `${text} +${score}` : text;
    el.style.cssText = `color:${color}; font-size:2rem; font-weight:800;
      position:fixed; top:40%; left:50%; transform:translateX(-50%);
      animation: effectFloat 1.2s forwards; pointer-events:none; z-index:999;`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1200);
  }

  shakeScreen() {
    document.body.style.animation = 'screenShake 0.4s ease';
    setTimeout(() => document.body.style.animation = '', 400);
  }

  triggerKO() {
    this.isGameOver = true;
    // KO 화면 표시 + 결과 저장
    document.getElementById('ko-screen').style.display = 'flex';
    document.getElementById('final-score').textContent = this.score.toLocaleString();
    document.getElementById('final-combo').textContent = this.maxCombo;
    document.getElementById('final-accuracy').textContent =
      Math.round(this.dodgeCount / (this.dodgeCount + this.hitCount) * 100) + '%';
  }
}

// =============================================
// HitboxJudge.js — 회피 판정 알고리즘
// =============================================
class HitboxJudge {
  constructor(config = {}) {
    this.hitboxRadius = config.radius   ?? 0.15;  // 위험 반경 (좁게 = 관대한 판정)
    this.centerX      = config.centerX  ?? 0.5;
    this.centerY      = config.centerY  ?? 0.5;
  }

  // 판정: 코 좌표가 위험구역 밖이면 DODGE
  judge(noseLandmark) {
    if (!noseLandmark) return 'HIT'; // 감지 실패 = 피격
    const dx = noseLandmark.x - this.centerX;
    const dy = noseLandmark.y - this.centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance > this.hitboxRadius ? 'DODGE' : 'HIT';
  }
}

// =============================================
// VideoPlayer.js — 타임스탬프 이벤트 관리
// =============================================
class BoxingVideoPlayer {
  constructor(videoEl, timestamps, onImpact) {
    this.video       = videoEl;
    this.timestamps  = timestamps; // [{impact_time, dodge_window_ms}]
    this.onImpact    = onImpact;
    this.triggered   = new Set(); // 중복 방지
    this.setupEvents();
  }

  setupEvents() {
    this.video.addEventListener('timeupdate', () => {
      const now = this.video.currentTime;
      for (const ts of this.timestamps) {
        const key = `${ts.id}-${ts.impact_time}`;
        if (this.triggered.has(key)) continue;
        if (Math.abs(now - ts.impact_time) < 0.05) {
          this.triggered.add(key);
          this.onImpact(ts);
        }
      }
    });
  }

  play()  { return this.video.play(); }
  pause() { this.video.pause(); }
  reset() { this.video.currentTime = 0; this.triggered.clear(); }
}

// =============================================
// PoseTracker.js — MediaPipe Pose 래퍼
// =============================================
class PoseTracker {
  constructor(videoEl, canvasEl, onPose) {
    this.video   = videoEl;
    this.canvas  = canvasEl;
    this.ctx     = canvasEl.getContext('2d');
    this.onPose  = onPose;   // 매 프레임 랜드마크 전달
    this.pose    = null;
    this.camera  = null;
    this.latestLandmarks = null;
  }

  async init() {
    // MediaPipe Pose 초기화 (CDN)
    this.pose = new Pose({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
    });
    this.pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.7
    });
    this.pose.onResults((results) => this.onResults(results));

    this.camera = new Camera(this.video, {
      onFrame: async () => {
        await this.pose.send({ image: this.video });
      },
      width: 640, height: 480
    });
    await this.camera.start();
  }

  onResults(results) {
    if (!results.poseLandmarks) return;
    this.latestLandmarks = results.poseLandmarks;

    // 스켈레톤 그리기
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    drawConnectors(this.ctx, results.poseLandmarks, POSE_CONNECTIONS,
      { color: 'rgba(0,122,255,0.7)', lineWidth: 2 });
    drawLandmarks(this.ctx, results.poseLandmarks,
      { color: '#FF2D55', lineWidth: 1, radius: 3 });

    this.onPose(results.poseLandmarks);
  }

  // 특정 시점의 랜드마크 스냅샷 반환
  getSnapshot() {
    return this.latestLandmarks;
  }
}
```

**Claude Code 프롬프트**:
```
CLAUDE.md와 FRONTEND.md를 읽었어.
sparring.html과 js/engine/ 아래 파일들을 만들어줘.

요구사항:
1. 게임 레이아웃:
   - 상단: HP 바(좌) + 점수(중) + 콤보(우)
   - 중앙 좌: AI 공격 영상 (attack_videos 테이블 데이터)
   - 중앙 우: 웹캠 + MediaPipe 스켈레톤 오버레이
   - 하단: "DODGE NOW!" 경고 텍스트 + 반응속도 표시
2. GameEngine.js, HitboxJudge.js, VideoPlayer.js, PoseTracker.js
   위의 코드 그대로 구현
3. 타임스탬프 도달 → PoseTracker.getSnapshot() → HitboxJudge.judge() → GameEngine.onJudge()
4. CSS 애니메이션:
   - screenShake: 피격 시 화면 흔들림
   - effectFloat: 이펙트 텍스트 위로 떠오름
   - hpPulse: HP 20% 이하 시 빨간 깜빡임
5. KO 화면: 다크 오버레이 + 최종 점수 + 다시하기 버튼
6. 게임 시작 시 POST /api/sessions 호출
7. 각 라운드 종료 시 POST /api/rounds 결과 저장
8. KO 시 PUT /api/sessions/{id}/end + PUT /api/leaderboard/me 호출
```

---

### PAGE 4: `dashboard.html` — 통계 & 랭킹 대시보드

**Claude Code 프롬프트**:
```
CLAUDE.md와 FRONTEND.md를 읽었어.
dashboard.html을 만들어줘. Chart.js CDN 사용.

요구사항:
1. 상단 프로필 카드:
   - 아바타 이미지 + 닉네임 + 랭크 뱃지 (Bronze~Diamond 색상)
   - 총 점수 / 최고 콤보 / 회피율 / 총 훈련 횟수 숫자 카드 4개
2. 통계 섹션 (GET /api/stats/me 데이터):
   - 라인 차트: 최근 30일 회피율 트렌드
   - 바 차트: 공격 유형별 성공률 (잽/훅/스트레이트/어퍼컷)
   - 도넛 차트: 회피/피격 비율
3. 자세 교정 현황 카드:
   - 각 자세별 최고 정확도 진행 바
4. 랭킹 테이블 (GET /api/leaderboard):
   - TOP 10 사용자 (내 순위 강조)
   - 순위/닉네임/점수/콤보/랭크티어
5. 내가 완료한 튜토리얼 목록 (그리드 카드)
다크 테마 + Chart.js 다크 설정 적용해줘.
```

---

### PAGE 5: `shop.html` — 코인 샵 (수익화)

**Claude Code 프롬프트**:
```
CLAUDE.md와 FRONTEND.md를 읽었어.
shop.html을 만들어줘.

요구사항:
1. 상단: 현재 보유 코인 + 프리미엄 업그레이드 배너
2. 상품 탭: 프리미엄강좌 / AI복서스킨 / 분석리포트
3. 상품 카드: 썸네일 + 이름 + 설명 + 가격(코인) + 구매 버튼
4. 구매 모달: 확인 팝업 → POST /api/shop/purchase
5. 구독 플랜 카드: FREE vs PREMIUM 비교 테이블
6. 무료/프리미엄 뱃지로 잠긴 콘텐츠 표시
```

---

## 🔧 공통 유틸 파일

### `js/core/api.js` — fetch 래퍼
```javascript
// api.js — 모든 API 호출의 공통 래퍼
const API_BASE = 'http://localhost:8080/api';

const api = {
  // JWT 포함 공통 헤더
  headers() {
    const token = localStorage.getItem('boxer_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  },

  async get(path) {
    const res = await fetch(`${API_BASE}${path}`, { headers: this.headers() });
    if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
    return res.json();
  },

  async post(path, body) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST', headers: this.headers(), body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
    return res.json();
  },

  async put(path, body) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'PUT', headers: this.headers(), body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`PUT ${path} failed: ${res.status}`);
    return res.json();
  }
};
```

### `css/global.css` 핵심 애니메이션
```css
/* 게임 핵심 애니메이션 */
@keyframes screenShake {
  0%, 100% { transform: translate(0, 0) rotate(0); }
  25%       { transform: translate(-8px, 4px) rotate(-0.5deg); }
  50%       { transform: translate(8px, -4px) rotate(0.5deg); }
  75%       { transform: translate(-4px, 8px) rotate(-0.3deg); }
}

@keyframes effectFloat {
  0%   { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
  50%  { opacity: 1; transform: translateX(-50%) translateY(-30px) scale(1.2); }
  100% { opacity: 0; transform: translateX(-50%) translateY(-60px) scale(0.8); }
}

@keyframes hpPulse {
  0%, 100% { box-shadow: 0 0 10px rgba(255,45,85,0.3); }
  50%       { box-shadow: 0 0 30px rgba(255,45,85,0.9); }
}

@keyframes comboBounce {
  0%   { transform: scale(1); }
  50%  { transform: scale(1.3); }
  100% { transform: scale(1); }
}

@keyframes slideInUp {
  from { transform: translateY(20px); opacity: 0; }
  to   { transform: translateY(0);    opacity: 1; }
}

/* 반응형 */
@media (max-width: 768px) {
  .game-layout { flex-direction: column; }
  .game-video, .game-webcam { width: 100%; height: 45vw; }
}
```

---

## 📋 Claude Code 작업 체크리스트

### 각 페이지 완성 기준
- [ ] 다크 테마 (`global.css` 변수 100% 적용)
- [ ] 모바일 반응형 (768px 브레이크포인트)
- [ ] API 연동 (`api.js` 사용, JWT 포함)
- [ ] 로딩 상태 처리 (스켈레톤 로더 또는 spinner)
- [ ] 에러 상태 처리 (toast 메시지)
- [ ] 60fps 애니메이션 (`requestAnimationFrame` 사용)
- [ ] 웹캠 권한 안내 (HTTPS / localhost 환경 안내)

---

*FRONTEND.md v3.0 | Claude Code 전용 | 2026-04-12*

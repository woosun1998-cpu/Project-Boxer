import { authFetch, getStoredUser, refreshCurrentUser } from "../core/auth.js";
import { apiUrl } from "../core/api.js";
import { SparringEffects as FX } from "../engine/SparringEffects.js";
import { SparringSound } from "../engine/SparringSound.js?v=20260527-obstacle-pause";
import "../engine/MediaPipePoseTracker.js?v=20260512-local-vendor-path";
import "../engine/ThresholdManager.js";
import "../engine/PoseAnalyzer.js";
import {
  isUserGuarding,
  measureWristSpeeds,
  passesPunchFilter,
} from "../engine/PunchDetectionFilter.js";

const STORAGE_KEYS = {
  lastResult: "im_boxer_sparring_last_result",
  draft: "im_boxer_sparring_draft",
  pendingSave: "im_boxer_sparring_pending_save",
};
const CAMERA_SETTINGS_KEY = "im_boxer_camera_settings";

/** 무엇: imboxer → frontend/video 로컬 mp4 / 왜: 한글 파일명·상대경로를 절대 URL로 통일 */
function localSparringVideoSrc(fileName) {
  return new URL(`../video/${fileName}`, window.location.href).href;
}

function getVideoReadyTimeoutMs(mode = state.mode) {
  if (mode === "pro") return 180000;
  if (mode === "advanced") return 120000;
  return 90000;
}

/** 무엇: moov-at-end 대용량 mp4 버퍼 대기 / 왜: Range 미지원 서버·느린 네트워크에서 검은 화면 방지 */
function waitForAiVideoReady(timeoutMs = getVideoReadyTimeoutMs()) {
  const video = ui.aiVideo;
  if (!video) return Promise.resolve(false);

  const source = video.dataset.videoSrc || state.config?.videoSrc;
  if (!source) return Promise.resolve(false);

  applyAiVideoSource(source, { preloadOnly: true });

  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && !video.error) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      video.removeEventListener("loadeddata", onReady);
      video.removeEventListener("canplay", onReady);
      video.removeEventListener("error", onError);
      resolve(ok);
    };
    const onReady = () => finish(true);
    const onError = () => {
      console.error("[sparring] 영상 로드 실패:", video.error?.message || video.error, video.currentSrc);
      finish(false);
    };
    const timer = window.setTimeout(() => {
      console.warn(
        "[sparring] 영상 버퍼 대기 시간 초과 — readyState:",
        video.readyState,
        "networkState:",
        video.networkState,
      );
      finish(video.readyState >= HTMLMediaElement.HAVE_METADATA && !video.error);
    }, timeoutMs);

    video.addEventListener("loadeddata", onReady, { once: true });
    video.addEventListener("canplay", onReady, { once: true });
    video.addEventListener("error", onError, { once: true });
    if (video.networkState === HTMLMediaElement.NETWORK_EMPTY) {
      video.load();
    }
  });
}

async function primeAiVideoBuffer() {
  if (!ui.aiVideo) return;
  const source = ui.aiVideo.dataset.videoSrc || state.config?.videoSrc;
  if (!source) return;
  applyAiVideoSource(source, { preloadOnly: true });
  try {
    await ui.aiVideo.play();
    ui.aiVideo.pause();
  } catch {
    /* autoplay 정책 — 무시 */
  }
}

function sameVideoSrc(a, b) {
  if (!a || !b) return false;
  try {
    return new URL(a, window.location.href).href === new URL(b, window.location.href).href;
  } catch {
    return String(a) === String(b);
  }
}

const LOCAL_SPARRING_VIDEO_SRC = {
  beginner: localSparringVideoSrc("스파링초보.mp4"),
  intermediate: localSparringVideoSrc("스파링보통.mp4"),
  advanced: localSparringVideoSrc("스파링어려움.mp4"),
  pro: localSparringVideoSrc("복싱프로.mp4"),
};

const MODE_CONFIG = {
  beginner: {
    label: "BEGINNER",
    aiName: "AI ROOKIE",
    videoSrc: LOCAL_SPARRING_VIDEO_SRC.beginner,
    introTitle: "가드부터 시작",
    playerImage: "./assets/images/sparring/biginner_player_1.jpg",
    roundsTotal: 3,
    roundDurationSec: 120,
    aiAttackIntervalMs: 4300,
    aiDamage: 5,
    opponentHp: 85,
    scoreMultiplier: 1,
    winScoreThreshold: 65,
    coachTip: "기본 가드와 리듬에 집중하세요.",
    introDesc: "처음 경기는 이기는 것보다 맞지 않고 흐름을 읽는 것이 핵심입니다. 상대가 들어오는 신호를 보면 바로 공격하지 말고, 가드와 회피로 타이밍을 잡은 뒤 짧은 잽으로 거리를 확인하세요.",
    introMethods: [
      "핵심: 먼저 맞지 말고 상대 리듬을 읽습니다.",
      "상대가 들어올 때는 욕심내지 말고 D 회피나 B 가드부터 누릅니다.",
      "잽(J)으로 거리를 재고, 맞췄다면 크로스(K)로 짧게 이어갑니다.",
    ],
    introStance: [
      "준비: 가드가 내려가면 바로 맞습니다.",
      "양손은 얼굴 가까이에 두고 턱을 살짝 당깁니다.",
      "발은 어깨너비, 무릎은 살짝 굽혀 흔들리지 않게 섭니다.",
      "공격 후에는 바로 가드 자세로 돌아옵니다.",
    ],
  },
  intermediate: {
    label: "INTERMEDIATE",
    aiName: "AI FIGHTER",
    videoSrc: LOCAL_SPARRING_VIDEO_SRC.intermediate,
    introTitle: "반응 후 연결",
    playerImage: "./assets/images/sparring/intermediater_player_1.jpg",
    roundsTotal: 5,
    roundDurationSec: 120,
    aiAttackIntervalMs: 3600,
    aiDamage: 7,
    opponentHp: 100,
    scoreMultiplier: 1.25,
    winScoreThreshold: 72,
    coachTip: "타이밍을 맞추면 점수가 폭발합니다.",
    introDesc: "중급에서는 방어와 반격을 하나의 흐름으로 연결해야 합니다. 상대 공격을 보고 D 또는 B로 먼저 살아남고, 빈틈이 생기면 J-K 또는 K-L처럼 짧은 2타 연결로 점수를 쌓으세요.",
    introMethods: [
      "핵심: 방어 성공 뒤 짧은 2타로 점수를 만듭니다.",
      "AI 공격 예고를 보고 D/B로 먼저 반응한 뒤 반격합니다.",
      "J-K 또는 K-L처럼 2타 연결을 노리되, 무리한 연타는 피합니다.",
      "정확도와 회피율이 함께 올라가야 좋은 등급을 받을 수 있습니다.",
    ],
    introStance: [
      "준비: 회피 뒤 중심이 무너지면 반격이 늦습니다.",
      "어깨 힘을 빼고 상체를 너무 크게 흔들지 않습니다.",
      "회피 뒤 중심을 회복한 상태에서 반격합니다.",
      "훅(L)은 상대 체력이 낮을 때 마무리용으로 씁니다.",
    ],
  },
  advanced: {
    label: "ADVANCED",
    aiName: "AI CHAMPION",
    videoSrc: LOCAL_SPARRING_VIDEO_SRC.advanced,
    introTitle: "짧고 빠르게",
    playerImage: "./assets/images/sparring/advanced_player_1.jpg",
    roundsTotal: 5,
    roundDurationSec: 180,
    aiAttackIntervalMs: 2900,
    aiDamage: 10,
    opponentHp: 100,
    scoreMultiplier: 1.6,
    winScoreThreshold: 80,
    coachTip: "한 번의 판단이 승부를 가릅니다.",
    introDesc: "고급 모드는 상대 템포가 빠르기 때문에 큰 동작은 위험합니다. 예고가 뜨는 순간 짧게 피하거나 막고, 반격은 한두 번만 정확하게 넣은 뒤 곧바로 가드로 돌아오는 것이 핵심입니다.",
    introMethods: [
      "핵심: 큰 동작보다 빠른 판단이 중요합니다.",
      "상대 패턴이 빠릅니다. 예고가 뜨면 즉시 D/B로 판단하세요.",
      "짧은 콤보 후 바로 방어로 전환해야 체력을 지킬 수 있습니다.",
      "정확한 반격 타이밍이 PERFECT와 고득점의 핵심입니다.",
    ],
    introStance: [
      "준비: 공격 후 멈추면 바로 역공을 맞습니다.",
      "가드는 높게, 팔꿈치는 몸 가까이에 둡니다.",
      "머리만 빼지 말고 무릎과 중심을 함께 낮춥니다.",
      "공격 후 멈추지 말고 가드 또는 회피로 이어갑니다.",
    ],
  },
  pro: {
    label: "PRO",
    aiName: "AI LEGEND",
    videoSrc: LOCAL_SPARRING_VIDEO_SRC.pro,
    introTitle: "프로 템포 적응",
    playerImage: "./assets/images/sparring/advanced_player_1.jpg",
    roundsTotal: 7,
    roundDurationSec: 180,
    aiAttackIntervalMs: 2400,
    aiDamage: 12,
    opponentHp: 120,
    scoreMultiplier: 2,
    winScoreThreshold: 88,
    coachTip: "방어와 반격 전환을 끊기지 않게 유지하세요.",
    introDesc: "프로 모드는 상대의 공격 간격이 가장 짧고 판정 폭도 좁습니다. 예고를 보는 즉시 방어를 선택하고, 반격은 정확한 한두 타만 넣은 뒤 바로 중심을 회복해야 합니다.",
    introMethods: [
      "핵심: 반응 지연 없이 방어와 반격을 전환합니다.",
      "AI 공격 예고가 뜨면 즉시 D/B로 먼저 살아남습니다.",
      "J-K-L 같은 3타 연결은 빈틈이 확실할 때만 사용합니다.",
      "체력 관리와 정확도가 동시에 유지되어야 승리할 수 있습니다.",
    ],
    introStance: [
      "준비: 가드가 한 번 내려가면 연속 공격을 허용합니다.",
      "턱을 당기고 양손을 얼굴 가까이에 둡니다.",
      "회피는 작게, 반격은 짧게, 복귀는 빠르게 가져갑니다.",
      "라운드 후반에도 발 간격과 중심을 흐트러뜨리지 않습니다.",
    ],
  },
};

const ACTION_MAP = {
  jab: { label: "JAB", speed: 7.8, damage: 6, score: 100 },
  cross: { label: "CROSS", speed: 8.4, damage: 9, score: 135 },
  hook: { label: "HOOK", speed: 7.2, damage: 12, score: 170 },
  dodge: { label: "DODGE", speed: 0, damage: 0, score: 70 },
  block: { label: "BLOCK", speed: 0, damage: 0, score: 55 },
};

const POSE_ACTION_MAP = {
  jab: "jab",
  cross: "cross",
  "left-hook": "hook",
  uppercut: "hook",
  slip: "dodge",
};

// 각 모드의 타이밍만 따로 모아두면, 플레이 테스트할 때 여기만 조정하면 된다.
// ADMIN TUNING ZONE
// 1) SPARRING_MODE_TIMING: beginner / intermediate / advanced / pro 전체 템포
// 2) AI_ATTACK_CUE_POINTS: 공격 종류별 cue point(impact / defense window / telegraph)
// 3) POSE_*: 카메라 동작 인식 민감도
// 위 세 곳만 기억하면 난이도와 반응감을 빠르게 조정할 수 있다.
const SPARRING_MODE_TIMING = {
  beginner: {
    comboGapMs: 1120,
    attackWindowMs: 1250,
    defenseWindowMs: 1200,
  },
  intermediate: {
    comboGapMs: 980,
    attackWindowMs: 1120,
    defenseWindowMs: 1050,
  },
  advanced: {
    comboGapMs: 820,
    attackWindowMs: 960,
    defenseWindowMs: 900,
  },
  pro: {
    comboGapMs: 700,
    attackWindowMs: 840,
    defenseWindowMs: 780,
  },
};

// 영상별 cue point. 공격 시작 / 실제 타격 / 방어 유효시간을 모드와 동작별로 따로 관리한다.
// Cue point table
// - impactDelayMs: 실제 타격 판정이 들어가는 시점
// - defenseWindowMs: 회피/가드가 유효한 시간
// - telegraphLeadMs: 공격 전 예고를 얼마나 먼저 보여줄지
// 이 값을 바꾸면 모드별 경기 템포가 즉시 달라진다.
const AI_ATTACK_CUE_POINTS = {
  beginner: {
    jab: { impactDelayMs: 880, defenseWindowMs: 360, telegraphLeadMs: 360 },
    cross: { impactDelayMs: 940, defenseWindowMs: 350, telegraphLeadMs: 400 },
    hook: { impactDelayMs: 980, defenseWindowMs: 340, telegraphLeadMs: 420 },
  },
  intermediate: {
    jab: { impactDelayMs: 790, defenseWindowMs: 320, telegraphLeadMs: 320 },
    cross: { impactDelayMs: 850, defenseWindowMs: 310, telegraphLeadMs: 360 },
    hook: { impactDelayMs: 900, defenseWindowMs: 300, telegraphLeadMs: 380 },
  },
  advanced: {
    jab: { impactDelayMs: 710, defenseWindowMs: 280, telegraphLeadMs: 280 },
    cross: { impactDelayMs: 760, defenseWindowMs: 270, telegraphLeadMs: 310 },
    hook: { impactDelayMs: 820, defenseWindowMs: 260, telegraphLeadMs: 330 },
  },
  pro: {
    jab: { impactDelayMs: 640, defenseWindowMs: 240, telegraphLeadMs: 240 },
    cross: { impactDelayMs: 700, defenseWindowMs: 230, telegraphLeadMs: 270 },
    hook: { impactDelayMs: 760, defenseWindowMs: 220, telegraphLeadMs: 290 },
  },
};

const POSE_TUNING = {
  minConfidence: 0.48,
  actionCooldownMs: 320,
  blockThreshold: 58,
  analysisIntervalMs: 85,
  punchMotionSpeed: 1.28,
  punchReachGain: 0.028,
  punchOutwardGain: 0.02,
  hookMotionSpeed: 1.42,
};

const POSE_HIT_ZONE_PADDING = 0.055;

const HIT_ZONE_CONFIG = {
  beginner: {
    head: { x: 0.5, y: 0.31, w: 0.18, h: 0.16 },
    body: { x: 0.5, y: 0.53, w: 0.28, h: 0.26 },
    timeline: [
      { time: 0, head: { x: 0.5, y: 0.31 }, body: { x: 0.5, y: 0.53 } },
      { time: 2.25, head: { x: 0.49, y: 0.31 }, body: { x: 0.49, y: 0.54 } },
      { time: 5.0, head: { x: 0.47, y: 0.34 }, body: { x: 0.48, y: 0.58 } },
      { time: 7.75, head: { x: 0.52, y: 0.31 }, body: { x: 0.51, y: 0.52 } },
    ],
  },
  intermediate: {
    head: { x: 0.5, y: 0.3, w: 0.16, h: 0.15 },
    body: { x: 0.5, y: 0.52, w: 0.27, h: 0.25 },
    timeline: [
      { time: 0, head: { x: 0.5, y: 0.3 }, body: { x: 0.5, y: 0.52 } },
      { time: 1.25, head: { x: 0.47, y: 0.31 }, body: { x: 0.48, y: 0.54 } },
      { time: 3.25, head: { x: 0.53, y: 0.3 }, body: { x: 0.52, y: 0.52 } },
      { time: 5.0, head: { x: 0.5, y: 0.31 }, body: { x: 0.5, y: 0.54 } },
    ],
  },
  advanced: {
    head: { x: 0.5, y: 0.29, w: 0.15, h: 0.14 },
    body: { x: 0.5, y: 0.52, w: 0.26, h: 0.25 },
    timeline: [
      { time: 0, head: { x: 0.5, y: 0.29 }, body: { x: 0.5, y: 0.52 } },
      { time: 1.0, head: { x: 0.48, y: 0.3 }, body: { x: 0.48, y: 0.53 } },
      { time: 2.75, head: { x: 0.54, y: 0.3 }, body: { x: 0.53, y: 0.52 } },
      { time: 4.75, head: { x: 0.46, y: 0.31 }, body: { x: 0.47, y: 0.55 } },
    ],
  },
  pro: {
    head: { x: 0.5, y: 0.29, w: 0.14, h: 0.13 },
    body: { x: 0.5, y: 0.52, w: 0.24, h: 0.23 },
    timeline: [
      { time: 0, head: { x: 0.5, y: 0.29 }, body: { x: 0.5, y: 0.52 } },
      { time: 0.85, head: { x: 0.47, y: 0.3 }, body: { x: 0.47, y: 0.53 } },
      { time: 2.25, head: { x: 0.55, y: 0.3 }, body: { x: 0.54, y: 0.52 } },
      { time: 3.85, head: { x: 0.45, y: 0.31 }, body: { x: 0.46, y: 0.55 } },
    ],
  },
};

const ADMIN_TUNING_STORAGE_KEY = "im_boxer_sparring_admin_tuning";

const state = {
  user: null,
  mode: "beginner",
  config: MODE_CONFIG.beginner,
  gameState: "idle",
  sessionId: null,
  round: 1,
  roundsCleared: 0,
  score: 0,
  combo: 0,
  maxCombo: 0,
  hits: 0,
  attackAttempts: 0,
  dodgeCount: 0,
  dodgeAttempts: 0,
  dodgeSuccessCount: 0,
  perfectCount: 0,
  playerHp: 100,
  opponentHp: 100,
  lastPunchSpeed: 0,
  reactionTotalMs: 0,
  reactionSamples: 0,
  averageReactionMs: 0,
  accuracy: 0,
  dodgeSuccessRate: 0,
  roundDurationMs: 120000,
  roundEndsAt: 0,
  countdownSeconds: 3,
  activeDefense: null,
  activeDefenseUntil: 0,
  lastAiAttackAt: 0,
  timers: {
    countdown: null,
    roundTick: null,
    aiAttack: null,
    persist: null,
  },
  cameraStream: null,
  webcamReady: false,
  saving: false,
  resultSent: false,
  poseTracker: null,
  poseAnalyzer: null,
  poseLoopFrame: 0,
  poseLastAnalyzeAt: 0,
  poseLastActionAt: 0,
  poseLastActionKey: "",
  poseSnapshot: null,
  poseMotionSample: null,
  latestPoseLandmarks: null,
  aiPatternQueue: [],
  currentAiAttack: null,
  timelineVideo: null,
  timelineMarkers: [],
  firedTimelineMarkerIds: new Set(),
  telegraphedTimelineMarkerIds: new Set(),
  timelineLastTime: 0,
  timelineRafId: 0,
  obstaclePause: {
    active: false,
    previousGameState: "",
    remainingRoundMs: 0,
  },
  adminMode: false,
  adminPanelOpen: false,
  adminEditMode: "beginner",
  adminTuning: null,
};

const ui = {};

function $(selector, root = document) {
  return root.querySelector(selector);
}

function $all(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatScore(value) {
  return String(clamp(Math.round(toNumber(value, 0)), 0, 100)).padStart(3, "0");
}

function formatTime(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function setGameState(nextState) {
  state.gameState = nextState;
  if (ui.game) {
    ui.game.dataset.gameState = nextState;
  }
}

function setText(el, value) {
  if (el) {
    el.textContent = value;
  }
}

function clearTimer(name) {
  if (state.timers[name]) {
    clearTimeout(state.timers[name]);
    clearInterval(state.timers[name]);
    state.timers[name] = null;
  }
}

function clearAllTimers() {
  clearTimer("countdown");
  clearTimer("roundTick");
  clearTimer("aiAttack");
  clearTimer("persist");
  stopTimelineMarkerLoop();
}

/** sparring-game과 동일: 짧은 구간 안에 들어오면 타격 처리 */
const TIMELINE_ATTACK_HIT_WINDOW_SEC = 0.2;

/** 영상 시작 지연·인코딩 차이 보정 (초). 필요 시 모드별로 조정 */
const TIMELINE_IMPACT_OFFSET_SEC = {
  beginner: 0,
  intermediate: 0,
  advanced: 0,
  pro: 0,
};

function redirectToLogin() {
  window.location.href = "/index.html";
}

function continueAsGuest() {
  state.user = {
    nickname: "PLAYER",
    username: "PLAYER",
    email: "",
  };
}

function getModeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode");
  return Object.prototype.hasOwnProperty.call(MODE_CONFIG, mode) ? mode : "beginner";
}

function applyMode(mode) {
  state.mode = mode;
  state.config = MODE_CONFIG[mode] || MODE_CONFIG.beginner;
  state.roundDurationMs = state.config.roundDurationSec * 1000;
  state.playerHp = 100;
  state.opponentHp = state.config.opponentHp;
  state.round = 1;
  state.roundsCleared = 0;
  state.score = 0;
  state.combo = 0;
  state.maxCombo = 0;
  state.hits = 0;
  state.attackAttempts = 0;
  state.dodgeCount = 0;
  state.dodgeAttempts = 0;
  state.dodgeSuccessCount = 0;
  state.perfectCount = 0;
  state.lastPunchSpeed = 0;
  state.reactionTotalMs = 0;
  state.reactionSamples = 0;
  state.averageReactionMs = 0;
  state.accuracy = 0;
  state.dodgeSuccessRate = 0;
  state.activeDefense = null;
  state.activeDefenseUntil = 0;
  state.lastAiAttackAt = 0;
  state.currentAiAttack = null;
  state.aiPatternQueue = [];
  state.firedTimelineMarkerIds = new Set();
  state.timelineLastTime = 0;
  state.firedTimelineMarkerIds = new Set();
  state.poseSnapshot = null;
  state.poseMotionSample = null;
  state.latestPoseLandmarks = null;
  state.poseLastAnalyzeAt = 0;
  state.poseLastActionAt = 0;
  state.poseLastActionKey = "";
  setStance("guard");

  if (ui.game) {
    ui.game.dataset.mode = mode;
  }

  if (ui.modeBadge) {
    ui.modeBadge.dataset.modeDisplay = mode;
    ui.modeBadge.textContent = state.config.label;
  }

  if (ui.aiName) {
    ui.aiName.textContent = state.config.aiName;
  }

  if (state.config.videoSrc) {
    preloadAiVideo();
  }

  if (ui.roundLabel) {
    setText(ui.roundLabel, `ROUND ${state.round}`);
  }

  if (ui.roundTimer) {
    setText(ui.roundTimer, formatTime(state.roundDurationMs));
  }

  FX.setCoachTip(state.config.coachTip);
  FX.setHp("player", state.playerHp);
  FX.setHp("ai", state.opponentHp);
  FX.setStat("sparring-score", formatScore(state.score));
  FX.setStat("sparring-combo", `x${state.combo}`);
  FX.setStat("sparring-hit-count", String(state.hits));
  FX.setStat("punch-speed", "—");
  syncCoachMetrics();
}

function syncHud() {
  FX.setHp("player", state.playerHp);
  FX.setHp("ai", state.opponentHp);
  FX.setStat("sparring-score", formatScore(state.score));
  FX.setStat("sparring-combo", `x${state.combo}`);
  FX.setStat("sparring-hit-count", String(state.hits));
  FX.setStat("punch-speed", state.lastPunchSpeed > 0 ? state.lastPunchSpeed.toFixed(1) : "—");
  FX.setCoach("jab", state.attackAttempts === 0 ? "준비" : state.accuracy >= 80 ? "정확" : state.accuracy >= 55 ? "보통" : "빗나감");
  FX.setCoach("guard", state.playerHp < 30 ? "위험" : state.dodgeCount > 0 ? "좋음" : "유지");
  FX.setCoach("distance", state.dodgeSuccessRate >= 70 ? "완벽" : state.dodgeSuccessRate >= 40 ? "근접" : "멀음");
  FX.setCoach("accuracy", `${Math.round(state.accuracy)}%`);
  FX.setCoach("reaction", state.reactionSamples ? `${Math.round(state.averageReactionMs)}ms` : "—");
  FX.setCoachTip(resolveCoachTip());
}

function syncCoachMetrics() {
  syncHud();
}

function syncAdminPanel() {
  if (!ui.adminPanel) {
    return;
  }

  ui.adminPanel.dataset.visible = state.adminPanelOpen ? "" : "false";
  ui.adminPanel.hidden = !state.adminMode && !state.adminPanelOpen;
  if (ui.game) {
    ui.game.dataset.adminMode = state.adminMode ? "1" : "0";
  }

  const snapshot = getAdminTuningSnapshot();
  const mode = state.adminEditMode || state.mode;

  if (ui.adminToggle) {
    ui.adminToggle.classList.toggle("is-active", state.adminPanelOpen);
    ui.adminToggle.setAttribute("aria-pressed", state.adminPanelOpen ? "true" : "false");
    ui.adminToggle.hidden = !state.adminMode;
  }

  if (ui.adminModeSelect) {
    ui.adminModeSelect.value = mode;
  }

  if (ui.adminContent) {
    ui.adminContent.innerHTML = buildAdminPanelContent(snapshot, mode);
  }

  syncHitZoneOverlay();
}

function openAdminPanel() {
  state.adminPanelOpen = true;
  syncAdminPanel();
}

function closeAdminPanel() {
  state.adminPanelOpen = false;
  syncAdminPanel();
}

function toggleAdminPanel() {
  state.adminPanelOpen = !state.adminPanelOpen;
  syncAdminPanel();
}

function collectAdminTuningFromPanel() {
  const snapshot = getAdminTuningSnapshot();

  const mode = state.adminEditMode || state.mode;
  const modeBlock = ui.adminContent?.querySelector(`[data-admin-mode-block="${mode}"]`);
  if (modeBlock) {
    for (const key of Object.keys(snapshot.modeTiming[mode] || {})) {
      const input = modeBlock.querySelector(`[data-admin-mode-field="${key}"]`);
      if (input) {
        snapshot.modeTiming[mode][key] = toNumber(input.value, snapshot.modeTiming[mode][key]);
      }
    }

    for (const attack of Object.keys(snapshot.attackCuePoints[mode] || {})) {
      for (const key of Object.keys(snapshot.attackCuePoints[mode][attack] || {})) {
        const input = modeBlock.querySelector(
          `[data-admin-cue-attack="${attack}"][data-admin-cue-field="${key}"]`,
        );
        if (input) {
          snapshot.attackCuePoints[mode][attack][key] = toNumber(
            input.value,
            snapshot.attackCuePoints[mode][attack][key],
          );
        }
      }
    }

    for (const key of Object.keys(snapshot.modeConfig[mode] || {})) {
      const input = modeBlock.querySelector(`[data-admin-config-field="${key}"]`) || modeBlock.querySelector(`[data-admin-mode-field="${key}"]`);
      if (input) {
        snapshot.modeConfig[mode][key] = key === "scoreMultiplier"
          ? toNumber(input.value, snapshot.modeConfig[mode][key])
          : Math.round(toNumber(input.value, snapshot.modeConfig[mode][key]));
      }
    }
  }

  const poseBlock = ui.adminContent?.querySelector("[data-admin-pose-block]");
  if (poseBlock) {
    for (const key of Object.keys(snapshot.pose || {})) {
      const input = poseBlock.querySelector(`[data-admin-pose-field="${key}"]`);
      if (input) {
        snapshot.pose[key] = toNumber(input.value, snapshot.pose[key]);
      }
    }
  }

  snapshot.hitZones = snapshot.hitZones || deepClone(HIT_ZONE_CONFIG);
  const hitZoneBlock = modeBlock?.querySelector("[data-admin-hit-zone-block]");
  if (hitZoneBlock) {
    for (const zone of ["head", "body"]) {
      snapshot.hitZones[mode] = snapshot.hitZones[mode] || {};
      snapshot.hitZones[mode][zone] = snapshot.hitZones[mode][zone] || {};
      for (const key of ["x", "y", "w", "h"]) {
        const input = hitZoneBlock.querySelector(`[data-admin-hit-zone="${zone}"][data-admin-hit-field="${key}"]`);
        if (input) {
          snapshot.hitZones[mode][zone][key] = toNumber(input.value, snapshot.hitZones[mode][zone][key]);
        }
      }
    }
  }

  return snapshot;
}

function buildAdminPanelContent(snapshot, mode) {
  const modeTiming = snapshot.modeTiming[mode] || snapshot.modeTiming.beginner;
  const cuePoints = snapshot.attackCuePoints[mode] || snapshot.attackCuePoints.beginner;
  const modeConfig = snapshot.modeConfig[mode] || snapshot.modeConfig.beginner;
  const sectionLabel = {
    beginner: "초급",
    intermediate: "중급",
    advanced: "고급",
    pro: "프로",
  }[mode] || "초급";

  return `
    <div data-admin-mode-block="${mode}">
    <div class="ss-admin-guide">
      <strong>튜닝 기준</strong>
      <span>상대가 펀치를 뻗는 순간을 기준으로 타격 시점을 맞춥니다. 회피/가드는 상대 공격 예고가 뜬 뒤 먼저 입력하고, 공격은 상대가 안 치거나 방어 직후 빈틈에 짧게 넣는 흐름이 가장 안정적입니다.</span>
    </div>
    <div class="ss-admin-section">
      <h3>쉬운 조정</h3>
      <div class="ss-admin-quick">
        <button type="button" data-admin-nudge="slower">반응 시간을 넉넉하게</button>
        <button type="button" data-admin-nudge="faster">더 빠르고 어렵게</button>
        <button type="button" data-admin-nudge="easierDefense">회피/가드 쉽게</button>
        <button type="button" data-admin-nudge="stricterDefense">회피/가드 엄격하게</button>
      </div>
      <div class="ss-admin-note">버튼을 누르면 아래 숫자가 바뀌고 즉시 적용됩니다. 마음에 들면 저장을 누르세요.</div>
    </div>
    <div class="ss-admin-section" style="margin-top:14px;">
      <h3>${sectionLabel} 템포</h3>
      <div class="ss-admin-grid">
        ${buildNumberField("comboGapMs", "콤보 간격 (ms)", modeTiming.comboGapMs, 40)}
        ${buildNumberField("attackWindowMs", "공격 인정 시간 (ms)", modeTiming.attackWindowMs, 40)}
        ${buildNumberField("defenseWindowMs", "방어 인정 시간 (ms)", modeTiming.defenseWindowMs, 40)}
      </div>
      <div class="ss-admin-note">콤보 간격은 연속 펀치를 인정하는 여유 시간입니다. 공격/방어 인정 시간은 플레이어 입력을 받아주는 전체 판정 폭입니다.</div>
      <div class="ss-admin-grid" style="margin-top:10px;">
        ${buildConfigField("aiAttackIntervalMs", "AI 공격 간격 (ms)", modeConfig.aiAttackIntervalMs, 80)}
        ${buildConfigField("aiDamage", "AI 피해량", modeConfig.aiDamage, 1)}
        ${buildConfigField("opponentHp", "상대 체력", modeConfig.opponentHp, 1)}
        ${buildConfigField("roundDurationSec", "라운드 시간 (초)", modeConfig.roundDurationSec, 1)}
        ${buildConfigField("roundsTotal", "전체 라운드", modeConfig.roundsTotal, 1)}
        ${buildConfigField("scoreMultiplier", "점수 배율", modeConfig.scoreMultiplier, 0.05, true)}
        ${buildConfigField("winScoreThreshold", "승리 기준 점수", modeConfig.winScoreThreshold, 100)}
      </div>
    </div>
    <div class="ss-admin-section" style="margin-top:14px;">
      <h3>${sectionLabel} 공격 타이밍</h3>
      <div class="ss-admin-note">타격 시점은 영상에서 글러브가 가장 앞으로 뻗거나 몸에 닿는 프레임입니다. 예고 시간은 그보다 앞서 위험 신호를 보여주는 시간입니다.</div>
      <div class="ss-admin-grid" style="margin-top:10px;">
        ${buildCueField(mode, "jab", "impactDelayMs", "잽 타격 시점", cuePoints.jab.impactDelayMs)}
        ${buildCueField(mode, "jab", "defenseWindowMs", "잽 방어 시간", cuePoints.jab.defenseWindowMs)}
        ${buildCueField(mode, "jab", "telegraphLeadMs", "잽 예고 시간", cuePoints.jab.telegraphLeadMs)}
        ${buildCueField(mode, "cross", "impactDelayMs", "스트레이트 타격 시점", cuePoints.cross.impactDelayMs)}
        ${buildCueField(mode, "cross", "defenseWindowMs", "스트레이트 방어 시간", cuePoints.cross.defenseWindowMs)}
        ${buildCueField(mode, "cross", "telegraphLeadMs", "스트레이트 예고 시간", cuePoints.cross.telegraphLeadMs)}
        ${buildCueField(mode, "hook", "impactDelayMs", "훅 타격 시점", cuePoints.hook.impactDelayMs)}
        ${buildCueField(mode, "hook", "defenseWindowMs", "훅 방어 시간", cuePoints.hook.defenseWindowMs)}
        ${buildCueField(mode, "hook", "telegraphLeadMs", "훅 예고 시간", cuePoints.hook.telegraphLeadMs)}
      </div>
    </div>
    <div class="ss-admin-section" style="margin-top:14px;" data-admin-hit-zone-block>
      <h3>${sectionLabel} 히트존</h3>
      <div class="ss-admin-note">얼굴/몸통 영역은 화면 비율 기준 0~1 값입니다. 관리자모드에서는 노란색 얼굴 영역과 파란색 몸통 영역이 보입니다.</div>
      <div class="ss-admin-grid" style="margin-top:10px;">
        ${buildHitZoneField(mode, "head", "x", "얼굴 X", snapshot.hitZones?.[mode]?.head?.x ?? HIT_ZONE_CONFIG[mode].head.x)}
        ${buildHitZoneField(mode, "head", "y", "얼굴 Y", snapshot.hitZones?.[mode]?.head?.y ?? HIT_ZONE_CONFIG[mode].head.y)}
        ${buildHitZoneField(mode, "head", "w", "얼굴 너비", snapshot.hitZones?.[mode]?.head?.w ?? HIT_ZONE_CONFIG[mode].head.w)}
        ${buildHitZoneField(mode, "head", "h", "얼굴 높이", snapshot.hitZones?.[mode]?.head?.h ?? HIT_ZONE_CONFIG[mode].head.h)}
        ${buildHitZoneField(mode, "body", "x", "몸통 X", snapshot.hitZones?.[mode]?.body?.x ?? HIT_ZONE_CONFIG[mode].body.x)}
        ${buildHitZoneField(mode, "body", "y", "몸통 Y", snapshot.hitZones?.[mode]?.body?.y ?? HIT_ZONE_CONFIG[mode].body.y)}
        ${buildHitZoneField(mode, "body", "w", "몸통 너비", snapshot.hitZones?.[mode]?.body?.w ?? HIT_ZONE_CONFIG[mode].body.w)}
        ${buildHitZoneField(mode, "body", "h", "몸통 높이", snapshot.hitZones?.[mode]?.body?.h ?? HIT_ZONE_CONFIG[mode].body.h)}
      </div>
    </div>
    </div>
    <div class="ss-admin-section" data-admin-pose-block>
      <h3>자세 인식 민감도</h3>
      <div class="ss-admin-grid">
        ${buildPoseField("minConfidence", "최소 인식 신뢰도", snapshot.pose.minConfidence, 0.01)}
        ${buildPoseField("actionCooldownMs", "동작 쿨다운 (ms)", snapshot.pose.actionCooldownMs, 10)}
        ${buildPoseField("blockThreshold", "가드 판정 기준", snapshot.pose.blockThreshold, 1)}
        ${buildPoseField("analysisIntervalMs", "분석 간격 (ms)", snapshot.pose.analysisIntervalMs, 5)}
        ${buildPoseField("punchMotionSpeed", "펀치 손목 속도 기준", snapshot.pose.punchMotionSpeed, 0.05)}
        ${buildPoseField("punchReachGain", "펀치 뻗음 변화 기준", snapshot.pose.punchReachGain, 0.005)}
        ${buildPoseField("punchOutwardGain", "펀치 방향 변화 기준", snapshot.pose.punchOutwardGain, 0.005)}
        ${buildPoseField("hookMotionSpeed", "훅 손목 속도 기준", snapshot.pose.hookMotionSpeed, 0.05)}
      </div>
      <div class="ss-admin-note">숫자를 올리면 더 엄격해집니다. 오입력이 많으면 펀치 손목 속도/뻗음 변화/방향 변화 기준을 올리고, 실제 펀치를 놓치면 조금 낮추세요.</div>
    </div>
  `;
}
function buildNumberField(key, label, value, step = 1, decimal = false) {
  const inputType = decimal ? "number" : "number";
  const inputValue = decimal ? Number(value).toFixed(2) : String(Math.round(Number(value)));
  return `
    <div class="ss-admin-field">
      <label>${label}</label>
      <input type="${inputType}" inputmode="decimal" step="${step}" value="${inputValue}" data-admin-mode-field="${key}">
    </div>
  `;
}

function buildConfigField(key, label, value, step = 1, decimal = false) {
  const inputValue = decimal ? Number(value).toFixed(2) : String(Math.round(Number(value)));
  return `
    <div class="ss-admin-field">
      <label>${label}</label>
      <input type="number" inputmode="decimal" step="${step}" value="${inputValue}" data-admin-config-field="${key}">
    </div>
  `;
}

function buildCueField(mode, attack, key, label, value) {
  return `
    <div class="ss-admin-field">
      <label>${label}</label>
      <input type="number" inputmode="numeric" step="10" value="${Math.round(Number(value))}" data-admin-cue-attack="${attack}" data-admin-cue-field="${key}">
    </div>
  `;
}

function buildHitZoneField(mode, zone, key, label, value) {
  return `
    <div class="ss-admin-field">
      <label>${label}</label>
      <input type="number" inputmode="decimal" min="0" max="1" step="0.01" value="${Number(value).toFixed(2)}" data-admin-hit-zone="${zone}" data-admin-hit-field="${key}">
    </div>
  `;
}

function buildPoseField(key, label, value, step) {
  const safeValue = Number.isInteger(Number(value)) ? String(Math.round(Number(value))) : Number(value).toFixed(step < 0.01 ? 3 : 2);
  return `
    <div class="ss-admin-field">
      <label>${label}</label>
      <input type="number" inputmode="decimal" step="${step}" value="${safeValue}" data-admin-pose-field="${key}">
    </div>
  `;
}

function adjustInputValue(selector, delta, min = null, max = null) {
  const input = ui.adminContent?.querySelector(selector) || document.querySelector(selector);
  if (!input) {
    return;
  }

  const current = toNumber(input.value, 0);
  let next = current + delta;
  if (min !== null) next = Math.max(min, next);
  if (max !== null) next = Math.min(max, next);
  input.value = Number.isInteger(next) ? String(next) : next.toFixed(2);
}

function applyAdminNudge(kind) {
  const cueFields = ["impactDelayMs", "defenseWindowMs", "telegraphLeadMs"];
  const adjustCue = (field, delta, min, max) => {
    if (!cueFields.includes(field)) {
      return;
    }

    ui.adminContent?.querySelectorAll(`[data-admin-cue-field="${field}"]`).forEach((input) => {
      const current = toNumber(input.value, 0);
      let next = current + delta;
      if (min !== null) next = Math.max(min, next);
      if (max !== null) next = Math.min(max, next);
      input.value = String(Math.round(next));
    });
  };

  if (kind === "slower") {
    adjustCue("impactDelayMs", 80, 300, 1400);
    adjustCue("defenseWindowMs", 50, 120, 520);
    adjustCue("telegraphLeadMs", 50, 80, 620);
    adjustInputValue('[data-admin-config-field="aiAttackIntervalMs"]', 250, 800, 7000);
    adjustInputValue('[data-admin-mode-field="attackWindowMs"]', 80, 400, 1800);
  }

  if (kind === "faster") {
    adjustCue("impactDelayMs", -60, 300, 1400);
    adjustCue("defenseWindowMs", -30, 120, 520);
    adjustCue("telegraphLeadMs", -30, 80, 620);
    adjustInputValue('[data-admin-config-field="aiAttackIntervalMs"]', -220, 800, 7000);
    adjustInputValue('[data-admin-mode-field="comboGapMs"]', -60, 250, 1600);
    adjustInputValue('[data-admin-mode-field="attackWindowMs"]', -60, 400, 1800);
  }

  if (kind === "easierDefense") {
    adjustCue("defenseWindowMs", 80, 120, 620);
    adjustInputValue('[data-admin-mode-field="defenseWindowMs"]', 120, 350, 1800);
    adjustInputValue('[data-admin-pose-field="blockThreshold"]', -5, 35, 90);
    adjustInputValue('[data-admin-pose-field="minConfidence"]', -0.03, 0.25, 0.8);
  }

  if (kind === "stricterDefense") {
    adjustCue("defenseWindowMs", -50, 100, 620);
    adjustInputValue('[data-admin-mode-field="defenseWindowMs"]', -80, 350, 1800);
    adjustInputValue('[data-admin-pose-field="blockThreshold"]', 5, 35, 95);
    adjustInputValue('[data-admin-pose-field="minConfidence"]', 0.03, 0.25, 0.9);
    adjustInputValue('[data-admin-pose-field="punchMotionSpeed"]', 0.12, 0.8, 4);
    adjustInputValue('[data-admin-pose-field="punchReachGain"]', 0.006, 0.01, 0.16);
    adjustInputValue('[data-admin-pose-field="punchOutwardGain"]', 0.006, 0.01, 0.16);
    adjustInputValue('[data-admin-pose-field="hookMotionSpeed"]', 0.12, 0.8, 4.5);
  }

  const snapshot = collectAdminTuningFromPanel();
  applyAdminTuning(snapshot, { persist: false });
  syncAdminPanel();
}

function getActiveHitZoneConfig() {
  const snapshot = getAdminTuningSnapshot();
  return snapshot.hitZones?.[state.mode] || HIT_ZONE_CONFIG[state.mode] || HIT_ZONE_CONFIG.beginner;
}

function getTimedHitZones() {
  const config = getActiveHitZoneConfig();
  const timeline = Array.isArray(config.timeline) ? config.timeline : [];
  const time = ui.aiVideo ? toNumber(ui.aiVideo.currentTime, 0) : 0;
  let activeFrame = timeline[0] || null;

  for (const frame of timeline) {
    if (toNumber(frame.time, 0) <= time) {
      activeFrame = frame;
    }
  }

  return {
    head: { ...config.head, ...(activeFrame?.head || {}) },
    body: { ...config.body, ...(activeFrame?.body || {}) },
  };
}

function syncHitZoneOverlay() {
  if (!ui.hitZoneOverlay) {
    return;
  }

  const zones = getTimedHitZones();
  for (const zoneName of ["head", "body"]) {
    const element = ui.hitZones?.[zoneName];
    const zone = zones[zoneName];
    if (!element || !zone) {
      continue;
    }

    element.style.left = `${clamp(zone.x, 0, 1) * 100}%`;
    element.style.top = `${clamp(zone.y, 0, 1) * 100}%`;
    element.style.width = `${clamp(zone.w, 0.02, 1) * 100}%`;
    element.style.height = `${clamp(zone.h, 0.02, 1) * 100}%`;
  }
}

function pointInsideZone(point, zone, padding = 0) {
  if (!point || !zone) {
    return false;
  }

  const x = clamp(point.x, 0, 1);
  const y = clamp(point.y, 0, 1);
  const pad = Math.max(0, padding);
  return (
    x >= zone.x - zone.w / 2 - pad &&
    x <= zone.x + zone.w / 2 + pad &&
    y >= zone.y - zone.h / 2 - pad &&
    y <= zone.y + zone.h / 2 + pad
  );
}

function getPunchTargetPoint(action) {
  const landmarks = state.latestPoseLandmarks;
  if (!landmarks) {
    return null;
  }

  const leftWrist = getLandmarkPoint(landmarks, 15);
  const rightWrist = getLandmarkPoint(landmarks, 16);
  if (action === "jab") {
    return leftWrist;
  }
  if (action === "cross") {
    return rightWrist;
  }
  return leftWrist && rightWrist
    ? (leftWrist.y <= rightWrist.y ? leftWrist : rightWrist)
    : leftWrist || rightWrist;
}

function resolveHitZoneContact(action) {
  const point = getPunchTargetPoint(action);
  if (!point) {
    return { contact: false, target: "", point: null };
  }

  const zones = getTimedHitZones();
  if (pointInsideZone(point, zones.head, POSE_HIT_ZONE_PADDING)) {
    return { contact: true, target: "head", point };
  }
  if (pointInsideZone(point, zones.body, POSE_HIT_ZONE_PADDING)) {
    return { contact: true, target: "body", point };
  }
  return { contact: false, target: "", point };
}

function resolveCoachTip() {
  if (state.playerHp < 25) {
    return "체력이 위험합니다. 가드를 먼저 올리고 짧게 반응하세요.";
  }
  if (state.opponentHp < 25) {
    return "마무리 구간입니다. 콤보를 끊지 말고 압박을 유지하세요.";
  }
  if (state.combo >= 5) {
    return "좋습니다. 지금 리듬을 끊지 말고 계속 밀어붙이세요.";
  }
  if (state.accuracy < 50 && state.attackAttempts >= 3) {
    return "정확도를 먼저 올리세요. 빠르기보다 정확한 타격이 중요합니다.";
  }
  return state.config.coachTip;
}

function updateRoundLabel() {
  if (ui.roundLabel) {
    setText(ui.roundLabel, `ROUND ${state.round}`);
  }
}

function updateRoundTimer(msLeft) {
  if (ui.roundTimer) {
    setText(ui.roundTimer, formatTime(msLeft));
    if (msLeft <= 15000) {
      ui.roundTimer.dataset.timeLow = "";
    } else {
      delete ui.roundTimer.dataset.timeLow;
    }
  }
}

function setActionActive(action, duration = 240) {
  const button = ui.actionButtons.get(action);
  if (!button) {
    return;
  }
  button.dataset.active = "";
  window.setTimeout(() => {
    delete button.dataset.active;
  }, duration);
}

function setAiState(nextState) {
  if (ui.aiWrap) {
    ui.aiWrap.dataset.aiState = nextState;
  }
}

function applyAiVideoSource(source, { preloadOnly = false } = {}) {
  if (!ui.aiVideo || !source) {
    return;
  }

  ui.aiVideo.dataset.videoSrc = source;
  ui.aiVideo.muted = true;
  ui.aiVideo.playsInline = true;
  ui.aiVideo.preload = "auto";
  ui.aiVideo.removeAttribute("poster");

  if (!sameVideoSrc(ui.aiVideo.currentSrc || ui.aiVideo.getAttribute("src"), source)) {
    ui.aiVideo.src = source;
    ui.aiVideo.load();
  }

  ui.aiVideo.style.display = "block";
  if (ui.aiWrap) {
    ui.aiWrap.dataset.aiState = ui.aiWrap.dataset.aiState || "idle";
  }

  const tryPlay = () => {
    if (preloadOnly && state.gameState !== "round_active") {
      return;
    }
    ui.aiVideo.play().catch((error) => {
      console.warn("[sparring] 영상 재생 대기:", error?.message || error);
    });
  };

  if (ui.aiVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    tryPlay();
    return;
  }

  ui.aiVideo.addEventListener(
    "canplay",
    () => {
      tryPlay();
    },
    { once: true },
  );
}

async function ensureAiVideoLoaded() {
  const source = ui.aiVideo?.dataset.videoSrc || state.config?.videoSrc;
  if (!source) {
    console.warn("[sparring] videoSrc가 비어 있습니다.");
    return false;
  }
  await waitForAiVideoReady();
  applyAiVideoSource(source, { preloadOnly: false });
  return true;
}

function preloadAiVideo() {
  const source = ui.aiVideo?.dataset.videoSrc || state.config?.videoSrc;
  if (!source) {
    return;
  }
  applyAiVideoSource(source, { preloadOnly: true });
}

function normalizeSparringVideoUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw) || raw.startsWith("./")) return raw;
  if (raw.startsWith("/uploads/") || raw.startsWith("/dataset/")) return apiUrl(raw);
  if (raw.startsWith("/assets/")) return `.${raw}`;
  return raw;
}

function normalizeTimelineAttackType(type) {
  const t = String(type || "jab").toLowerCase();
  if (t === "body_shot") return "hook";
  if (t === "uppercut") return "cross";
  return t;
}

/** 무엇: BOXER_CPU_ATTACKS → 영상 timeupdate 마커 / 왜: 스파링초보.mp4 타임스탬프와 1:1 동기 */
function loadCpuAttackTimelineFromData(mode) {
  const attacks = window.BOXER_CPU_ATTACKS?.[mode];
  if (!Array.isArray(attacks) || !attacks.length) {
    return false;
  }
  const cueTable = AI_ATTACK_CUE_POINTS[mode] || AI_ATTACK_CUE_POINTS.beginner;
  state.timelineMarkers = attacks.map((atk, index) => {
    const attackType = normalizeTimelineAttackType(atk.type);
    const cue = cueTable[attackType] || cueTable.jab;
    return {
      id: `${mode}-cpu-${index}-${atk.time}`,
      attack_type: attackType,
      impact_time: toNumber(atk.time, 0),
      dodge_window_ms: toNumber(cue?.defenseWindowMs, state.config.defenseWindowMs || 650),
      impact_delay_ms: 0,
    };
  });
  state.firedTimelineMarkerIds = new Set();
  state.telegraphedTimelineMarkerIds = new Set();
  state.timelineLastTime = 0;
  const first = attacks[0];
  const last = attacks[attacks.length - 1];
  console.info(
    `[sparring] ${mode} CPU 타임라인 ${state.timelineMarkers.length}개 | 첫 ${first.time}s ${first.type} | 끝 ${last.time}s ${last.type}`,
  );
  return true;
}

function resetTimelineMarkerState() {
  state.firedTimelineMarkerIds = new Set();
  state.telegraphedTimelineMarkerIds = new Set();
  state.timelineLastTime = 0;
}

function stopTimelineMarkerLoop() {
  if (state.timelineRafId) {
    cancelAnimationFrame(state.timelineRafId);
    state.timelineRafId = 0;
  }
}

function startTimelineMarkerLoop({ reset = true } = {}) {
  stopTimelineMarkerLoop();
  if (!ui.aiVideo || !state.timelineMarkers.length) {
    return;
  }
  if (reset) {
    resetTimelineMarkerState();
  } else {
    state.timelineLastTime = toNumber(ui.aiVideo.currentTime, 0);
  }
  const offsetSec = toNumber(TIMELINE_IMPACT_OFFSET_SEC[state.mode], 0);
  const tick = () => {
    state.timelineRafId = requestAnimationFrame(tick);
    if (state.gameState !== "round_active" || !state.timelineMarkers.length || !ui.aiVideo) {
      return;
    }
    const now = toNumber(ui.aiVideo.currentTime, 0);
    const prev = state.timelineLastTime;
    if (now + 0.5 < prev) {
      resetTimelineMarkerState();
    }
    state.timelineMarkers.forEach((marker) => {
      if (state.firedTimelineMarkerIds.has(marker.id)) {
        return;
      }
      const impactTime =
        Math.max(0, marker.impact_time + toNumber(marker.impact_delay_ms, 0) / 1000) + offsetSec;
      const inHitWindow =
        now >= impactTime && now <= impactTime + TIMELINE_ATTACK_HIT_WINDOW_SEC;
      const crossedImpact = prev <= impactTime && now > impactTime;
      if (inHitWindow || crossedImpact) {
        state.firedTimelineMarkerIds.add(marker.id);
        performTimelineAttack(marker);
      }
    });
    state.timelineLastTime = now;
  };
  state.timelineRafId = requestAnimationFrame(tick);
}

function usesLocalSparringVideo(mode = state.mode) {
  return Boolean(LOCAL_SPARRING_VIDEO_SRC[mode]);
}

async function loadActiveSparringVideo() {
  const mode = state.mode;
  const localSrc = LOCAL_SPARRING_VIDEO_SRC[mode];
  if (localSrc) {
    state.config = { ...state.config, videoSrc: localSrc };
    if (ui.aiVideo) {
      ui.aiVideo.dataset.videoSrc = localSrc;
    }
    loadCpuAttackTimelineFromData(mode);
    applyAiVideoSource(localSrc, { preloadOnly: true });
    void primeAiVideoBuffer();
    console.info(`[sparring] 로컬 영상 (${mode}):`, localSrc);
    return;
  }

  try {
    const response = await authFetch(`/api/sparring/active-video?mode=${encodeURIComponent(mode)}`);
    if (!response.ok) return;
    const data = await response.json();
    const videoSrc = normalizeSparringVideoUrl(data.video_url);
    if (!videoSrc) return;

    state.timelineVideo = data;
    state.timelineMarkers = Array.isArray(data.timestamps)
      ? data.timestamps
          .map((marker) => ({
            ...marker,
            impact_time: toNumber(marker.impact_time, 0),
            dodge_window_ms: toNumber(marker.dodge_window_ms, state.config.defenseWindowMs || 650),
            impact_delay_ms: toNumber(marker.impact_delay_ms, 0),
          }))
          .filter((marker) => marker.impact_time >= 0)
      : [];
    state.config = {
      ...state.config,
      videoSrc,
      aiName: data.title || state.config.aiName,
    };
    if (ui.aiVideo) {
      ui.aiVideo.dataset.videoSrc = videoSrc;
    }
    if (ui.aiName && data.title) {
      ui.aiName.textContent = data.title;
    }
  } catch (error) {
    console.warn("active sparring video unavailable:", error);
  }
}

function setListItems(target, items) {
  if (!target) {
    return;
  }

  target.innerHTML = "";
  items.forEach((text) => {
    const li = document.createElement("li");
    li.textContent = text;
    target.appendChild(li);
  });
}

function openIntroModal() {
  if (!ui.introModal) {
    return;
  }

  const config = state.config;
  ui.introModal.dataset.visible = "";
  setText(ui.introModeLabel, config.label);
  setText(ui.introAiName, config.aiName);
  setText(ui.introTitle, config.introTitle || "스파링 준비");
  setText(
    ui.introDesc,
    config.introDesc || `${config.label} 모드입니다. FIGHT 버튼을 누르면 카운트다운 뒤 실제 경기가 시작됩니다.`,
  );
  setListItems(ui.introMethods, config.introMethods || []);
  setListItems(ui.introStance, config.introStance || []);

  if (ui.introPlayerImage) {
    ui.introPlayerImage.removeAttribute("data-error");
    ui.introPlayerImage.src = config.playerImage || "";
    ui.introPlayerImage.onerror = () => {
      ui.introPlayerImage.dataset.error = "";
    };
  }
  SparringSound.playReadyRound();
}

function closeIntroModal() {
  if (ui.introModal) {
    delete ui.introModal.dataset.visible;
  }
  SparringSound.stopReady();
}

function setStance(nextStance) {
  if (ui.game) {
    ui.game.dataset.stance = nextStance;
  }

  ui.stanceChips?.forEach((chip, stance) => {
    if (stance === nextStance) {
      chip.dataset.active = "";
    } else {
      delete chip.dataset.active;
    }
  });
}

function setAiHpTier() {
  if (!ui.aiWrap) {
    return;
  }
  const pct = state.opponentHp;
  if (pct <= 15) {
    ui.aiWrap.dataset.aiHpTier = "critical";
  } else if (pct <= 35) {
    ui.aiWrap.dataset.aiHpTier = "low";
  } else {
    delete ui.aiWrap.dataset.aiHpTier;
  }
}

function computeLiveScore() {
  const accuracy = state.attackAttempts ? (state.hits / state.attackAttempts) * 100 : 0;
  const dodgeSuccessRate = state.dodgeAttempts ? (state.dodgeSuccessCount / state.dodgeAttempts) * 100 : 0;
  const avgReaction = state.reactionSamples ? state.reactionTotalMs / state.reactionSamples : 0;
  const damageScore = clamp(100 - state.opponentHp, 0, 100) * 0.35;
  const accuracyScore = clamp(accuracy, 0, 100) * 0.25;
  const survivalScore = clamp(state.playerHp, 0, 100) * 0.15;
  const defenseScore = clamp(dodgeSuccessRate, 0, 100) * 0.15;
  const comboScore = Math.min(state.maxCombo, 10);
  const perfectScore = Math.min(state.perfectCount * 2, 10);
  const reactionScore = avgReaction > 0 ? clamp((900 - avgReaction) / 900 * 10, 0, 10) : 0;
  return clamp(Math.round(damageScore + accuracyScore + survivalScore + defenseScore + comboScore + perfectScore + reactionScore), 0, 100);
}

function syncDerivedStats() {
  state.accuracy = state.attackAttempts ? (state.hits / state.attackAttempts) * 100 : 0;
  state.dodgeSuccessRate = state.dodgeAttempts ? (state.dodgeSuccessCount / state.dodgeAttempts) * 100 : 0;
  state.averageReactionMs = state.reactionSamples ? state.reactionTotalMs / state.reactionSamples : 0;
  state.score = computeLiveScore();
}

function isGameRunning() {
  return state.gameState === "countdown" || state.gameState === "round_active";
}

function startCountdown(nextRound = state.round) {
  clearTimer("countdown");
  setGameState("countdown");
  let current = 3;

  if (ui.countdownOverlay) {
    ui.countdownOverlay.dataset.visible = "";
  }
  if (ui.countdownRound) {
    setText(ui.countdownRound, `ROUND ${nextRound}`);
  }

  if (ui.countdownNumber) {
    ui.countdownNumber.textContent = String(current);
    ui.countdownNumber.dataset.n = String(current);
    delete ui.countdownNumber.dataset.fight;
    void ui.countdownNumber.offsetWidth;
  }

  FX.setCoachTip("카운트다운이 끝나면 바로 스파링이 시작됩니다.");

  state.timers.countdown = window.setInterval(() => {
    current -= 1;
    if (current > 0) {
      if (ui.countdownNumber) {
        ui.countdownNumber.textContent = String(current);
        ui.countdownNumber.dataset.n = String(current);
        delete ui.countdownNumber.dataset.fight;
        void ui.countdownNumber.offsetWidth;
      }
      return;
    }

    clearTimer("countdown");
    if (ui.countdownNumber) {
      ui.countdownNumber.textContent = "FIGHT!";
      ui.countdownNumber.dataset.n = "1";
      ui.countdownNumber.dataset.fight = "";
      void ui.countdownNumber.offsetWidth;
    }
    window.setTimeout(() => {
      if (ui.countdownOverlay) {
        delete ui.countdownOverlay.dataset.visible;
      }
      beginRound(nextRound);
    }, 450);
  }, 1000);
}

function startRoundTick() {
  clearTimer("roundTick");
  state.timers.roundTick = window.setInterval(() => {
    const msLeft = state.roundEndsAt - Date.now();
    syncHitZoneOverlay();
    updateRoundTimer(msLeft);
    if (msLeft <= 0) {
      clearTimer("roundTick");
      handleRoundComplete();
    }
  }, 250);
}

function pauseForObstacle(message = "장애물을 치워주세요") {
  if (state.obstaclePause.active || state.gameState !== "round_active") {
    return;
  }
  state.obstaclePause.active = true;
  state.obstaclePause.previousGameState = state.gameState;
  state.obstaclePause.remainingRoundMs = Math.max(0, state.roundEndsAt - Date.now());

  setGameState("safety_paused");
  clearTimer("roundTick");
  clearTimer("aiAttack");
  stopTimelineMarkerLoop();
  ui.aiVideo?.pause();
  SparringSound.pauseAll?.();
  FX.setCoachTip(message);
  updateRoundTimer(state.obstaclePause.remainingRoundMs);
}

function resumeFromObstacle() {
  if (!state.obstaclePause.active) {
    return;
  }
  const shouldResumeRound = state.obstaclePause.previousGameState === "round_active";
  const remainingRoundMs = Math.max(0, state.obstaclePause.remainingRoundMs);
  state.obstaclePause.active = false;
  state.obstaclePause.previousGameState = "";
  state.obstaclePause.remainingRoundMs = 0;

  if (!shouldResumeRound || remainingRoundMs <= 0 || state.gameState === "game_over") {
    return;
  }

  setGameState("round_active");
  state.roundEndsAt = Date.now() + remainingRoundMs;
  updateRoundTimer(remainingRoundMs);
  startRoundTick();

  if (ui.aiVideo) {
    ui.aiVideo.play().catch((error) => {
      console.warn("[sparring] 안전 일시정지 후 영상 재개 실패:", error?.message || error);
    });
  }
  if (state.timelineMarkers.length) {
    startTimelineMarkerLoop({ reset: false });
  } else {
    scheduleAiAttack();
  }
  SparringSound.resumeAll?.();
  FX.setCoachTip(resolveCoachTip());
}

async function beginRound(roundNumber) {
  if (LOCAL_SPARRING_VIDEO_SRC[state.mode] && !state.timelineMarkers.length) {
    loadCpuAttackTimelineFromData(state.mode);
  }
  await ensureAiVideoLoaded();
  state.round = roundNumber;
  updateRoundLabel();
  state.roundDurationMs = state.config.roundDurationSec * 1000;
  state.roundEndsAt = Date.now() + state.roundDurationMs;
  if (ui.aiVideo) {
    ui.aiVideo.pause();
    ui.aiVideo.playbackRate = 1;
    ui.aiVideo.currentTime = 0;
    resetTimelineMarkerState();
  }
  setGameState("round_active");
  if (ui.aiVideo) {
    try {
      await ui.aiVideo.play();
    } catch (error) {
      console.warn("[sparring] 영상 재생:", error?.message || error);
    }
    if (state.timelineMarkers.length) {
      startTimelineMarkerLoop();
    }
  }
  setStance("guard");
  FX.roundTransition(state.round);
  FX.setCoachTip(resolveCoachTip());
  updateRoundTimer(state.roundDurationMs);
  clearTimer("aiAttack");
  startRoundTick();

  scheduleAiAttack();
  syncHud();
}

function applyPlayerAttack(action, { source = "manual" } = {}) {
  if (state.gameState !== "round_active") {
    return;
  }

  const cfg = ACTION_MAP[action];
  if (!cfg) {
    return;
  }

  SparringSound.playWhoosh();
  state.activeDefense = null;
  setStance("attack");
  state.attackAttempts += 1;
  state.lastPunchSpeed = Math.max(cfg.speed, state.lastPunchSpeed || 0);

  const now = Date.now();
  const counterWindow =
    state.currentAiAttack &&
    now >= state.currentAiAttack.startedAt &&
    now <= state.currentAiAttack.expiresAt + 520;
  const openWindow = !state.currentAiAttack || now - state.lastAiAttackAt > 520;
  const contact = resolveHitZoneContact(action);
  const hasPoseContact = Boolean(contact.contact);
  const isPoseInput = source === "pose";
  const poseCounterHit = isPoseInput && Boolean(counterWindow);
  const poseOpenHit = isPoseInput && openWindow && state.lastPunchSpeed >= 1.2;
  const landed = isPoseInput
    ? hasPoseContact || poseCounterHit || poseOpenHit
    : hasPoseContact || counterWindow || openWindow;
  const perfectWindow =
    Boolean(state.currentAiAttack) &&
    (isPoseInput ? ((hasPoseContact || poseCounterHit) && counterWindow) : (hasPoseContact || counterWindow)) &&
    Math.abs(now - state.currentAiAttack.impactAt) <= 260;

  if (!landed) {
    state.combo = 0;
    FX.showJudgment(ui.playerJudgment, "MISS", "damage");
    FX.setCoachTip("주먹이 얼굴/몸통 히트존에 들어오지 않았습니다. 화면 중앙의 상대를 향해 더 곧게 뻗어보세요.");
    syncDerivedStats();
    syncHud();
    setActionActive(action);
    window.setTimeout(() => {
      if (state.gameState === "round_active") {
        setStance("guard");
      }
    }, 220);
    return;
  }

  SparringSound.playPunch();
  state.combo += 1;
  state.maxCombo = Math.max(state.maxCombo, state.combo);
  state.hits += 1;

  if (perfectWindow) {
    state.perfectCount += 1;
    state.reactionTotalMs += Math.abs(now - state.currentAiAttack.impactAt);
    state.reactionSamples += 1;
  }

  const targetBonus = contact.target === "head" ? 1.25 : contact.target === "body" ? 1.08 : 1;
  const damageMultiplier = (action === "hook" ? 1.2 : action === "cross" ? 1.1 : action === "jab" ? 1 : 0.9) * targetBonus;
  const damage = Math.round(cfg.damage * damageMultiplier);
  state.opponentHp = clamp(state.opponentHp - damage, 0, 100);

  const scoreBoost = cfg.score + (state.combo >= 3 ? state.combo * 20 : 0) + (perfectWindow ? 60 : 0);
  state.score = Math.min(100, Math.round(state.score + (scoreBoost * state.config.scoreMultiplier) / 100));

  if (perfectWindow) {
    FX.showJudgment(ui.playerJudgment, "PERFECT!", "perfect");
  } else if (contact.target === "head") {
    FX.showJudgment(ui.playerJudgment, "HEAD HIT!", "hit");
  } else if (contact.target === "body") {
    FX.showJudgment(ui.playerJudgment, "BODY HIT!", "hit");
  } else {
    FX.showJudgment(ui.playerJudgment, "HIT!", "hit");
  }
  FX.aiHit();
  FX.comboFlash(ui.comboFlash, state.combo);
  setAiHpTier();
  syncDerivedStats();
  syncHud();
  setActionActive(action);
  setAiState(perfectWindow ? "hurt" : "idle");

  if (state.opponentHp <= 0) {
    finishMatch("opponent-ko");
    return;
  }

  if (state.combo >= 5) {
    FX.setCoachTip("콤보 유지 중입니다. 지금 흐름을 끊지 마세요.");
  }

  window.setTimeout(() => {
    if (state.gameState === "round_active") {
      setStance("guard");
    }
  }, 260);
}

function handleAction(action, options = {}) {
  if (!isGameRunning()) {
    return;
  }

  const now = Date.now();
  state.activeDefense = null;

  if (action === "dodge" || action === "block") {
    state.activeDefense = action;
    state.activeDefenseAt = now;
    state.activeDefenseUntil = now + (state.config.defenseWindowMs || 900);
    state.lastPunchSpeed = 0;
    setStance(action === "dodge" ? "dodge" : "guard");
    setActionActive(action, 300);
    FX.setCoachTip(action === "dodge" ? "회피 자세를 유지하세요." : "가드를 단단히 잠그세요.");
    syncHud();
    window.setTimeout(() => {
      if (state.gameState === "round_active" && Date.now() > state.activeDefenseUntil) {
        setStance("guard");
      }
    }, state.config.defenseWindowMs || 900);
    return;
  }

  applyPlayerAttack(action, options);
}

function handleRoundComplete() {
  if (state.playerHp <= 0 || state.opponentHp <= 0) {
    finishMatch(state.opponentHp <= 0 ? "opponent-ko" : "player-ko");
    return;
  }

  if (state.round >= state.config.roundsTotal) {
    finishMatch("time");
    return;
  }

  state.roundsCleared += 1;
  setGameState("round_end");
  clearTimer("aiAttack");
  stopTimelineMarkerLoop();

  if (ui.reAiHp) {
    ui.reAiHp.textContent = Math.round(state.opponentHp);
  }
  if (ui.reScore) {
    ui.reScore.textContent = formatScore(state.score);
  }
  if (ui.rePlayerHp) {
    ui.rePlayerHp.textContent = Math.round(state.playerHp);
  }
}

function buildFinalResult(winner, reason) {
  syncDerivedStats();
  const modeLabel = state.config.label || state.mode.toUpperCase();
  const final = {
    gameType: "sparring",
    mode: state.mode,
    modeLabel,
    roundsTotal: state.config.roundsTotal,
    round: state.round,
    score: Math.max(0, Math.round(state.score)),
    maxCombo: state.maxCombo,
    hitCount: state.hits,
    dodgeCount: state.dodgeCount,
    perfectCount: state.perfectCount,
    playerHp: Math.round(state.playerHp),
    opponentHp: Math.round(state.opponentHp),
    accuracy: Math.round(state.accuracy),
    dodgeSuccessRate: Math.round(state.dodgeSuccessRate),
    averageReactionMs: Math.round(state.averageReactionMs),
    coachComment: buildCoachComment(winner, reason),
    sessionId: state.sessionId,
    durationSec: state.config.roundDurationSec * state.config.roundsTotal,
    grade: resolveGrade(),
    analysisLabel: `SPARRING ${modeLabel}`,
    winner,
    reason,
    endedAt: new Date().toISOString(),
  };
  return final;
}

function resolveGrade() {
  const score = state.score;
  const accuracy = state.accuracy;
  if (score >= 90 && accuracy >= 85) return "S";
  if (score >= 80 && accuracy >= 75) return "A";
  if (score >= 70 && accuracy >= 60) return "B";
  if (score >= 55) return "C";
  return "D";
}

function buildCoachComment(winner, reason) {
  const grade = resolveGrade();
  if (winner === "player" && reason === "opponent-ko") {
    return "완벽한 압박이었다. 상대를 끝까지 흔들었다.";
  }
  if (grade === "S") {
    return "완벽한 스파링이었다. 정확도와 리듬이 매우 좋다.";
  }
  if (grade === "A" && state.maxCombo >= 5) {
    return "좋은 리듬이다. 콤보를 조금만 더 길게 유지해보자.";
  }
  if (state.accuracy < 50) {
    return "정확도를 먼저 올려라. 빠른 것보다 정확한 타격이 중요하다.";
  }
  if (state.playerHp < 20) {
    return "체력 관리가 필요하다. 가드 타이밍을 다시 잡아라.";
  }
  if (winner === "player") {
    return "잘 싸웠다. 다음 라운드에서는 더 깔끔한 흐름을 노려보자.";
  }
  return "다시 도전하라. 한 템포 늦추면 더 강해진다.";
}

async function persistResult(finalResult) {
  if (state.resultSent || state.saving) {
    return;
  }

  state.saving = true;
  window.localStorage.setItem(STORAGE_KEYS.lastResult, JSON.stringify(finalResult));
  window.localStorage.setItem(STORAGE_KEYS.draft, JSON.stringify(finalResult));
  window.localStorage.setItem("im_boxer_sparring_last_result", JSON.stringify(finalResult));
  window.localStorage.setItem(STORAGE_KEYS.pendingSave, JSON.stringify({
    ...finalResult,
    saveStatus: "pending",
    saveAttemptedAt: new Date().toISOString(),
  }));

  try {
    const response = await authFetch("/api/sparring/end", {
      method: "POST",
      body: JSON.stringify({
        mode: finalResult.mode,
        sessionId: finalResult.sessionId,
        score: finalResult.score,
        maxCombo: finalResult.maxCombo,
        hitCount: finalResult.hitCount,
        dodgeCount: finalResult.dodgeCount,
        perfectCount: finalResult.perfectCount,
        playerHp: finalResult.playerHp,
        opponentHp: finalResult.opponentHp,
        accuracy: finalResult.accuracy,
        dodgeSuccessRate: finalResult.dodgeSuccessRate,
        averageReactionMs: finalResult.averageReactionMs,
        grade: finalResult.grade,
        coachComment: finalResult.coachComment,
        durationSec: finalResult.durationSec,
        endedAt: finalResult.endedAt,
      }),
    });

    if (response.ok) {
      const data = await response.json().catch(() => null);
      if (data) {
        const merged = { ...finalResult, serverResult: data, saveStatus: "saved" };
        window.localStorage.setItem(STORAGE_KEYS.lastResult, JSON.stringify(merged));
        window.localStorage.setItem("im_boxer_sparring_last_result", JSON.stringify(merged));
        window.localStorage.removeItem(STORAGE_KEYS.pendingSave);
      }
    } else if (response.status === 401 || response.status === 403) {
      window.localStorage.setItem(STORAGE_KEYS.pendingSave, JSON.stringify({
        ...finalResult,
        saveStatus: "auth_required",
        saveHttpStatus: response.status,
        saveAttemptedAt: new Date().toISOString(),
      }));
      return;
    } else {
      window.localStorage.setItem(STORAGE_KEYS.pendingSave, JSON.stringify({
        ...finalResult,
        saveStatus: "failed",
        saveHttpStatus: response.status,
        saveAttemptedAt: new Date().toISOString(),
      }));
    }
  } catch (error) {
    console.warn("sparring result save failed:", error);
    window.localStorage.setItem(STORAGE_KEYS.pendingSave, JSON.stringify({
      ...finalResult,
      saveStatus: "failed",
      saveError: String(error?.message || error),
      saveAttemptedAt: new Date().toISOString(),
    }));
  } finally {
    state.resultSent = true;
    state.saving = false;
  }
}

function finishMatch(reason = "time") {
  if (state.gameState === "game_over") {
    return;
  }

  clearAllTimers();
  state.currentAiAttack = null;
  syncDerivedStats();

  const winner =
    state.opponentHp <= 0
      ? "player"
      : state.playerHp <= 0
        ? "ai"
        : state.score >= state.config.winScoreThreshold
          ? "player"
          : "ai";
  const isKoFinish = reason === "opponent-ko" || reason === "player-ko";

  setGameState("game_over");
  SparringSound.playResult(winner);
  setStance(winner === "player" ? "attack" : "guard");
  setAiState(winner === "player" && isKoFinish ? "ko" : "winning");
  if (isKoFinish) {
    FX.koSequence(winner === "player" ? "player" : "ai");
  }

  if (ui.gameoverResult) {
    ui.gameoverResult.textContent = winner === "player" ? "YOU WIN!" : "YOU LOSE!";
    ui.gameoverResult.className = `ss-go-result ${winner === "player" ? "ss-go-win" : "ss-go-lose"}`;
  }
  if (ui.gameoverSub) {
    ui.gameoverSub.textContent =
      winner === "player"
        ? "상대를 잘 흔들었습니다. 결과를 확인하세요."
        : "다시 올라가 보세요. 흐름은 잡을 수 있습니다.";
  }

  const finalResult = buildFinalResult(winner, reason);
  void persistResult(finalResult);

  if (ui.startButton) {
    ui.startButton.textContent = "재시작";
  }

  syncHud();
}

async function startMatch() {
  if (state.gameState === "countdown" || state.gameState === "round_active") {
    return;
  }

  if (ui.fightButton) {
    ui.fightButton.disabled = true;
    ui.fightButton.dataset.loading = "";
  }
  await waitForAiVideoReady();
  if (ui.fightButton) {
    ui.fightButton.disabled = false;
    delete ui.fightButton.dataset.loading;
  }

  clearAllTimers();
  state.sessionId = `sp_${Date.now()}`;
  state.round = 1;
  state.roundsCleared = 0;
  state.score = 0;
  state.combo = 0;
  state.maxCombo = 0;
  state.hits = 0;
  state.attackAttempts = 0;
  state.dodgeCount = 0;
  state.dodgeAttempts = 0;
  state.dodgeSuccessCount = 0;
  state.perfectCount = 0;
  state.playerHp = 100;
  state.opponentHp = state.config.opponentHp;
  state.lastPunchSpeed = 0;
  state.reactionTotalMs = 0;
  state.reactionSamples = 0;
  state.averageReactionMs = 0;
  state.accuracy = 0;
  state.dodgeSuccessRate = 0;
  state.resultSent = false;
  state.activeDefense = null;
  state.activeDefenseUntil = 0;
  state.currentAiAttack = null;
  state.aiPatternQueue = [];
  state.poseSnapshot = null;
  state.poseMotionSample = null;
  state.latestPoseLandmarks = null;
  state.poseLastAnalyzeAt = 0;
  state.poseLastActionAt = 0;
  state.poseLastActionKey = "";
  drawPoseOverlay(null);
  updatePoseStatus("POSE 대기", "idle");
  setStance("guard");

  if (ui.countdownNumber) {
    ui.countdownNumber.textContent = "3";
    ui.countdownNumber.dataset.n = "3";
  }

  setText(ui.gameoverResult, "");
  setText(ui.gameoverSub, "");
  closeIntroModal();
  SparringSound.playCrowdAndBell();
  window.setTimeout(() => SparringSound.startModeBgm(state.mode, { restart: true }), 1250);
  if (!state.webcamReady && !state.cameraStream) {
    void setupWebcam();
  }
  if (ui.aiVideo) {
    ui.aiVideo.currentTime = 0;
  }
  setGameState("countdown");
  syncHud();
  startCountdown(1);
}

function stopMatch() {
  if (!isGameRunning() && state.gameState !== "round_end") {
    return;
  }

  finishMatch("stop");
}

function startNextRound() {
  if (state.gameState !== "round_end") {
    return;
  }
  state.round += 1;
  setText(ui.roundEndOverlayTitle, "ROUND END");
  setGameState("countdown");
  if (ui.roundEndOverlay) {
    delete ui.roundEndOverlay.dataset.visible;
  }
  startCountdown(state.round);
}

function bindActionButtons() {
  ui.actionButtons.forEach((button, action) => {
    button.addEventListener("click", () => handleAction(action, { source: "button" }));
  });

  window.addEventListener("keydown", (event) => {
    const target = event.target;
    if (target instanceof HTMLElement) {
      const tagName = target.tagName.toLowerCase();
      if (tagName === "input" || tagName === "textarea" || tagName === "select" || target.isContentEditable) {
        return;
      }
    }
    const key = String(event.key || "").toLowerCase();
    const code = String(event.code || "");
    const action =
      key === "j" || code === "KeyJ" ? "jab" :
      key === "k" || code === "KeyK" ? "cross" :
      key === "h" || code === "KeyH" || key === "l" || code === "KeyL" ? "hook" :
      key === "d" || code === "KeyD" ? "dodge" :
      key === "b" || code === "KeyB" ? "block" :
      "";

    if (action) {
      event.preventDefault();
      if (event.repeat && action !== "dodge" && action !== "block") {
        return;
      }
      handleAction(action, { source: "keyboard" });
      return;
    }
    if (key === "enter" && state.gameState === "idle") openIntroModal();
  }, { capture: true });
}

function bindControls() {
  ui.startButton?.addEventListener("click", () => {
    if (state.gameState === "game_over") {
      window.location.reload();
      return;
    }
    if (state.gameState === "idle") {
      openIntroModal();
      return;
    }
    startMatch();
  });

  ui.fightButton?.addEventListener("click", () => startMatch());

  ui.stopButton?.addEventListener("click", () => stopMatch());

  ui.nextRoundButton?.addEventListener("click", () => {
    if (state.gameState !== "round_end") {
      return;
    }
    startNextRound();
  });

  ui.toResultButton?.addEventListener("click", () => {
    window.location.href = `./result.html?mode=${encodeURIComponent(state.mode)}`;
  });

  ui.rematchButton?.addEventListener("click", () => {
    window.location.reload();
  });

  window.addEventListener("im-boxer-sparring-sound-change", (event) => {
    if (!event.detail?.enabled) {
      return;
    }
    if (state.gameState === "idle" && ui.introModal?.dataset.visible !== undefined) {
      SparringSound.playReadyRound();
      return;
    }
    if (state.gameState === "countdown" || state.gameState === "round_active") {
      SparringSound.startModeBgm(state.mode, { restart: true });
    }
  });

  window.addEventListener("boxer:obstacle-danger-change", (event) => {
    const detail = event.detail || {};
    if (detail.active) {
      pauseForObstacle(detail.message || "장애물을 치워주세요");
      return;
    }
    resumeFromObstacle();
  });

  ui.adminToggle?.addEventListener("click", () => {
    toggleAdminPanel();
  });

  ui.adminClose?.addEventListener("click", () => {
    closeAdminPanel();
  });

  ui.adminApply?.addEventListener("click", () => {
    const snapshot = collectAdminTuningFromPanel();
    applyAdminTuning(snapshot, { persist: false });
  });

  ui.adminSave?.addEventListener("click", () => {
    const snapshot = collectAdminTuningFromPanel();
    applyAdminTuning(snapshot, { persist: true });
  });

  ui.adminReset?.addEventListener("click", () => {
    resetAdminTuning();
    syncAdminPanel();
  });

  ui.adminContent?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-admin-nudge]");
    if (!button) {
      return;
    }

    event.preventDefault();
    applyAdminNudge(button.dataset.adminNudge);
  });

  ui.adminModeSelect?.addEventListener("change", (event) => {
    const nextMode = event.target.value;
    if (Object.prototype.hasOwnProperty.call(MODE_CONFIG, nextMode)) {
      state.adminEditMode = nextMode;
      syncAdminPanel();
    }
  });

  window.addEventListener("keydown", (event) => {
    if (!(state.adminMode || window.localStorage.getItem("im_boxer_sparring_admin_mode") === "1")) {
      return;
    }

    if (event.altKey && event.shiftKey && event.key.toLowerCase() === "a") {
      event.preventDefault();
      toggleAdminPanel();
    }

    if (event.key === "Escape" && state.adminPanelOpen) {
      closeAdminPanel();
    }
  });
}

function bindDraftPersistence() {
  state.timers.persist = window.setInterval(() => {
    if (state.gameState === "idle") {
      return;
    }
    const draft = {
      mode: state.mode,
      sessionId: state.sessionId,
      score: Math.min(100, Math.round(state.score)),
      maxCombo: state.maxCombo,
      hitCount: state.hits,
      dodgeCount: state.dodgeCount,
      perfectCount: state.perfectCount,
      playerHp: Math.round(state.playerHp),
      opponentHp: Math.round(state.opponentHp),
      accuracy: Math.round(state.accuracy),
      dodgeSuccessRate: Math.round(state.dodgeSuccessRate),
      averageReactionMs: Math.round(state.averageReactionMs),
      coachComment: resolveCoachTip(),
      durationSec: state.config.roundDurationSec * state.config.roundsTotal,
      endedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(STORAGE_KEYS.draft, JSON.stringify(draft));
  }, 5000);
}

function cacheDom() {
  ui.game = $(".ss-game");
  ui.modeBadge = $(".ss-mode-badge");
  ui.aiName = $("[data-ai-name]");
  ui.playerName = $("[data-user-name]");
  ui.roundLabel = $("[data-round-label]");
  ui.roundTimer = $("[data-round-timer]");
  ui.playerHpBar = $("[data-player-hp-bar]");
  ui.aiHpBar = $("[data-ai-hp-bar]");
  ui.playerHp = $("[data-player-hp]");
  ui.aiHp = $("[data-ai-hp]");
  ui.score = $("[data-sparring-score]");
  ui.combo = $("[data-sparring-combo]");
  ui.hitCount = $("[data-sparring-hit-count]");
  ui.punchSpeed = $("[data-punch-speed]");
  ui.coachJab = $("[data-coach-jab]");
  ui.coachGuard = $("[data-coach-guard]");
  ui.coachDistance = $("[data-coach-distance]");
  ui.coachAccuracy = $("[data-coach-accuracy]");
  ui.coachReaction = $("[data-coach-reaction]");
  ui.coachTip = $("[data-coach-tip]");
  ui.startButton = $("[data-start-sparring]");
  ui.stopButton = $("[data-stop-sparring]");
  ui.nextRoundButton = $("[data-next-round]");
  ui.toResultButton = $("[data-to-result]");
  ui.rematchButton = $("[data-rematch]");
  ui.countdownOverlay = $("[data-countdown-overlay]");
  ui.countdownRound = $("[data-countdown-round]");
  ui.countdownNumber = $("[data-countdown-number]");
  ui.roundEndOverlay = $("[data-round-end-overlay]");
  ui.gameoverOverlay = $("[data-gameover-overlay]");
  ui.gameoverResult = $("[data-gameover-result]");
  ui.gameoverSub = $("[data-gameover-sub]");
  ui.reAiHp = $("[data-re-ai-hp]");
  ui.reScore = $("[data-re-score]");
  ui.rePlayerHp = $("[data-re-player-hp]");
  ui.roundFlash = $("[data-round-flash]");
  ui.roundFlashText = $("[data-round-flash-text]");
  ui.playerJudgment = $("[data-player-judgment]");
  ui.comboFlash = $("[data-combo-flash]");
  ui.aiWrap = $(".ss-ai-wrap");
  ui.aiVideo = $("[data-ai-video]");
  ui.hitZoneOverlay = $("[data-hit-zone-overlay]");
  ui.hitZones = {
    head: $('[data-hit-zone="head"]'),
    body: $('[data-hit-zone="body"]'),
  };
  ui.introModal = $("[data-sparring-intro-modal]");
  ui.fightButton = $("[data-fight-start]");
  ui.introPlayerImage = $("[data-intro-player-image]");
  ui.introModeLabel = $("[data-intro-mode-label]");
  ui.introAiName = $("[data-intro-ai-name]");
  ui.introTitle = $("[data-intro-title]");
  ui.introDesc = $("[data-intro-desc]");
  ui.introMethods = $("[data-intro-methods]");
  ui.introStance = $("[data-intro-stance]");
  ui.adminToggle = $("[data-admin-toggle]");
  ui.adminPanel = $("[data-admin-panel]");
  ui.adminClose = $("[data-admin-close]");
  ui.adminApply = $("[data-admin-apply]");
  ui.adminSave = $("[data-admin-save]");
  ui.adminReset = $("[data-admin-reset]");
  ui.adminModeSelect = $("[data-admin-mode-select]");
  ui.adminContent = $("[data-admin-content]");
  ui.webcam = $("[data-sparring-webcam]");
  ui.poseOverlay = $("[data-pose-overlay]");
  ui.poseStatus = $("[data-pose-status]");
  ui.camOffline = $(".ss-cam-offline");
  ui.stanceChips = new Map(
    $all("[data-stance-chip]").map((chip) => [chip.dataset.stanceChip, chip]),
  );
  ui.actionButtons = new Map(
    $all("[data-action-hint]").map((button) => [button.dataset.actionHint, button]),
  );
}

async function hydrateUser() {
  const storedUser = getStoredUser();
  if (storedUser) {
    state.user = storedUser;
  }

  const refreshed = await refreshCurrentUser().catch(() => null);
  if (refreshed) {
    state.user = refreshed;
  }

  if (!state.user) {
    continueAsGuest();
  }

  if (ui.playerName) {
    ui.playerName.textContent = state.user.nickname || state.user.username || state.user.email || "PLAYER";
  }

  return true;
}

function initModeFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode");
  applyMode(Object.prototype.hasOwnProperty.call(MODE_CONFIG, mode) ? mode : "beginner");
  state.adminEditMode = state.mode;
  const admin = params.get("admin");
  state.adminMode = admin === "1" || admin === "true" || window.localStorage.getItem("im_boxer_sparring_admin_mode") === "1";
  state.adminPanelOpen = state.adminMode;
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch((error) => {
    console.error("sparring-start init failed:", error);
    continueAsGuest();
  });
});

window.addEventListener("beforeunload", cleanupResources);

window.IM_BOXER_SPARRING_START = {
  startMatch,
  stopMatch,
  applyMode,
  getAdminTuning: getAdminTuningSnapshot,
  applyAdminTuning: (snapshot) => applyAdminTuning(snapshot, { persist: false }),
  saveAdminTuning: (snapshot) => applyAdminTuning(snapshot, { persist: true }),
  resetAdminTuning,
  openAdminPanel,
  closeAdminPanel,
  getState: () => ({ ...state }),
};

function configureSparringModes() {
  const beginner = MODE_CONFIG.beginner;
  const intermediate = MODE_CONFIG.intermediate;
  const advanced = MODE_CONFIG.advanced;
  const pro = MODE_CONFIG.pro;
  const timing = SPARRING_MODE_TIMING;

  if (beginner) {
    Object.assign(beginner, timing.beginner);
    beginner.attackPatterns = beginner.attackPatterns || [["jab"], ["cross"], ["jab", "cross"]];
  }

  if (intermediate) {
    Object.assign(intermediate, timing.intermediate);
    intermediate.attackPatterns = intermediate.attackPatterns || [["jab", "cross"], ["cross", "hook"], ["jab", "hook"]];
  }

  if (advanced) {
    Object.assign(advanced, timing.advanced);
    advanced.attackPatterns = advanced.attackPatterns || [["jab", "cross", "hook"], ["cross", "jab", "hook"]];
  }

  if (pro) {
    Object.assign(pro, timing.pro);
    pro.attackPatterns = pro.attackPatterns || [["jab", "cross", "hook"], ["cross", "hook", "jab"], ["jab", "cross", "jab", "hook"]];
  }
}

configureSparringModes();

state.adminTuning = loadAdminTuning();
applyAdminTuning(state.adminTuning, { persist: false, skipSync: true });

function getPoseTracker() {
  return window.IM_BOXER_POSE_TRACKER || state.poseTracker || null;
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createDefaultAdminTuning() {
  return {
    modeTiming: deepClone(SPARRING_MODE_TIMING),
    attackCuePoints: deepClone(AI_ATTACK_CUE_POINTS),
    modeConfig: deepClone({
      beginner: {
        aiAttackIntervalMs: MODE_CONFIG.beginner.aiAttackIntervalMs,
        aiDamage: MODE_CONFIG.beginner.aiDamage,
        opponentHp: MODE_CONFIG.beginner.opponentHp,
        roundsTotal: MODE_CONFIG.beginner.roundsTotal,
        roundDurationSec: MODE_CONFIG.beginner.roundDurationSec,
        scoreMultiplier: MODE_CONFIG.beginner.scoreMultiplier,
        winScoreThreshold: MODE_CONFIG.beginner.winScoreThreshold,
      },
      intermediate: {
        aiAttackIntervalMs: MODE_CONFIG.intermediate.aiAttackIntervalMs,
        aiDamage: MODE_CONFIG.intermediate.aiDamage,
        opponentHp: MODE_CONFIG.intermediate.opponentHp,
        roundsTotal: MODE_CONFIG.intermediate.roundsTotal,
        roundDurationSec: MODE_CONFIG.intermediate.roundDurationSec,
        scoreMultiplier: MODE_CONFIG.intermediate.scoreMultiplier,
        winScoreThreshold: MODE_CONFIG.intermediate.winScoreThreshold,
      },
      advanced: {
        aiAttackIntervalMs: MODE_CONFIG.advanced.aiAttackIntervalMs,
        aiDamage: MODE_CONFIG.advanced.aiDamage,
        opponentHp: MODE_CONFIG.advanced.opponentHp,
        roundsTotal: MODE_CONFIG.advanced.roundsTotal,
        roundDurationSec: MODE_CONFIG.advanced.roundDurationSec,
        scoreMultiplier: MODE_CONFIG.advanced.scoreMultiplier,
        winScoreThreshold: MODE_CONFIG.advanced.winScoreThreshold,
      },
      pro: {
        aiAttackIntervalMs: MODE_CONFIG.pro.aiAttackIntervalMs,
        aiDamage: MODE_CONFIG.pro.aiDamage,
        opponentHp: MODE_CONFIG.pro.opponentHp,
        roundsTotal: MODE_CONFIG.pro.roundsTotal,
        roundDurationSec: MODE_CONFIG.pro.roundDurationSec,
        scoreMultiplier: MODE_CONFIG.pro.scoreMultiplier,
        winScoreThreshold: MODE_CONFIG.pro.winScoreThreshold,
      },
    }),
    pose: { ...POSE_TUNING },
    hitZones: deepClone(HIT_ZONE_CONFIG),
  };
}

function normalizeAdminTuning(snapshot) {
  const fallback = createDefaultAdminTuning();
  const source = snapshot && typeof snapshot === "object" ? snapshot : {};
  const normalized = createDefaultAdminTuning();

  for (const mode of Object.keys(fallback.modeTiming)) {
    normalized.modeTiming[mode] = {
      ...fallback.modeTiming[mode],
      ...(source.modeTiming?.[mode] || {}),
    };
  }

  for (const mode of Object.keys(fallback.attackCuePoints)) {
    normalized.attackCuePoints[mode] = {};
    const modeSource = source.attackCuePoints?.[mode] || {};
    for (const attackType of Object.keys(fallback.attackCuePoints[mode])) {
      normalized.attackCuePoints[mode][attackType] = {
        ...fallback.attackCuePoints[mode][attackType],
        ...(modeSource[attackType] || {}),
      };
    }
  }

  normalized.modeConfig = {};
  for (const mode of Object.keys(fallback.modeConfig)) {
    normalized.modeConfig[mode] = {
      ...fallback.modeConfig[mode],
      ...(source.modeConfig?.[mode] || {}),
    };
  }

  normalized.pose = {
    ...fallback.pose,
    ...(source.pose || {}),
  };

  normalized.hitZones = deepClone(fallback.hitZones);
  for (const mode of Object.keys(fallback.hitZones)) {
    normalized.hitZones[mode] = {
      ...fallback.hitZones[mode],
      ...(source.hitZones?.[mode] || {}),
      head: {
        ...fallback.hitZones[mode].head,
        ...(source.hitZones?.[mode]?.head || {}),
      },
      body: {
        ...fallback.hitZones[mode].body,
        ...(source.hitZones?.[mode]?.body || {}),
      },
      timeline: Array.isArray(source.hitZones?.[mode]?.timeline)
        ? source.hitZones[mode].timeline
        : fallback.hitZones[mode].timeline,
    };
  }

  return normalized;
}

function loadAdminTuning() {
  try {
    const raw = localStorage.getItem(ADMIN_TUNING_STORAGE_KEY);
    if (!raw) {
      return createDefaultAdminTuning();
    }
    return normalizeAdminTuning(JSON.parse(raw));
  } catch (error) {
    console.warn("Failed to load sparring admin tuning:", error);
    return createDefaultAdminTuning();
  }
}

function saveAdminTuning(snapshot) {
  try {
    localStorage.setItem(ADMIN_TUNING_STORAGE_KEY, JSON.stringify(snapshot));
  } catch (error) {
    console.warn("Failed to save sparring admin tuning:", error);
  }
}

function applyAdminTuning(snapshot, options = {}) {
  const normalized = normalizeAdminTuning(snapshot);
  const { persist = false, skipSync = false } = options;

  for (const mode of Object.keys(normalized.modeTiming)) {
    Object.assign(SPARRING_MODE_TIMING[mode], normalized.modeTiming[mode]);
  }

  for (const mode of Object.keys(normalized.attackCuePoints)) {
    const modeTable = AI_ATTACK_CUE_POINTS[mode] || (AI_ATTACK_CUE_POINTS[mode] = {});
    for (const attackType of Object.keys(normalized.attackCuePoints[mode])) {
      modeTable[attackType] = {
        ...(modeTable[attackType] || {}),
        ...normalized.attackCuePoints[mode][attackType],
      };
    }
  }

  for (const mode of Object.keys(normalized.modeConfig)) {
    Object.assign(MODE_CONFIG[mode], normalized.modeConfig[mode]);
  }

  Object.assign(POSE_TUNING, normalized.pose);
  state.adminTuning = normalized;

  configureSparringModes();

  if (persist) {
    saveAdminTuning(normalized);
  }

  if (!skipSync) {
    syncAdminPanel();
    syncHud();
  }
}

function getAdminTuningSnapshot() {
  return normalizeAdminTuning(state.adminTuning || loadAdminTuning());
}

function resetAdminTuning() {
  applyAdminTuning(createDefaultAdminTuning(), { persist: true });
}

function getPoseAnalyzer() {
  return window.IM_BOXER_POSE_ANALYZER || state.poseAnalyzer || null;
}

function getCameraSettings() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CAMERA_SETTINGS_KEY) || "{}");
    return {
      mode: parsed.mode === "environment" ? "environment" : "user",
      mirror: parsed.mirror !== false,
      overlay: parsed.overlay !== false,
    };
  } catch {
    return { mode: "user", mirror: true, overlay: true };
  }
}

function applyCameraVisualSettings() {
  const settings = getCameraSettings();
  const transform = settings.mirror ? "scaleX(-1)" : "scaleX(1)";
  if (ui.webcam) {
    ui.webcam.style.transform = transform;
    ui.webcam.style.transformOrigin = "center";
  }
  if (ui.poseOverlay) {
    ui.poseOverlay.style.transform = transform;
    ui.poseOverlay.style.transformOrigin = "center";
    ui.poseOverlay.style.display = settings.overlay ? "" : "none";
  }
  return settings;
}

function updatePoseStatus(message, status = "idle") {
  if (!ui.poseStatus) {
    return;
  }
  ui.poseStatus.textContent = message || "POSE 대기";
  ui.poseStatus.title = message || "";
  ui.poseStatus.dataset.state = status || "idle";
}

function drawPoseOverlay(landmarks) {
  const overlay = window.IM_BOXER_POSE_OVERLAY;
  if (!overlay || !ui.poseOverlay) {
    return;
  }
  if (!getCameraSettings().overlay) {
    if (typeof overlay.hide === "function") {
      overlay.hide(ui.poseOverlay);
    } else if (typeof overlay.clear === "function") {
      overlay.clear(ui.poseOverlay);
      ui.poseOverlay.style.display = "none";
    }
    return;
  }

  const hasLandmarks = Array.isArray(landmarks) && landmarks.length > 0;
  if (!hasLandmarks) {
    if (typeof overlay.clear === "function") {
      overlay.clear(ui.poseOverlay);
    }
    return;
  }

  if (typeof overlay.show === "function") {
    overlay.show(ui.poseOverlay);
  }
  if (typeof overlay.draw === "function") {
    overlay.draw(ui.poseOverlay, landmarks, ui.webcam);
  }
}

function ensurePoseBridgeState() {
  if (!state.poseSnapshot) {
    state.poseSnapshot = null;
  }
  if (!Array.isArray(state.aiPatternQueue)) {
    state.aiPatternQueue = [];
  }
}

function pickAiPattern() {
  const patterns = state.config.attackPatterns;
  if (!Array.isArray(patterns) || patterns.length === 0) {
    return ["jab"];
  }

  const pattern = patterns[Math.floor(Math.random() * patterns.length)];
  return Array.isArray(pattern) && pattern.length ? pattern.slice() : ["jab"];
}

function refillAiPatternQueue() {
  if (!Array.isArray(state.aiPatternQueue)) {
    state.aiPatternQueue = [];
  }
  if (state.aiPatternQueue.length === 0) {
    state.aiPatternQueue = pickAiPattern();
  }
}

function normalizePoseAction(action) {
  const key = String(action || "").trim().toLowerCase();
  return POSE_ACTION_MAP[key] || "";
}

function getLandmarkPoint(landmarks, index) {
  const source = Array.isArray(landmarks)
    ? landmarks
    : Array.isArray(landmarks?.landmarks)
      ? landmarks.landmarks
      : Array.isArray(landmarks?.poseLandmarks)
        ? landmarks.poseLandmarks
        : null;
  const point = source?.[index] || null;
  if (!point) {
    return null;
  }
  return {
    x: toNumber(point.x, 0.5),
    y: toNumber(point.y, 0.5),
    z: toNumber(point.z, 0),
    visibility: toNumber(point.visibility, 1),
  };
}

function distance2D(a, b) {
  if (!a || !b) {
    return 999;
  }
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function angleDeg(a, b, c) {
  if (!a || !b || !c) {
    return 180;
  }
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const cbx = c.x - b.x;
  const cby = c.y - b.y;
  const dot = abx * cbx + aby * cby;
  const magA = Math.hypot(abx, aby);
  const magC = Math.hypot(cbx, cby);
  if (!magA || !magC) {
    return 180;
  }
  const cosine = clamp(dot / (magA * magC), -1, 1);
  return Math.acos(cosine) * (180 / Math.PI);
}

function resolvePoseGuardAction(landmarks) {
  const nose = getLandmarkPoint(landmarks, 0);
  const leftShoulder = getLandmarkPoint(landmarks, 11);
  const rightShoulder = getLandmarkPoint(landmarks, 12);
  const leftElbow = getLandmarkPoint(landmarks, 13);
  const rightElbow = getLandmarkPoint(landmarks, 14);
  const leftWrist = getLandmarkPoint(landmarks, 15);
  const rightWrist = getLandmarkPoint(landmarks, 16);

  if (!leftShoulder || !rightShoulder || !leftWrist || !rightWrist) {
    return "";
  }

  const shoulderMid = {
    x: (leftShoulder.x + rightShoulder.x) / 2,
    y: (leftShoulder.y + rightShoulder.y) / 2,
  };
  const faceRef = nose || shoulderMid;
  const shoulderSpan = Math.max(Math.abs(rightShoulder.x - leftShoulder.x), 0.001);
  const bothHandsHigh =
    leftWrist.y < shoulderMid.y + 0.16 &&
    rightWrist.y < shoulderMid.y + 0.16;
  const bothHandsNearFace =
    distance2D(leftWrist, faceRef) < shoulderSpan * 0.9 &&
    distance2D(rightWrist, faceRef) < shoulderSpan * 0.9;
  const handsTogether = distance2D(leftWrist, rightWrist) < shoulderSpan * 0.72;
  const handsCentered =
    Math.abs(((leftWrist.x + rightWrist.x) / 2) - faceRef.x) < shoulderSpan * 0.42;
  const elbowsRaised = !leftElbow || !rightElbow || (
    leftElbow.y < shoulderMid.y + 0.28 &&
    rightElbow.y < shoulderMid.y + 0.28
  );
  const handsCoverBothSides =
    leftWrist.x < faceRef.x + shoulderSpan * 0.45 &&
    rightWrist.x > faceRef.x - shoulderSpan * 0.45;
  const compactFaceGuard = bothHandsHigh && bothHandsNearFace && handsTogether && handsCentered && elbowsRaised;
  const classicGuard = bothHandsHigh && bothHandsNearFace && handsCoverBothSides;

  return classicGuard || compactFaceGuard ? "block" : "";
}

function inferPoseActionFromLandmarks(landmarks, snapshot, now) {
  if (isUserGuarding(landmarks)) {
    return "";
  }

  const nose = getLandmarkPoint(landmarks, 0);
  const leftShoulder = getLandmarkPoint(landmarks, 11);
  const rightShoulder = getLandmarkPoint(landmarks, 12);
  const leftElbow = getLandmarkPoint(landmarks, 13);
  const rightElbow = getLandmarkPoint(landmarks, 14);
  const leftWrist = getLandmarkPoint(landmarks, 15);
  const rightWrist = getLandmarkPoint(landmarks, 16);
  const leftHip = getLandmarkPoint(landmarks, 23);
  const rightHip = getLandmarkPoint(landmarks, 24);

  if (!leftShoulder || !rightShoulder || !leftWrist || !rightWrist || !leftHip || !rightHip) {
    return "";
  }

  const shoulderMid = {
    x: (leftShoulder.x + rightShoulder.x) / 2,
    y: (leftShoulder.y + rightShoulder.y) / 2,
  };
  const hipMid = {
    x: (leftHip.x + rightHip.x) / 2,
    y: (leftHip.y + rightHip.y) / 2,
  };
  const shoulderSpan = Math.max(Math.abs(rightShoulder.x - leftShoulder.x), 0.001);
  const torsoHeight = Math.max(Math.abs(hipMid.y - shoulderMid.y), 0.001);
  const faceRef = nose || shoulderMid;
  const guardAction = resolvePoseGuardAction(landmarks);

  const leftElbowAngle = angleDeg(leftShoulder, leftElbow, leftWrist);
  const rightElbowAngle = angleDeg(rightShoulder, rightElbow, rightWrist);
  const leftReach = distance2D(leftWrist, leftShoulder) / shoulderSpan;
  const rightReach = distance2D(rightWrist, rightShoulder) / shoulderSpan;

  const wristsHigh =
    leftWrist.y < shoulderMid.y + 0.09 &&
    rightWrist.y < shoulderMid.y + 0.09;
  const wristsNearFace =
    distance2D(leftWrist, faceRef) < shoulderSpan * 0.72 &&
    distance2D(rightWrist, faceRef) < shoulderSpan * 0.72;
  const blockScore = clamp(
    Math.round(
      100 -
      (Math.abs(leftWrist.y - shoulderMid.y) * 220) -
      (Math.abs(rightWrist.y - shoulderMid.y) * 220) -
      (distance2D(leftWrist, faceRef) * 140) -
      (distance2D(rightWrist, faceRef) * 140)
    ),
    0,
    100,
  );

  const headShift = nose
    ? Math.abs(nose.x - shoulderMid.x) / shoulderSpan
    : 0;
  const headDrop = nose
    ? (nose.y - shoulderMid.y) / torsoHeight
    : 0;
  const dodgeScore = clamp(Math.round(
    100 - (Math.min(headShift, 1.2) * 58) - (Math.max(0, headDrop) * 40)
  ), 0, 100);

  const leftPunchScore = clamp(Math.round(
    (leftReach * 28) +
    (leftElbowAngle > 145 ? 24 : leftElbowAngle > 125 ? 14 : 4) +
    (leftWrist.y < hipMid.y ? 16 : 0) +
    (leftWrist.x < leftShoulder.x ? 18 : 0)
  ), 0, 100);
  const rightPunchScore = clamp(Math.round(
    (rightReach * 28) +
    (rightElbowAngle > 145 ? 24 : rightElbowAngle > 125 ? 14 : 4) +
    (rightWrist.y < hipMid.y ? 16 : 0) +
    (rightWrist.x > rightShoulder.x ? 18 : 0)
  ), 0, 100);

  const hookScore = clamp(Math.round(
    Math.max(
      (leftReach * 18) + (leftElbowAngle < 145 && leftElbowAngle > 68 ? 36 : 0) + (leftWrist.y < shoulderMid.y + 0.08 ? 24 : 0),
      (rightReach * 18) + (rightElbowAngle < 145 && rightElbowAngle > 68 ? 36 : 0) + (rightWrist.y < shoulderMid.y + 0.08 ? 24 : 0),
    )
  ), 0, 100);

  if (state.currentAiAttack && (guardAction || (blockScore >= POSE_TUNING.blockThreshold && wristsNearFace))) {
    return "block";
  }

  if (state.currentAiAttack && dodgeScore >= 64 && Math.abs(headShift) >= 0.09) {
    return "dodge";
  }

  if (hookScore >= 58) {
    return "hook";
  }

  if (leftPunchScore >= 56 && leftPunchScore >= rightPunchScore) {
    return "jab";
  }

  if (rightPunchScore >= 56) {
    return "cross";
  }

  if (guardAction || (blockScore >= 74 && wristsHigh)) {
    return "block";
  }

  if (dodgeScore >= 70) {
    return "dodge";
  }

  return "";
}

function capturePoseMotionSample(landmarks, now) {
  const previous = state.poseMotionSample;
  const leftWrist = getLandmarkPoint(landmarks, 15);
  const rightWrist = getLandmarkPoint(landmarks, 16);
  const leftElbow = getLandmarkPoint(landmarks, 13);
  const rightElbow = getLandmarkPoint(landmarks, 14);
  const leftShoulder = getLandmarkPoint(landmarks, 11);
  const rightShoulder = getLandmarkPoint(landmarks, 12);
  const nose = getLandmarkPoint(landmarks, 0);
  const wristSpeeds = measureWristSpeeds(landmarks, previous, now);
  state.poseMotionSample = {
    now,
    leftWrist,
    rightWrist,
    leftElbow,
    rightElbow,
    leftShoulder,
    rightShoulder,
    nose,
    leftWristSpeed: wristSpeeds.leftWristSpeed,
    rightWristSpeed: wristSpeeds.rightWristSpeed,
  };
}

function estimatePosePunchSpeed(landmarks, now, actionKey) {
  const previous = state.poseMotionSample;
  if (!previous || !previous.now) {
    return 0;
  }

  const dt = Math.max(0.04, (now - previous.now) / 1000);
  const leftWrist = getLandmarkPoint(landmarks, 15);
  const rightWrist = getLandmarkPoint(landmarks, 16);
  const leftElbow = getLandmarkPoint(landmarks, 13);
  const rightElbow = getLandmarkPoint(landmarks, 14);
  const nose = getLandmarkPoint(landmarks, 0);
  const leftDelta = distance2D(leftWrist, previous.leftWrist);
  const rightDelta = distance2D(rightWrist, previous.rightWrist);
  const leftElbowDelta = distance2D(leftElbow, previous.leftElbow);
  const rightElbowDelta = distance2D(rightElbow, previous.rightElbow);
  const headDelta = distance2D(nose, previous.nose);
  const shoulderSpan = Math.max(
    distance2D(getLandmarkPoint(landmarks, 11), getLandmarkPoint(landmarks, 12)),
    distance2D(previous.leftShoulder, previous.rightShoulder),
    0.001,
  );
  const chosenDelta = actionKey === "jab"
    ? (leftDelta * 0.72) + (leftElbowDelta * 0.38) + (headDelta * 0.06)
    : actionKey === "cross"
      ? (rightDelta * 0.72) + (rightElbowDelta * 0.38) + (headDelta * 0.06)
      : (Math.max(leftDelta, rightDelta) * 0.62) + (Math.max(leftElbowDelta, rightElbowDelta) * 0.44) + (headDelta * 0.05);
  const normalized = chosenDelta / shoulderSpan;
  return clamp(Math.round((normalized / dt) * 1.45), 0, 22);
}

function hasCommittedPunchMotion(landmarks, now, actionKey) {
  return passesPunchFilter({
    landmarks,
    previous: state.poseMotionSample,
    now,
    actionKey,
  });
}

function shouldDispatchPoseAction(actionKey, snapshot, now) {
  if (!actionKey) {
    return false;
  }

  if (now - state.poseLastActionAt < POSE_TUNING.actionCooldownMs) {
    return false;
  }

  if (actionKey === "block") {
    return Boolean(state.currentAiAttack);
  }

  if (actionKey === "dodge") {
    return Boolean(state.currentAiAttack);
  }

  const confidence = toNumber(snapshot?.actionConfidence, 0);
  return confidence >= POSE_TUNING.minConfidence;
}

function emitPoseAction(snapshot, landmarks, now) {
  if (!isGameRunning()) {
    return;
  }

  let detectedAction = normalizePoseAction(snapshot?.detectedAction || snapshot?.detectedActionLabel);
  if (isUserGuarding(landmarks) && (detectedAction === "jab" || detectedAction === "cross" || detectedAction === "hook")) {
    detectedAction = "";
  }
  const guardScore = toNumber(snapshot?.guardScore, 0);
  const guardAction = resolvePoseGuardAction(landmarks);
  const inferredAction = guardAction || detectedAction ? "" : inferPoseActionFromLandmarks(landmarks, snapshot, now);
  let actionKey = guardAction ? "block" : (detectedAction || inferredAction);
  const dispatchSnapshot = actionKey && !detectedAction
    ? { ...snapshot, actionConfidence: Math.max(0.72, toNumber(snapshot?.actionConfidence, 0)) }
    : snapshot;

  if (!actionKey && guardScore >= POSE_TUNING.blockThreshold && state.currentAiAttack) {
    actionKey = "block";
  }

  if (!shouldDispatchPoseAction(actionKey, dispatchSnapshot, now)) {
    if (guardAction) {
      setStance("guard");
      setActionActive("block", 180);
    }
    return;
  }

  if (actionKey === "block" && !guardAction && guardScore < POSE_TUNING.blockThreshold) {
    return;
  }

  if (actionKey === "jab" || actionKey === "cross" || actionKey === "hook") {
    if (isUserGuarding(landmarks)) {
      setStance("guard");
      setActionActive("block", 180);
      return;
    }
    if (!hasCommittedPunchMotion(landmarks, now, actionKey)) {
      return;
    }
    const estimatedSpeed = estimatePosePunchSpeed(landmarks, now, actionKey);
    state.lastPunchSpeed = Math.max(state.lastPunchSpeed, estimatedSpeed || 0);
  }
  state.poseLastActionKey = actionKey;
  state.poseLastActionAt = now;
  handleAction(actionKey, { source: "pose" });
}

function pumpPoseBridge(now) {
  if (state.gameState === "idle" || state.gameState === "game_over") {
    state.poseLoopFrame = window.requestAnimationFrame(pumpPoseBridge);
    return;
  }

  const tracker = getPoseTracker();
  const analyzer = getPoseAnalyzer();
  const webcam = ui.webcam;

  if (!tracker || !analyzer || !webcam || !state.webcamReady) {
    state.poseLoopFrame = window.requestAnimationFrame(pumpPoseBridge);
    return;
  }

  if (now - state.poseLastAnalyzeAt < POSE_TUNING.analysisIntervalMs) {
    state.poseLoopFrame = window.requestAnimationFrame(pumpPoseBridge);
    return;
  }

  state.poseLastAnalyzeAt = now;

  const landmarks = tracker.getLatestLandmarks?.() || null;
  if (!landmarks) {
    drawPoseOverlay(null);
    const trackerStatus = typeof tracker.getStatus === "function" ? tracker.getStatus() : "";
    updatePoseStatus(
      trackerStatus === "fallback" ? "POSE 분석 fallback" : "사람 위치 찾는 중",
      trackerStatus === "fallback" ? "fallback" : "running",
    );
    state.poseLoopFrame = window.requestAnimationFrame(pumpPoseBridge);
    return;
  }
  state.latestPoseLandmarks = landmarks;
  drawPoseOverlay(landmarks);
  updatePoseStatus(`POSE 감지 ${landmarks.length || 0}점`, "running");

  let snapshot = null;
  try {
    snapshot = analyzer({
      now,
      video: webcam,
      poseLandmarks: landmarks,
      lessonKey: "beginner-basic-guard",
      state: {
        mode: state.mode,
        score: state.score,
        hp: state.playerHp,
        combo: state.combo,
        currentRound: state.round,
        gameState: state.gameState,
        trainingState: state.gameState === "round_active" ? "active" : "paused",
        sparring: true,
        currentAiAttack: state.currentAiAttack?.type || "",
      },
      user: state.user,
    });
  } catch (error) {
    console.warn("sparring pose analysis failed:", error);
  }

  if (snapshot) {
    state.poseSnapshot = snapshot;
  }

  emitPoseAction(snapshot || {}, landmarks, now);
  capturePoseMotionSample(landmarks, now);

  const actionLabel = String(snapshot?.detectedActionLabel || snapshot?.detectedAction || "").trim();
  if (actionLabel && ui.coachTip && state.gameState === "round_active") {
    FX.setCoachTip(`${actionLabel.toUpperCase()} detected`);
  }

  state.poseLoopFrame = window.requestAnimationFrame(pumpPoseBridge);
}

async function startPoseBridge() {
  ensurePoseBridgeState();

  const tracker = getPoseTracker();
  const analyzer = getPoseAnalyzer();
  if (!tracker || !analyzer || !ui.webcam || !state.webcamReady) {
    updatePoseStatus("POSE 분석 없음", "fallback");
    FX.setCoachTip("카메라 분석을 사용할 수 없어도 J/K/L/D/B 키와 하단 버튼으로 플레이할 수 있습니다.");
    return false;
  }

  state.poseTracker = tracker;
  state.poseAnalyzer = analyzer;

  try {
    if (typeof analyzer.setLessonKey === "function") {
      analyzer.setLessonKey("beginner-basic-guard");
    }
    if (typeof analyzer.reset === "function") {
      analyzer.reset();
    }
    if (typeof analyzer.start === "function") {
      analyzer.start();
    }
  } catch (error) {
    console.warn("sparring pose analyzer start failed:", error);
  }

  try {
    const trackerReady = await tracker.start(ui.webcam, {
      onStatus(message, status) {
        const cleanMessage = {
          idle: "POSE 대기",
          loading: "자세 분석 모델 로딩 중",
          ready: "자세 분석 준비 완료",
          running: "자세 분석 중",
          fallback: "자세 분석 fallback",
          error: "자세 분석 오류",
        }[status] || message || "POSE 상태 확인 중";
        updatePoseStatus(cleanMessage, status || "idle");
        if (status === "fallback" && message) {
          FX.setCoachTip("자세 분석을 사용할 수 없어 키보드와 버튼 입력으로 진행합니다.");
        }
      },
      onResult(landmarks) {
        state.latestPoseLandmarks = Array.isArray(landmarks) ? landmarks : null;
        drawPoseOverlay(state.latestPoseLandmarks);
        if (state.latestPoseLandmarks) {
          updatePoseStatus(`POSE 감지 ${state.latestPoseLandmarks.length || 0}점`, "running");
        }
      },
    });
    if (!trackerReady) {
      updatePoseStatus("POSE 분석 fallback", "fallback");
      return false;
    }
  } catch (error) {
    console.warn("sparring pose tracker start failed:", error);
    updatePoseStatus("MediaPipe 시작 실패", "error");
    FX.setCoachTip("MediaPipe 분석을 시작하지 못했습니다. 키보드와 버튼 입력으로 스파링을 진행하세요.");
    return false;
  }

  if (state.poseLoopFrame) {
    window.cancelAnimationFrame(state.poseLoopFrame);
  }
  state.poseLoopFrame = window.requestAnimationFrame(pumpPoseBridge);
  return true;
}

function stopPoseBridge() {
  if (state.poseLoopFrame) {
    window.cancelAnimationFrame(state.poseLoopFrame);
    state.poseLoopFrame = 0;
  }

  state.poseSnapshot = null;
  state.poseMotionSample = null;
  state.poseLastAnalyzeAt = 0;
  state.poseLastActionAt = 0;
  state.poseLastActionKey = "";

  if (state.poseTracker && typeof state.poseTracker.stop === "function") {
    state.poseTracker.stop();
  }
  if (state.poseAnalyzer && typeof state.poseAnalyzer.stop === "function") {
    state.poseAnalyzer.stop();
  }
}

function scheduleAiAttack(delayOverride = null) {
  clearTimer("aiAttack");
  if (!isGameRunning()) {
    return;
  }
  if (state.timelineMarkers.length > 0) {
    return;
  }

  refillAiPatternQueue();

  const isComboChain = Boolean(state.currentAiAttack) && state.aiPatternQueue.length > 0;
  const baseDelay = delayOverride != null
    ? delayOverride
    : isComboChain
      ? state.config.comboGapMs
      : state.config.aiAttackIntervalMs;
  const jitter = Math.round(baseDelay * (isComboChain ? 0.16 : 0.3));
  const delay = Math.max(
    isComboChain ? 480 : 900,
    baseDelay + Math.round((Math.random() * 2 - 1) * jitter),
  );

  state.timers.aiAttack = window.setTimeout(() => {
    performAiAttack();
  }, delay);
}

function getAiAttackCue(mode, attackType) {
  const modeTable = AI_ATTACK_CUE_POINTS[mode] || AI_ATTACK_CUE_POINTS.beginner;
  return modeTable[attackType] || modeTable.jab;
}

function performAiAttack() {
  if (state.gameState !== "round_active") {
    return;
  }

  refillAiPatternQueue();

  const attackType = state.aiPatternQueue.shift() || "jab";
  const now = Date.now();
  const cue = getAiAttackCue(state.mode, attackType);
  const impactDelay = cue.impactDelayMs || state.config.attackWindowMs || 900;
  const impactAt = now + impactDelay;
  state.lastAiAttackAt = now;
  state.currentAiAttack = {
    type: attackType,
    startedAt: now,
    impactAt,
    expiresAt: impactAt + (cue.defenseWindowMs || 220),
    telegraphLeadMs: cue.telegraphLeadMs || 240,
  };
  setAiState("attacking");
  SparringSound.playWhoosh();
  FX.setCoachTip(`${attackType.toUpperCase()} incoming`);

  const baseDamage = state.config.aiDamage + Math.round(Math.random() * 2);
  const typeBonus = attackType === "hook" ? 3 : attackType === "cross" ? 1 : 0;
  const attackDamage = baseDamage + typeBonus;
  state.dodgeAttempts += 1;

  window.setTimeout(() => {
    if (state.gameState !== "round_active") {
      return;
    }

    const impactAt = Date.now();
    const activeAiAttack = state.currentAiAttack;
    const defenseWindowOpen =
      Boolean(state.activeDefense) &&
      impactAt <= state.activeDefenseUntil &&
      Boolean(activeAiAttack) &&
      impactAt <= activeAiAttack.expiresAt;
    const defenseReaction = defenseWindowOpen ? Math.max(0, state.activeDefenseAt - activeAiAttack.impactAt) : null;

    if (defenseWindowOpen && state.activeDefense === "dodge") {
      state.dodgeCount += 1;
      state.dodgeSuccessCount += 1;
      if (defenseReaction != null) {
        state.reactionTotalMs += defenseReaction;
        state.reactionSamples += 1;
      }
      if (defenseReaction != null && defenseReaction <= 250) {
        state.perfectCount += 1;
      }
      const dodgeScoreBonus = Math.max(
        35,
        Math.round(state.config.aiDamage * 4 - (defenseReaction != null ? defenseReaction / 14 : 0)),
      );
      state.score = Math.min(100, Math.round(state.score + (dodgeScoreBonus * state.config.scoreMultiplier) / 100));
      FX.showJudgment(ui.playerJudgment, "DODGE!", "dodge");
      FX.setCoachTip("좋습니다. 몸을 빠르게 빼냈습니다.");
    } else if (defenseWindowOpen && state.activeDefense === "block") {
      state.dodgeCount += 1;
      state.dodgeSuccessCount += 1;
      if (defenseReaction != null) {
        state.reactionTotalMs += defenseReaction;
        state.reactionSamples += 1;
      }
      const reducedDamage = Math.max(1, Math.round(attackDamage * 0.35));
      state.playerHp = clamp(state.playerHp - reducedDamage, 0, 100);
      const blockScoreBonus = Math.max(
        22,
        Math.round(state.config.aiDamage * 2.8 - (defenseReaction != null ? defenseReaction / 18 : 0)),
      );
      state.score = Math.min(100, Math.round(state.score + (blockScoreBonus * state.config.scoreMultiplier) / 100));
      FX.showJudgment(ui.playerJudgment, "GUARD!", "guard");
      FX.setCoachTip("가드가 좋습니다. 피해를 최소화했습니다.");
      SparringSound.playPunch();
      FX.playerHit(1);
    } else {
      state.playerHp = clamp(state.playerHp - attackDamage, 0, 100);
      FX.showJudgment(ui.playerJudgment, "DAMAGE!", "damage");
      SparringSound.playPunch();
      FX.playerHit(attackDamage >= state.config.aiDamage + 2 ? 2 : 1);
      FX.setCoachTip("맞았습니다. 가드를 먼저 올려보세요.");
    }

    state.activeDefense = null;
    state.activeDefenseUntil = 0;
    setStance("guard");
    setAiState("idle");
    setAiHpTier();
    syncDerivedStats();
    syncHud();

    if (state.playerHp <= 0) {
      finishMatch("player-ko");
      return;
    }

    state.currentAiAttack = null;
    scheduleAiAttack();
  }, impactDelay);
}

function performTimelineAttack(marker) {
  if (state.gameState !== "round_active") return;

  const attackType = String(marker.attack_type || "jab").toLowerCase();
  const now = Date.now();
  const defenseWindowMs = toNumber(marker.dodge_window_ms, state.config.defenseWindowMs || 650);
  state.lastAiAttackAt = now;
  state.currentAiAttack = {
    type: attackType,
    startedAt: now - Math.max(180, defenseWindowMs),
    impactAt: now,
    expiresAt: now + defenseWindowMs,
    telegraphLeadMs: Math.max(180, Math.round(defenseWindowMs * 0.45)),
    markerId: marker.id,
  };
  setAiState("attacking");
  SparringSound.playWhoosh();
  FX.setCoachTip(`${attackType.toUpperCase()} incoming`);

  const baseDamage = state.config.aiDamage + Math.round(Math.random() * 2);
  const typeBonus = attackType === "hook" ? 3 : attackType === "cross" ? 1 : 0;
  const attackDamage = baseDamage + typeBonus;
  state.dodgeAttempts += 1;

  const defenseWindowOpen =
    Boolean(state.activeDefense) &&
    now <= state.activeDefenseUntil;
  const defenseReaction = defenseWindowOpen ? Math.max(0, now - state.activeDefenseAt) : null;

  if (defenseWindowOpen && state.activeDefense === "dodge") {
    state.dodgeCount += 1;
    state.dodgeSuccessCount += 1;
    if (defenseReaction != null) {
      state.reactionTotalMs += defenseReaction;
      state.reactionSamples += 1;
    }
    if (defenseReaction != null && defenseReaction <= 250) {
      state.perfectCount += 1;
    }
    const dodgeScoreBonus = Math.max(35, Math.round(state.config.aiDamage * 4 - (defenseReaction || 0) / 14));
    state.score = Math.min(100, Math.round(state.score + (dodgeScoreBonus * state.config.scoreMultiplier) / 100));
    FX.showJudgment(ui.playerJudgment, "DODGE!", "dodge");
    FX.setCoachTip("마커 타이밍 회피 성공.");
  } else if (defenseWindowOpen && state.activeDefense === "block") {
    state.dodgeCount += 1;
    state.dodgeSuccessCount += 1;
    if (defenseReaction != null) {
      state.reactionTotalMs += defenseReaction;
      state.reactionSamples += 1;
    }
    const reducedDamage = Math.max(1, Math.round(attackDamage * 0.35));
    state.playerHp = clamp(state.playerHp - reducedDamage, 0, 100);
    const blockScoreBonus = Math.max(22, Math.round(state.config.aiDamage * 2.8 - (defenseReaction || 0) / 18));
    state.score = Math.min(100, Math.round(state.score + (blockScoreBonus * state.config.scoreMultiplier) / 100));
    FX.showJudgment(ui.playerJudgment, "GUARD!", "guard");
    SparringSound.playPunch();
    FX.playerHit(1);
  } else {
    state.playerHp = clamp(state.playerHp - attackDamage, 0, 100);
    FX.showJudgment(ui.playerJudgment, "DAMAGE!", "damage");
    SparringSound.playPunch();
    FX.playerHit(attackDamage >= state.config.aiDamage + 2 ? 2 : 1);
    FX.setCoachTip("타임스탬프 공격에 맞았습니다. 마커 앞 동작을 보고 반응하세요.");
  }

  state.activeDefense = null;
  state.activeDefenseUntil = 0;
  setStance("guard");
  setAiState("idle");
  setAiHpTier();
  syncDerivedStats();
  syncHud();

  if (state.playerHp <= 0) {
    finishMatch("player-ko");
    return;
  }

  state.currentAiAttack = null;
}

function bindTimelineVideoMarkers() {
  if (!ui.aiVideo) return;
  ui.aiVideo.addEventListener("seeked", () => {
    if (state.gameState !== "round_active") return;
    const currentTime = toNumber(ui.aiVideo.currentTime, 0);
    state.timelineMarkers.forEach((marker) => {
      if (marker.impact_time > currentTime) {
        state.firedTimelineMarkerIds.delete(marker.id);
        state.telegraphedTimelineMarkerIds.delete(marker.id);
      }
    });
    state.timelineLastTime = currentTime;
  });
}

async function setupWebcam() {
  const ready = await (async () => {
    if (!navigator.mediaDevices?.getUserMedia || !ui.webcam) {
      return false;
    }

    try {
      const cameraSettings = applyCameraVisualSettings();
      state.cameraStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: cameraSettings.mode } },
      });
      applyCameraVisualSettings();
      ui.webcam.srcObject = state.cameraStream;
      await ui.webcam.play().catch(() => {});
      state.webcamReady = true;
      updatePoseStatus("카메라 연결됨 · 자세 분석 준비", "running");
      if (ui.camOffline) {
        ui.camOffline.hidden = true;
      }
      return true;
    } catch (error) {
      console.warn("sparring webcam unavailable:", error);
      state.webcamReady = false;
      updatePoseStatus("카메라 권한 없음", "fallback");
      if (ui.camOffline) {
        ui.camOffline.hidden = false;
        const label = ui.camOffline.querySelector("span");
        if (label) {
          label.textContent = "카메라 없이 플레이 가능";
        }
      }
      FX.setCoachTip("카메라 권한이 없어도 J/K/L/D/B 키와 하단 버튼으로 스파링을 시작할 수 있습니다.");
      return false;
    }
  })();

  if (ready) {
    const poseReady = await startPoseBridge();
    if (!poseReady) {
      FX.setCoachTip("자세 분석 대신 키보드와 버튼 입력으로 플레이합니다.");
    }
  }

  return ready;
}

function cleanupResources() {
  clearAllTimers();
  stopPoseBridge();
  if (state.cameraStream) {
    state.cameraStream.getTracks().forEach((track) => track.stop());
    state.cameraStream = null;
  }
}

async function init() {
  cacheDom();
  SparringSound.init();
  initModeFromQuery();
  bindTimelineVideoMarkers();
  await loadActiveSparringVideo();
  syncAdminPanel();
  bindControls();
  bindActionButtons();
  bindDraftPersistence();

  const ok = await hydrateUser();
  if (!ok) {
    return;
  }

  setText(ui.gameoverResult, "");
  setText(ui.gameoverSub, "");
  setGameState("idle");
  openIntroModal();
  syncHud();
  updateRoundLabel();
  updateRoundTimer(state.roundDurationMs);
  FX.setCoachTip(state.config.coachTip);

  preloadAiVideo();
  void primeAiVideoBuffer();
}


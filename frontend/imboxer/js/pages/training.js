import { hydratePage } from "../core/ui.js";
import "../engine/PoseAnalyzer.js";
import "../engine/MediaPipePoseTracker.js?v=20260512-local-vendor-path";
import "../engine/ThresholdManager.js";

const STORAGE_KEYS = {
  lastResult: "im_boxer_training_last_result",
  draft: "im_boxer_training_draft",
};

const TRAINING_CONFIG = {
  rounds: 3,
  roundDurationMs: 3 * 60 * 1000,
  feedbackLimit: 6,
  draftSaveIntervalMs: 5000,
};

const TRAINING_LESSON_KEY = "im_boxer_current_lesson_key";
const TRAINING_GRADE_BADGE_BASE = "./assets/images/tutorials/grades/";
const BGM_BASE_PATH = "./assets/sounds/bgm/";
const CAMERA_SETTINGS_KEY = "im_boxer_camera_settings";
const BGM_TRACKS = {
  "basic-guard": ["guard1_music.mp3", "gurad_music.mp3", "main_bgm.mp3"],
  "beginner-basic-guard": ["guard1_music.mp3", "gurad_music.mp3", "main_bgm.mp3"],
  jab: ["jab_music.mp3", "jab1_music.mp3", "jab2_music.mp3"],
  cross: ["cross_music.mp3", "cross1_music.mp3", "cross2_music.mp3"],
  "left-hook": ["hook_music.mp3", "hook1_msuic.mp3"],
  slip: ["slip_music.mp3", "slip1_music.mp3"],
  uppercut: ["uppercut_music.mp3", "uppercut1_music.mp3", "uppercut2_music.mp3"],
  default: ["main_bgm.mp3"],
};

const LESSON_PROFILES = {
  "beginner-basic-guard": {
    title: "초보 기본 가드",
    goal: "손을 얼굴 가까이에 두고 안정적으로 서는 기본 가드를 먼저 익혀보세요.",
    startMessage: "초보 기본 가드 레슨입니다. 손 높이와 발 간격부터 편하게 맞춰보세요.",
    fallbackTip: "완벽한 모양보다 손 높이와 안정적인 베이스를 먼저 맞춰보세요.",
    guideTitle: "초보 기본 가드 따라하기",
    guideText: "양손을 얼굴 가까이에 올리고, 발 간격과 중심만 먼저 안정적으로 맞춰보세요.",
    guideSteps: [
      "양손을 얼굴 가까이에 둡니다.",
      "발은 어깨너비 정도로 둡니다.",
      "무릎을 살짝 굽히고 중심을 편하게 유지합니다.",
    ],
  },
  jab: {
    title: "잽",
    goal: "앞손을 빠르게 뻗고 바로 가드로 복귀하세요.",
    startMessage: "잽 레슨입니다. 앞손 속도와 복귀를 함께 맞춰보세요.",
    fallbackTip: "앞손을 빠르고 짧게 뻗은 뒤 바로 복귀하세요.",
    guideTitle: "잽 따라하기",
    guideText: "앞손을 짧고 빠르게 뻗고, 바로 가드로 돌아오세요.",
    guideSteps: [
      "앞손을 정면으로 짧게 뻗습니다.",
      "타격 후 바로 손을 회수합니다.",
      "머리와 몸통은 크게 흔들지 않습니다.",
    ],
  },
  cross: {
    title: "크로스",
    goal: "뒷손의 회전과 체중 이동을 안정적으로 맞춰보세요.",
    startMessage: "크로스 레슨입니다. 뒷발과 골반 회전을 함께 써보세요.",
    fallbackTip: "뒷발과 골반 회전을 같이 연결해보세요.",
    guideTitle: "크로스 따라하기",
    guideText: "뒷발로 바닥을 밀고 골반을 함께 돌려주세요.",
    guideSteps: [
      "뒷발로 바닥을 밀어 힘을 만듭니다.",
      "골반과 어깨를 함께 회전합니다.",
      "타격 후 중심을 바로 회복합니다.",
    ],
  },
  "left-hook": {
    title: "왼훅",
    goal: "팔꿈치 높이와 회전 반경을 작게 유지하세요.",
    startMessage: "왼훅 레슨입니다. 팔꿈치를 너무 크게 벌리지 마세요.",
    fallbackTip: "훅은 짧고 강하게, 팔꿈치는 크게 벌리지 마세요.",
    guideTitle: "왼훅 따라하기",
    guideText: "팔꿈치는 크게 벌리지 말고, 몸통 회전으로 짧게 연결하세요.",
    guideSteps: [
      "팔꿈치를 어깨선 가까이 둡니다.",
      "짧은 회전으로 훅을 만듭니다.",
      "훅 후에는 빠르게 가드로 복귀합니다.",
    ],
  },
  slip: {
    title: "슬립",
    goal: "머리를 크게 빼지 말고 짧게 피하면서 균형을 유지하세요.",
    startMessage: "슬립 레슨입니다. 고개를 짧게 빼고 균형을 유지하세요.",
    fallbackTip: "상체를 크게 흔들지 말고 짧게 피해주세요.",
    guideTitle: "슬립 따라하기",
    guideText: "머리만 짧게 피하고, 무릎을 살짝 굽혀 균형을 유지하세요.",
    guideSteps: [
      "상체를 크게 젖히지 않습니다.",
      "고개만 짧게 옆으로 빼봅니다.",
      "움직인 뒤 바로 중심을 회복합니다.",
    ],
  },
  uppercut: {
    title: "어퍼컷",
    goal: "무릎 반동과 짧은 상향 타격을 연결해보세요.",
    startMessage: "어퍼컷 레슨입니다. 무릎을 살짝 굽히고 짧게 위로 올려보세요.",
    fallbackTip: "팔을 크게 휘두르지 말고, 아래에서 위로 짧게 밀어 올리세요.",
    guideTitle: "어퍼컷 따라하기",
    guideText: "무릎 반동으로 시작해 팔꿈치를 접은 상태로 짧게 위로 올리세요.",
    guideSteps: [
      "무릎을 살짝 굽혀 하체 반동을 만듭니다.",
      "팔꿈치를 몸 가까이에 두고 주먹을 아래에서 위로 올립니다.",
      "타격 후에는 중심과 가드를 빠르게 회복합니다.",
    ],
  },
};

const LESSON_ASSET_MAP = {
  "basic-guard": {
    silhouette: "./assets/images/tutorials/silhouette/jpg/black/guard_black.jpg",
    video: "/assets/videos/training/tutorial-guard.mp4",
    guideImage: "./assets/images/tutorials/silhouette/jpg/neon/guard_neon.jpg",
  },
  "beginner-basic-guard": {
    silhouette: "./assets/images/tutorials/silhouette/jpg/black/guard_black.jpg",
    video: "/assets/videos/training/tutorial-guard.mp4",
    guideImage: "./assets/images/tutorials/silhouette/jpg/neon/guard_neon.jpg",
  },
  jab: {
    silhouette: "./assets/images/tutorials/silhouette/jpg/black/jab_black.jpg",
    video: "/assets/videos/training/tutorial-jab.mp4",
    guideImage: "./assets/images/tutorials/silhouette/jpg/neon/jab_neon.jpg",
  },
  cross: {
    silhouette: "./assets/images/tutorials/silhouette/jpg/black/cross_black.jpg",
    video: "/assets/videos/training/tutorial-cross.mp4",
    guideImage: "./assets/images/tutorials/silhouette/jpg/neon/cross_neon.jpg",
  },
  "left-hook": {
    silhouette: "./assets/images/tutorials/silhouette/jpg/black/hook_black.jpg",
    video: "/assets/videos/training/tutorial-hook.mp4",
    guideImage: "./assets/images/tutorials/silhouette/jpg/neon/hook_neon.jpg",
  },
  slip: {
    silhouette: "./assets/images/tutorials/silhouette/jpg/black/slip_black.jpg",
    video: "/assets/videos/training/tutorial-slip.mp4",
    guideImage: "./assets/images/tutorials/silhouette/jpg/neon/slip_neon.jpg",
  },
  uppercut: {
    silhouette: "./assets/images/tutorials/silhouette/jpg/black/uppercut_black.jpg",
    video: "/assets/videos/training/tutorial-uppercut.mp4",
    guideImage: "./assets/images/tutorials/silhouette/jpg/neon/uppercut_neon.jpg",
  },
  default: {
    silhouette: "./assets/images/tutorials/silhouette/jpg/black/guard_black.jpg",
    video: "/assets/videos/training/tutorial-guard.mp4",
    guideImage: "./assets/images/tutorials/silhouette/jpg/neon/guard_neon.jpg",
  },
};

const STATE_LABELS = {
  check: "점검",
  ready: "준비",
  active: "진행 중",
  paused: "일시정지",
  ended: "종료",
};

const STATE_MESSAGES = {
  check: "카메라 연결을 확인하고 있습니다.",
  ready: "카메라 연결 완료. 훈련 시작 버튼을 누르세요.",
  active: "자세를 유지하며 라운드를 진행하세요.",
  paused: "훈련이 일시정지되었습니다.",
  ended: "훈련이 종료되었습니다.",
};

const state = {
  user: null,
  root: null,
  ui: {},
  trainingState: "check",
  webcamReady: false,
  webcamStream: null,
  sessionId: null,
  sessionStartEpoch: 0,
  sessionStartPerf: 0,
  pausedTotalMs: 0,
  pauseStartedPerf: 0,
  currentRound: 1,
  score: 0,
  accuracy: 0,
  hp: 100,
  combo: 0,
  coachMessage: "",
  feedback: [],
  lastFeedbackBucket: -1,
  lastDraftSaveAt: 0,
  debugTick: 0,
  frameId: 0,
  tickTimerId: 0,
  lastMetricTickAt: 0,
  endedReason: "",
  poseAnalyzer: null,
  poseTracker: null,
  poseLandmarks: null,
  lastPoseSnapshot: null,
  lessonKey: "beginner-basic-guard",
  lessonTitle: "초보 기본 가드",
  lessonGoal: "손을 얼굴 가까이에 두고 안정적으로 서는 기본 가드를 먼저 익혀보세요.",
  roundDurationMs: TRAINING_CONFIG.roundDurationMs,
  bgmAudio: null,
  bgmEnabled: false,
  bgmTrack: "",
  obstaclePause: {
    active: false,
    previousTrainingState: "",
  },
};

function continueAsGuest() {
  state.user = null;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeDurationMs(value) {
  const allowedDurationsMs = new Set([60, 180, 300, 600].map((seconds) => seconds * 1000));
  const durationMs = Math.round(toNumber(value, TRAINING_CONFIG.roundDurationMs));
  return allowedDurationsMs.has(durationMs) ? durationMs : TRAINING_CONFIG.roundDurationMs;
}

function getSelectedDurationMsFromDom() {
  const selectedButton = document.querySelector('[data-duration-btn][aria-pressed="true"]');
  if (!selectedButton) {
    return TRAINING_CONFIG.roundDurationMs;
  }
  return normalizeDurationMs(Number(selectedButton.dataset.durationBtn) * 1000);
}

function syncDurationButtons(durationMs) {
  const seconds = Math.round(normalizeDurationMs(durationMs) / 1000);
  document.querySelectorAll("[data-duration-btn]").forEach((button) => {
    const buttonSeconds = toNumber(button.dataset.durationBtn, 0);
    button.setAttribute("aria-pressed", buttonSeconds === seconds ? "true" : "false");
  });
}

function setTrainingDuration(durationMs, { syncButtons = false } = {}) {
  const nextDurationMs = normalizeDurationMs(durationMs);
  state.roundDurationMs = nextDurationMs;

  if (state.ui.sessionDurationDisplay) {
    setText(state.ui.sessionDurationDisplay, formatTime(nextDurationMs));
  }

  if (state.ui.roundTimer && state.trainingState !== "active") {
    setText(state.ui.roundTimer, formatTime(nextDurationMs));
  }

  if (syncButtons) {
    syncDurationButtons(nextDurationMs);
  }
}

function formatTime(ms) {
  const safeMs = Math.max(0, Math.floor(ms));
  const totalSeconds = Math.ceil(safeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatPercent(value) {
  return `${Math.round(clamp(value, 0, 100))}%`;
}

function formatDisplayScore(value) {
  const score = clamp(toNumber(value, 0), 0, 1000);
  return Math.round(score > 100 ? score / 10 : score);
}

function getGradeFromScore(score) {
  const value = formatDisplayScore(score);
  if (value >= 90) return "s";
  if (value >= 80) return "a";
  if (value >= 70) return "b";
  if (value >= 60) return "c";
  return "d";
}

function formatDebugJson(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value ?? "");
  }
}

function resolveAssetUrl(path) {
  try {
    return new URL(path, document.baseURI).href;
  } catch {
    return String(path || "");
  }
}

function isSameAssetUrl(element, path) {
  if (!element || !path) {
    return false;
  }
  return element.src === resolveAssetUrl(path);
}

function summarizeThresholdsForDebug(thresholds) {
  if (!thresholds || typeof thresholds !== "object") {
    return "없음";
  }

  const entries = Object.entries(thresholds)
    .filter(([key]) => key !== "version" && key !== "updatedAt")
    .map(([key, value]) => `${key}: ${typeof value === "number" ? value : String(value)}`);

  return entries.length > 0 ? entries.join(" | ") : "없음";
}

function normalizeLessonKey(value) {
  const key = String(value || "").trim();
  if (key === "guard" || key === "basic-guard" || key === "real-fight-guard") {
    return "beginner-basic-guard";
  }
  if (key === "hook") {
    return "left-hook";
  }
  return LESSON_PROFILES[key] ? key : "beginner-basic-guard";
}

function getPersistedLessonKey(lessonKey) {
  const normalized = normalizeLessonKey(lessonKey);
  if (normalized === "beginner-basic-guard") {
    return "basic-guard";
  }
  return normalized;
}

function getLessonKeyFromContext() {
  const searchParams = new URLSearchParams(window.location.search);
  let sessionLessonKey = "";
  let localLessonKey = "";

  try {
    sessionLessonKey = window.sessionStorage.getItem(TRAINING_LESSON_KEY) || "";
  } catch {
    sessionLessonKey = "";
  }

  try {
    localLessonKey = window.localStorage.getItem(TRAINING_LESSON_KEY) || "";
  } catch {
    localLessonKey = "";
  }

  const candidate =
    searchParams.get("lesson_key") ||
    searchParams.get("lessonKey") ||
    sessionLessonKey ||
    localLessonKey ||
    document.documentElement?.dataset.lessonKey ||
    state.lessonKey;

  return normalizeLessonKey(candidate);
}

function isCalibrationMode() {
  const searchParams = new URLSearchParams(window.location.search);
  return searchParams.get("calibration") === "true" || window.DEBUG_CALIBRATION === true;
}

function getThresholdManager() {
  return window.IM_BOXER_THRESHOLD_MANAGER || null;
}

function maybeLogCalibrationSample(snapshot) {
  if (!isCalibrationMode()) {
    return;
  }

  if (!snapshot || snapshot.source !== "pose" || snapshot.isRealPose !== true) {
    return;
  }

  const manager = getThresholdManager();
  if (!manager || typeof manager.logAccuracySample !== "function") {
    return;
  }

  try {
    manager.logAccuracySample(state.lessonKey, {
      version: 1,
      lessonKey: state.lessonKey,
      timestamp: Date.now(),
      label: "unknown",
      source: snapshot.source,
      isRealPose: snapshot.isRealPose,
      accuracy: toNumber(snapshot.accuracy, state.accuracy),
      metrics: snapshot.metrics ? { ...snapshot.metrics } : {},
      features: snapshot.features ? { ...snapshot.features } : {},
    });
  } catch (error) {
    console.warn("calibration sample logging failed:", error);
  }
}

function getLessonProfile(key = state.lessonKey) {
  return LESSON_PROFILES[normalizeLessonKey(key)] || LESSON_PROFILES["beginner-basic-guard"];
}

function getBgmCandidates(lessonKey = state.lessonKey) {
  const normalized = normalizeLessonKey(lessonKey);
  return BGM_TRACKS[normalized] || BGM_TRACKS.default;
}

function chooseRandomBgmTrack(lessonKey = state.lessonKey) {
  const candidates = getBgmCandidates(lessonKey);
  const index = Math.floor(Math.random() * candidates.length);
  return `${BGM_BASE_PATH}${candidates[index]}`;
}

function ensureBgmTrack({ preserveExisting = true } = {}) {
  if (preserveExisting && state.bgmTrack) {
    return state.bgmTrack;
  }
  state.bgmTrack = chooseRandomBgmTrack(state.lessonKey);
  return state.bgmTrack;
}

function updateBgmButton() {
  if (!state.ui.bgmToggle) return;
  state.ui.bgmToggle.setAttribute("aria-pressed", state.bgmEnabled ? "true" : "false");
  state.ui.bgmToggle.textContent = state.bgmEnabled ? "BGM ON" : "BGM OFF";
}

function ensureBgmAudio() {
  ensureBgmTrack();
  if (!state.bgmAudio) {
    state.bgmAudio = new Audio(state.bgmTrack);
    state.bgmAudio.loop = true;
    state.bgmAudio.volume = 0.38;
    state.bgmAudio.preload = "auto";
    state.bgmAudio.addEventListener("error", () => {
      console.warn("training BGM failed to load", {
        src: state.bgmAudio?.currentSrc || state.bgmAudio?.src || state.bgmTrack,
        error: state.bgmAudio?.error,
      });
    });
  }
  const currentSrc = state.bgmAudio.getAttribute("src") || "";
  if (!currentSrc.endsWith(state.bgmTrack)) {
    state.bgmAudio.pause();
    state.bgmAudio.src = state.bgmTrack;
    state.bgmAudio.load();
  }
  return state.bgmAudio;
}

async function playBgm() {
  state.bgmEnabled = true;
  updateBgmButton();
  try {
    const audio = ensureBgmAudio();
    await audio.play();
  } catch (error) {
    console.warn("training BGM playback blocked or failed", {
      src: state.bgmAudio?.currentSrc || state.bgmAudio?.src || state.bgmTrack,
      error,
    });
    updateBgmButton();
  }
}

function primeBgmPlaybackFromUserGesture() {
  if (!state.bgmEnabled || state.bgmAudio?.paused === false) {
    return;
  }

  try {
    const audio = ensureBgmAudio();
    void audio.play().catch(() => {
      updateBgmButton();
    });
  } catch {
    updateBgmButton();
  }
}

function stopBgm({ reset = false } = {}) {
  state.bgmEnabled = false;
  if (state.bgmAudio) {
    state.bgmAudio.pause();
    if (reset) state.bgmAudio.currentTime = 0;
  }
  updateBgmButton();
}

function pauseBgm({ reset = false } = {}) {
  if (state.bgmAudio) {
    state.bgmAudio.pause();
    if (reset) state.bgmAudio.currentTime = 0;
  }
  updateBgmButton();
}

function toggleBgm() {
  if (state.bgmEnabled) {
    stopBgm();
    return;
  }
  void playBgm();
}

function firstElement(...selectors) {
  for (const selector of selectors) {
    if (!selector) {
      continue;
    }
    const element = document.querySelector(selector);
    if (element) {
      return element;
    }
  }
  return null;
}

function setText(element, value) {
  if (element) {
    element.textContent = value;
  }
}

function setHidden(element, hidden) {
  if (!element) {
    return;
  }
  element.hidden = hidden;
  element.style.display = hidden ? "none" : "";
}

function getTrainingElapsedMs(now = performance.now()) {
  if (!state.sessionStartPerf) {
    return 0;
  }

  const pauseElapsed =
    state.pausedTotalMs + (state.pauseStartedPerf ? now - state.pauseStartedPerf : 0);
  return Math.max(0, now - state.sessionStartPerf - pauseElapsed);
}

function getRoundInfo(now = performance.now()) {
  const elapsedMs = getTrainingElapsedMs(now);
  const roundDurationMs = state.roundDurationMs || TRAINING_CONFIG.roundDurationMs;
  const totalDurationMs = TRAINING_CONFIG.rounds * roundDurationMs;
  const completed = elapsedMs >= totalDurationMs;
  const activeRound = completed
    ? TRAINING_CONFIG.rounds
    : Math.floor(elapsedMs / roundDurationMs) + 1;
  const elapsedInRound = completed
    ? roundDurationMs
    : elapsedMs % roundDurationMs;
  const remainingMs = completed
    ? 0
    : roundDurationMs - elapsedInRound;
  const progress = completed
    ? 100
    : (elapsedInRound / roundDurationMs) * 100;

  return {
    elapsedMs,
    totalDurationMs,
    completed,
    activeRound,
    elapsedInRound,
    remainingMs,
    progress,
  };
}

function setTrainingState(nextState, message = "") {
  state.trainingState = nextState;

  if (state.root) {
    state.root.dataset.trainingState = nextState;
  }

  if (state.ui.stateLabel) {
    setText(state.ui.stateLabel, STATE_LABELS[nextState] || nextState);
  }

  const statusText = message || STATE_MESSAGES[nextState] || "";
  if (state.ui.statusLine) {
    setText(state.ui.statusLine, statusText);
  }
  if (state.ui.webcamStatus) {
    setText(state.ui.webcamStatus, statusText);
  }

  if (state.ui.startButton) {
    if (nextState === "active") {
      state.ui.startButton.textContent = "일시정지";
      state.ui.startButton.disabled = false;
    } else if (nextState === "paused") {
      state.ui.startButton.textContent = "재개";
      state.ui.startButton.disabled = false;
    } else if (nextState === "ended") {
      state.ui.startButton.textContent = "다시 시작";
      state.ui.startButton.disabled = false;
    } else {
      state.ui.startButton.textContent = "훈련 시작";
      state.ui.startButton.disabled = false;
    }
  }

  if (state.ui.restartButton) {
    state.ui.restartButton.disabled = nextState === "check";
  }

  if (state.ui.endButton) {
    state.ui.endButton.disabled = nextState === "ended";
  }
}

function updateRoundUi(now = performance.now()) {
  const info = getRoundInfo(now);

  if (state.ui.roundNumber) {
    setText(state.ui.roundNumber, String(info.activeRound));
  }

  if (state.ui.roundTimer) {
    setText(state.ui.roundTimer, formatTime(info.remainingMs));
  }

  if (state.ui.roundProgress) {
    state.ui.roundProgress.style.width = `${info.progress}%`;
  }

  return info;
}

function updateMetricsUi() {
  state.debugTick += 1;

  if (state.ui.scoreCurrent) {
    setText(state.ui.scoreCurrent, String(formatDisplayScore(state.score)));
  }

  if (state.ui.gradeBadge) {
    const grade = getGradeFromScore(state.score);
    const nextSrc = `${TRAINING_GRADE_BADGE_BASE}grade_${grade}.svg`;
    if (!state.ui.gradeBadge.src.endsWith(`/grade_${grade}.svg`)) {
      state.ui.gradeBadge.src = nextSrc;
    }
    state.ui.gradeBadge.alt = `${grade.toUpperCase()} 등급`;
  }

  if (state.ui.scoreAccuracy) {
    setText(state.ui.scoreAccuracy, formatPercent(state.accuracy));
  }

  if (state.ui.hpValue) {
    setText(state.ui.hpValue, formatPercent(state.hp));
  }

  if (state.ui.hpGauge) {
    state.ui.hpGauge.style.width = `${clamp(state.hp, 0, 100)}%`;
  }

  if (state.ui.comboValue) {
    setText(state.ui.comboValue, `${Math.max(0, Math.round(state.combo))}x`);
  }

  if (state.ui.comboGauge) {
    state.ui.comboGauge.style.width = `${clamp(state.combo * 11, 0, 100)}%`;
  }

  if (state.ui.coachMessage) {
    setText(state.ui.coachMessage, state.coachMessage || "훈련이 시작되면 코치 메시지가 여기에 표시됩니다.");
  }

  renderTrainingDebugPanel();
}

function renderTrainingDebugPanel() {
  if (state.ui.debugOrigin) {
    setText(state.ui.debugOrigin, window.location.origin || "unknown");
  }

  if (state.ui.debugLesson) {
    setText(state.ui.debugLesson, state.lessonKey || "beginner-basic-guard");
  }

  if (state.ui.debugThreshold) {
    const manager = getThresholdManager();
    const thresholds = manager && typeof manager.getThresholds === "function"
      ? manager.getThresholds(state.lessonKey)
      : null;
    setText(state.ui.debugThreshold, summarizeThresholdsForDebug(thresholds));
  }

  if (state.ui.debugSnapshot) {
    if (state.lastPoseSnapshot) {
      const rawScore = toNumber(state.lastPoseSnapshot.score, state.score);
      const postureScore = toNumber(state.lastPoseSnapshot.postureScore, 0);
      const guardScore = toNumber(state.lastPoseSnapshot.guardScore, 0);
      const balanceScore = toNumber(state.lastPoseSnapshot.balanceScore, 0);
      const reactionScore = toNumber(state.lastPoseSnapshot.reactionScore, 0);
      const detectedAction = String(state.lastPoseSnapshot.detectedActionLabel || state.lastPoseSnapshot.detectedAction || "unknown");
      const actionConfidence = Math.round(toNumber(state.lastPoseSnapshot.actionConfidence, 0) * 100);
      setText(
        state.ui.debugSnapshot,
        `tick ${state.debugTick} / state ${state.trainingState} / webcam ${state.webcamReady ? "ready" : "not-ready"} / raw ${Math.round(rawScore)} / display ${formatDisplayScore(rawScore)} / posture ${Math.round(postureScore)} / guard ${Math.round(guardScore)} / balance ${Math.round(balanceScore)} / reaction ${Math.round(reactionScore)} / action ${detectedAction} ${actionConfidence}%`,
      );
    } else {
      setText(state.ui.debugSnapshot, `tick ${state.debugTick} / state ${state.trainingState} / webcam ${state.webcamReady ? "ready" : "not-ready"} / 대기 중`);
    }
  }

  if (state.ui.debugJson) {
    const manager = getThresholdManager();
    const thresholds = manager && typeof manager.getThresholds === "function"
      ? manager.getThresholds(state.lessonKey)
      : {};
    setText(state.ui.debugJson, formatDebugJson({
      tick: state.debugTick,
      trainingState: state.trainingState,
      webcamReady: state.webcamReady,
      lastMetricTickAt: state.lastMetricTickAt,
      origin: window.location.origin || "unknown",
      lessonKey: state.lessonKey,
      threshold: thresholds,
      lastPoseSnapshot: state.lastPoseSnapshot,
    }));
  }
}

function renderTrainingGuide() {
  const profile = getLessonProfile();
  if (state.ui.guideTitle) {
    setText(state.ui.guideTitle, profile.guideTitle || `${profile.title} 따라하기`);
  }
  if (state.ui.guideText) {
    setText(state.ui.guideText, profile.guideText || profile.goal);
  }
  if (state.ui.guideList) {
    state.ui.guideList.innerHTML = "";
    const steps = Array.isArray(profile.guideSteps) && profile.guideSteps.length > 0
      ? profile.guideSteps
      : [
          profile.startMessage,
          profile.goal,
          profile.fallbackTip,
        ].filter(Boolean);

    steps.forEach((step) => {
      const li = document.createElement("li");
      li.textContent = step;
      state.ui.guideList.appendChild(li);
    });
  }
}

function tickTraining(now = performance.now()) {
  if (state.trainingState !== "active") {
    return;
  }

  if (state.lastMetricTickAt && now - state.lastMetricTickAt < 900) {
    return;
  }

  state.lastMetricTickAt = now;
  updateTrainingMetrics(now);
}

function renderFeedbackList() {
  if (!state.ui.feedbackList) {
    return;
  }

  state.ui.feedbackList.innerHTML = "";

  if (state.feedback.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.textContent = "훈련이 시작되면 실시간 피드백이 여기에 표시됩니다.";
    state.ui.feedbackList.appendChild(emptyItem);
    return;
  }

  state.feedback.slice(0, TRAINING_CONFIG.feedbackLimit).forEach((item) => {
    const li = document.createElement("li");
    if (item.tone) {
      li.dataset.tone = item.tone;
    }
    li.textContent = item.message;
    state.ui.feedbackList.appendChild(li);
  });
}

function pushFeedback(message, tone = "info") {
  if (!message) {
    return;
  }

  const lastMessage = state.feedback[0]?.message;
  if (lastMessage === message) {
    return;
  }

  state.feedback.unshift({
    message,
    tone,
    at: Date.now(),
  });

  state.feedback = state.feedback.slice(0, TRAINING_CONFIG.feedbackLimit);
  renderFeedbackList();
}

function saveDraftSession() {
  const payload = buildSessionPayload("draft");
  try {
    window.localStorage.setItem(STORAGE_KEYS.draft, JSON.stringify(payload));
    state.lastDraftSaveAt = performance.now();
  } catch {
    // ignore draft persistence failures
  }
}

function saveFinalSession(reason) {
  const payload = buildSessionPayload(reason);
  try {
    window.localStorage.setItem(STORAGE_KEYS.lastResult, JSON.stringify(payload));
    window.localStorage.removeItem(STORAGE_KEYS.draft);
    window.IM_BOXER_TRAINING_LAST_RESULT = payload;
  } catch {
    // ignore persistence failures
  }
  return payload;
}

async function persistFinalSessionToDatabase(payload) {
  if (!payload || !payload.lessonKey) {
    return null;
  }

  const token = window.localStorage.getItem("im_boxer_access_token");
  if (!token) {
    return null;
  }

  const altFrontendPorts = new Set(["5001", "5501"]);
  const defaultApiPort = altFrontendPorts.has(window.location.port) ? "8001" : "8000";
  const apiBase =
    window.IM_BOXER_API_BASE_URL ||
    window.localStorage?.getItem("IM_BOXER_API_BASE_URL") ||
    `http://127.0.0.1:${defaultApiPort}`;
  const response = await fetch(`${apiBase}/api/training-results`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    return null;
  }

  const saved = await response.json();
  try {
    window.localStorage.setItem(STORAGE_KEYS.lastResult, JSON.stringify(saved));
    window.IM_BOXER_TRAINING_LAST_RESULT = saved;
  } catch {
    // ignore persistence failures
  }
  return saved;
}

function buildSessionPayload(reason) {
  const now = performance.now();
  const info = getRoundInfo(now);
  const nowEpoch = Date.now();

  return {
    id: state.sessionId || `training-${nowEpoch}`,
    mode: "training",
    reason,
    userId: state.user?.id ?? null,
    username: state.user?.username ?? "",
    tier: state.user?.tier ?? "free",
    lessonKey: getPersistedLessonKey(state.lessonKey),
    lessonTitle: state.lessonTitle,
    lessonGoal: state.lessonGoal,
    startedAt: state.sessionStartEpoch ? new Date(state.sessionStartEpoch).toISOString() : null,
    endedAt: new Date(nowEpoch).toISOString(),
    elapsedMs: Math.round(info.elapsedMs),
    roundsTotal: TRAINING_CONFIG.rounds,
    roundsCompleted: Math.min(TRAINING_CONFIG.rounds, info.activeRound),
    round: info.activeRound,
    score: Math.round(state.score),
    accuracy: Math.round(state.accuracy),
    hp: Math.round(state.hp),
    combo: Math.round(state.combo),
    coachMessage: state.coachMessage,
    feedback: state.feedback.map((item) => ({ ...item })),
    state: state.trainingState,
    metrics: {
      score: Math.round(state.score),
      accuracy: Math.round(state.accuracy),
      hp: Math.round(state.hp),
      combo: Math.round(state.combo),
      postureScore: Math.round(clamp(toNumber(state.lastPoseSnapshot?.postureScore, state.accuracy), 0, 100)),
      guardScore: Math.round(clamp(toNumber(state.lastPoseSnapshot?.guardScore, state.accuracy), 0, 100)),
      balanceScore: Math.round(clamp(toNumber(state.lastPoseSnapshot?.balanceScore, state.accuracy), 0, 100)),
      reactionScore: Math.round(clamp(toNumber(state.lastPoseSnapshot?.reactionScore, state.combo * 10), 0, 100)),
      scoreDelta: Math.round(toNumber(state.lastPoseSnapshot?.scoreDelta, 0)),
      consistencyScore: Math.round(clamp(toNumber(state.lastPoseSnapshot?.consistencyScore, state.accuracy), 0, 100)),
      speedScore: Math.round(clamp(toNumber(state.lastPoseSnapshot?.speedScore, state.combo * 10), 0, 100)),
      powerScore: Math.round(clamp(toNumber(state.lastPoseSnapshot?.powerScore, state.hp), 0, 100)),
      recoveryScore: Math.round(clamp(toNumber(state.lastPoseSnapshot?.recoveryScore, state.accuracy), 0, 100)),
      tipLevel: String(state.lastPoseSnapshot?.tipLevel || (state.accuracy >= 90 ? "excellent" : state.accuracy >= 80 ? "good" : state.accuracy >= 60 ? "warning" : "critical")),
      trend: String(state.lastPoseSnapshot?.trend || (toNumber(state.lastPoseSnapshot?.scoreDelta, 0) > 0 ? "up" : "flat")),
      analysisLabel: String(state.lastPoseSnapshot?.analysisLabel || `${state.lessonTitle} 분석`),
    },
  };
}

function clearSessionTimers() {
  if (state.frameId) {
    cancelAnimationFrame(state.frameId);
    state.frameId = 0;
  }
  if (state.tickTimerId) {
    clearInterval(state.tickTimerId);
    state.tickTimerId = 0;
  }
}

function stopWebcam() {
  if (!state.webcamStream) {
    return;
  }

  state.webcamStream.getTracks().forEach((track) => track.stop());
  state.webcamStream = null;
  state.webcamReady = false;
  if (state.ui.webcamVideo) {
    state.ui.webcamVideo.srcObject = null;
  }
  stopPoseTracker();
}

function stopPoseTracker() {
  if (state.poseTracker?.stop) {
    state.poseTracker.stop();
  }
  state.poseLandmarks = null;
  const overlay = window.IM_BOXER_POSE_OVERLAY;
  if (overlay && state.ui?.overlayCanvas) {
    overlay.clear(state.ui.overlayCanvas);
  }
}

function setFallbackVisible(visible, message) {
  if (state.ui.webcamFallback) {
    setHidden(state.ui.webcamFallback, !visible);
    const text = state.ui.webcamFallback.querySelector("p");
    if (text && message) {
      text.textContent = message;
    }
  }
}

function updateWebcamLessonBadge() {
  if (!state.ui.webcamLesson) {
    return;
  }

  setText(state.ui.webcamLesson, state.lessonTitle || "훈련");
  updateLessonAssets();
}

function updateLessonAssets() {
  const assets = LESSON_ASSET_MAP[state.lessonKey] || LESSON_ASSET_MAP.default;
  if (state.ui.silhouette && !isSameAssetUrl(state.ui.silhouette, assets.silhouette)) {
    state.ui.silhouette.src = assets.silhouette;
  }
  if (state.ui.referenceVideo && !isSameAssetUrl(state.ui.referenceVideo, assets.video)) {
    state.ui.referenceVideo.src = assets.video;
    state.ui.referenceVideo.muted = true;
    state.ui.referenceVideo.loop = true;
    state.ui.referenceVideo.playsInline = true;
    state.ui.referenceVideo.load?.();
    state.ui.referenceVideo.play?.().catch(() => {});
  }
  if (state.ui.guideImage && !isSameAssetUrl(state.ui.guideImage, assets.guideImage)) {
    state.ui.guideImage.src = assets.guideImage;
    state.ui.guideImage.alt = `${state.lessonTitle || "훈련"} 기준 동작`;
  }
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
  if (state.ui.webcamVideo) {
    state.ui.webcamVideo.style.transform = transform;
    state.ui.webcamVideo.style.transformOrigin = "center";
  }
  if (state.ui.overlayCanvas) {
    state.ui.overlayCanvas.style.transform = transform;
    state.ui.overlayCanvas.style.transformOrigin = "center";
    state.ui.overlayCanvas.style.display = settings.overlay ? "" : "none";
  }
  return settings;
}

async function ensurePoseTracker() {
  if (!state.ui.webcamVideo) {
    return null;
  }

  state.poseTracker = window.IM_BOXER_POSE_TRACKER || state.poseTracker || null;
  if (!state.poseTracker?.start) {
    return null;
  }

  try {
    await state.poseTracker.start(state.ui.webcamVideo, {
      lessonKey: state.lessonKey,
      onStatus(message) {
        if (message && state.trainingState !== "active") {
          setTrainingState(state.trainingState, message);
        }
      },
      onResult(landmarks) {
        const overlay = window.IM_BOXER_POSE_OVERLAY;
        if (overlay && state.ui.overlayCanvas) {
          if (getCameraSettings().overlay) {
            overlay.draw(state.ui.overlayCanvas, landmarks, state.ui.webcamVideo);
          } else {
            overlay.hide?.(state.ui.overlayCanvas);
          }
        }
        if (landmarks && state.trainingState === "active" && state.ui.webcamStatus) {
          setText(state.ui.webcamStatus, "자세 감지 중");
        }
      },
      onError(error) {
        console.warn("pose tracker failed:", error);
      },
    });
    return state.poseTracker;
  } catch (error) {
    console.warn("pose tracker initialization failed:", error);
    return null;
  }
}

async function ensureWebcam() {
  if (state.webcamReady && state.webcamStream) {
    await ensurePoseTracker();
    return state.webcamStream;
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    setTrainingState("check", "이 브라우저는 카메라 접근을 지원하지 않습니다.");
    setFallbackVisible(true, "이 브라우저는 카메라 접근을 지원하지 않습니다.");
    pushFeedback("브라우저에서 카메라 접근을 지원하지 않습니다.", "danger");
    return null;
  }

  setTrainingState("check", "카메라 연결을 확인하고 있습니다.");
  setFallbackVisible(true, "카메라 연결을 확인하고 있습니다.");

  try {
    const cameraSettings = applyCameraVisualSettings();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: cameraSettings.mode },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    });

    state.webcamStream = stream;
    state.webcamReady = true;

    if (state.ui.webcamVideo) {
      applyCameraVisualSettings();
      state.ui.webcamVideo.srcObject = stream;
      state.ui.webcamVideo.playsInline = true;
      state.ui.webcamVideo.muted = true;
      try {
        await state.ui.webcamVideo.play();
      } catch {
        // browsers may require user interaction; stream is still attached
      }
    }

    setFallbackVisible(false);
    setTrainingState("ready", "카메라 연결 완료. 훈련 시작 버튼을 누르세요.");
    pushFeedback("카메라 연결이 완료되었습니다.", "success");
    await ensurePoseTracker();
    return stream;
  } catch (error) {
    state.webcamStream = null;
    state.webcamReady = false;
    setFallbackVisible(true, "카메라 권한을 허용하거나 장치 연결을 확인해주세요.");
    setTrainingState("check", "카메라 권한이 필요합니다.");
    pushFeedback("카메라 연결에 실패했습니다. 권한과 장치를 확인해주세요.", "danger");
    return null;
  }
}

function attachPoseAnalyzer() {
  if (typeof window.IM_BOXER_POSE_ANALYZER === "function") {
    state.poseAnalyzer = window.IM_BOXER_POSE_ANALYZER;
  }

  window.IM_BOXER_TRAINING = {
    start: startTraining,
    pause: togglePause,
    restart: restartTraining,
    end: () => endTraining("manual"),
    attachPoseAnalyzer(fn) {
      state.poseAnalyzer = typeof fn === "function" ? fn : null;
    },
    getState() {
      return {
        trainingState: state.trainingState,
        currentRound: state.currentRound,
        score: state.score,
        accuracy: state.accuracy,
        hp: state.hp,
        combo: state.combo,
        lessonKey: state.lessonKey,
        lessonTitle: state.lessonTitle,
        lessonGoal: state.lessonGoal,
      };
    },
  };
}

function applySnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") {
    return false;
  }

  if (snapshot.trainingState && STATE_LABELS[snapshot.trainingState]) {
    setTrainingState(snapshot.trainingState, snapshot.message || "");
  }

  if (snapshot.lessonKey) {
    state.lessonKey = normalizeLessonKey(snapshot.lessonKey);
  }
  if (snapshot.lessonTitle) {
    state.lessonTitle = String(snapshot.lessonTitle);
  }
  if (snapshot.lessonGoal) {
    state.lessonGoal = String(snapshot.lessonGoal);
  }
  if (snapshot.lessonKey || snapshot.lessonTitle) {
    updateWebcamLessonBadge();
  }

  if (snapshot.score !== undefined) {
    state.score = toNumber(snapshot.score, state.score);
  } else if (snapshot.scoreDelta !== undefined) {
    state.score += toNumber(snapshot.scoreDelta, 0);
  }

  if (snapshot.accuracy !== undefined) {
    state.accuracy = toNumber(snapshot.accuracy, state.accuracy);
  } else if (snapshot.accuracyDelta !== undefined) {
    state.accuracy += toNumber(snapshot.accuracyDelta, 0);
  }

  if (snapshot.hp !== undefined) {
    state.hp = toNumber(snapshot.hp, state.hp);
  } else if (snapshot.hpDelta !== undefined) {
    state.hp += toNumber(snapshot.hpDelta, 0);
  }

  if (snapshot.combo !== undefined) {
    state.combo = toNumber(snapshot.combo, state.combo);
  } else if (snapshot.comboDelta !== undefined) {
    state.combo += toNumber(snapshot.comboDelta, 0);
  }

  if (snapshot.coachMessage || snapshot.message) {
    state.coachMessage = String(snapshot.coachMessage || snapshot.message);
  }

  const feedbackMessages = Array.isArray(snapshot.feedback)
    ? snapshot.feedback
    : Array.isArray(snapshot.feedbackMessages)
      ? snapshot.feedbackMessages
      : Array.isArray(snapshot.issues)
        ? snapshot.issues
        : [];

  feedbackMessages.forEach((message) => {
    if (typeof message === "string") {
      pushFeedback(message, snapshot.feedbackTone || "info");
    } else if (message && typeof message === "object" && message.message) {
      pushFeedback(message.message, message.tone || snapshot.feedbackTone || "info");
    }
  });

  if (snapshot.poseReady === false) {
    setTrainingState("check", snapshot.message || "자세 감지를 확인하고 있습니다.");
  }

  state.lastPoseSnapshot = { ...snapshot };
  maybeLogCalibrationSample(snapshot);

  return true;
}

function fallbackMetrics(now, info) {
  const roundMomentum = Math.sin(now / 2400) * 3 + Math.cos(now / 1600) * 2;
  const targetAccuracy = clamp(Math.round(68 + info.progress * 0.18 + roundMomentum + (info.activeRound - 1) * 3), 45, 99);
  const targetHp = clamp(Math.round(100 - info.elapsedMs / 24000 - (info.activeRound - 1) * 4), 0, 100);
  const targetCombo = clamp(Math.floor(info.progress / 18) + (info.activeRound > 1 ? 1 : 0), 0, 9);
  const targetScore = clamp(Math.round(targetAccuracy * 8 + targetHp * 1.4 + targetCombo * 18), 0, 1000);
  const previousScore = toNumber(state.score, 0);
  const score = clamp(Math.round(previousScore * 0.7 + targetScore * 0.3), 0, 1000);
  const accuracy = clamp(Math.round(toNumber(state.accuracy, 0) * 0.75 + targetAccuracy * 0.25), 45, 99);
  const hp = clamp(Math.round(toNumber(state.hp, 0) * 0.8 + targetHp * 0.2), 0, 100);
  const combo = clamp(Math.round(toNumber(state.combo, 0) * 0.75 + targetCombo * 0.25), 0, 9);

  let coachMessage = "정자세를 유지하고 시선을 정면에 두세요.";
  const profile = getLessonProfile();
  if (info.progress < 18) {
    coachMessage = profile.startMessage;
  } else if (hp < 45) {
    coachMessage = profile.fallbackTip;
  } else if (combo >= 4) {
    coachMessage = `${profile.title} 리듬이 좋습니다. 자세를 유지해보세요.`;
  } else if (accuracy < 70) {
    coachMessage = profile.fallbackTip;
  } else if (info.progress > 80) {
    coachMessage = `${profile.title} 마무리 구간입니다. 자세를 끝까지 유지하세요.`;
  }

  return {
    score,
    scoreDelta: score - previousScore,
    accuracy,
    hp,
    combo,
    coachMessage,
  };
}

function maybeAddHeartbeatFeedback(now, info) {
  const bucket = Math.floor(info.elapsedMs / 12000);
  if (bucket === state.lastFeedbackBucket) {
    return;
  }
  state.lastFeedbackBucket = bucket;

  const profile = getLessonProfile();
  const tip =
    info.hp < 45
      ? profile.fallbackTip
      : info.combo >= 4
        ? `${profile.title} 유지가 안정적입니다.`
        : info.progress < 20
          ? profile.startMessage
          : profile.fallbackTip;

  pushFeedback(tip, "info");
}

function updateTrainingMetrics(now) {
  const info = updateRoundUi(now);
  if (info.completed) {
    endTraining("completed");
    return;
  }

  let snapshot = null;
  state.poseLandmarks = state.poseTracker?.getLatestLandmarks?.() || null;
  if (state.poseAnalyzer) {
    try {
      snapshot = state.poseAnalyzer({
        now,
        video: state.ui.webcamVideo,
        poseLandmarks: state.poseLandmarks,
        round: info.activeRound,
        totalRounds: TRAINING_CONFIG.rounds,
        lessonKey: state.lessonKey,
        state: {
          trainingState: state.trainingState,
          score: state.score,
          accuracy: state.accuracy,
          hp: state.hp,
          combo: state.combo,
          currentRound: state.currentRound,
          elapsedMs: info.elapsedMs,
        },
        user: state.user,
      });
    } catch (error) {
      console.error("pose analyzer failed:", error);
      setTrainingState("check", "자세 감지 모듈을 점검하고 있습니다.");
      pushFeedback("자세 감지 모듈 연결을 다시 확인해주세요.", "danger");
    }
  }

  if (!applySnapshot(snapshot)) {
    const metrics = fallbackMetrics(now, info);
    state.score = metrics.score;
    state.accuracy = metrics.accuracy;
    state.hp = metrics.hp;
    state.combo = metrics.combo;
    state.coachMessage = metrics.coachMessage;
    state.lastPoseSnapshot = {
      score: metrics.score,
      scoreDelta: metrics.scoreDelta,
      accuracy: metrics.accuracy,
      hp: metrics.hp,
      combo: metrics.combo,
      postureScore: metrics.accuracy,
      guardScore: metrics.accuracy,
      balanceScore: metrics.accuracy,
      reactionScore: Math.min(100, metrics.combo * 10),
      scoreDelta: 0,
      consistencyScore: metrics.accuracy,
      speedScore: Math.min(100, metrics.combo * 10),
      powerScore: metrics.hp,
      recoveryScore: metrics.accuracy,
      tipLevel: metrics.accuracy >= 90 ? "excellent" : metrics.accuracy >= 80 ? "good" : metrics.accuracy >= 60 ? "warning" : "critical",
      trend: "flat",
      analysisLabel: `${state.lessonTitle} 분석`,
    };
  }

  state.currentRound = info.activeRound;
  updateMetricsUi();
  maybeAddHeartbeatFeedback(now, { ...info, hp: state.hp, combo: state.combo });

  if (now - state.lastDraftSaveAt > TRAINING_CONFIG.draftSaveIntervalMs) {
    saveDraftSession();
  }
}

function loop(now) {
  if (state.trainingState !== "active") {
    state.frameId = 0;
    return;
  }

  tickTraining(now);

  if (state.trainingState === "active") {
    state.frameId = window.requestAnimationFrame(loop);
  }
}

function startLoop() {
  if (state.frameId) {
    return;
  }
  state.frameId = window.requestAnimationFrame(loop);
  if (!state.tickTimerId) {
    state.tickTimerId = window.setInterval(() => {
      tickTraining(performance.now());
    }, 1000);
  }
}

function stopLoop() {
  clearSessionTimers();
}

async function startTraining() {
  if (state.trainingState === "active") {
    return;
  }

  if (state.trainingState === "ended") {
    await restartTraining();
    return;
  }

  if (!state.webcamReady) {
    const webcam = await ensureWebcam();
    if (!webcam) {
      pauseBgm({ reset: true });
      updateBgmButton();
      return;
    }
  }

  if (!state.sessionStartPerf) {
    state.sessionId = `training-${Date.now()}`;
    state.sessionStartEpoch = Date.now();
    state.sessionStartPerf = performance.now();
    state.pausedTotalMs = 0;
    state.pauseStartedPerf = 0;
    state.currentRound = 1;
    state.score = 0;
    state.accuracy = 0;
    state.hp = 100;
    state.combo = 0;
    state.feedback = [];
    state.lastFeedbackBucket = -1;
    state.endedReason = "";
    state.lastMetricTickAt = 0;
    ensureBgmTrack();
    if (state.bgmAudio) {
      state.bgmAudio.currentTime = 0;
    }
    renderFeedbackList();
    state.coachMessage = getLessonProfile().startMessage;
  } else if (state.pauseStartedPerf) {
    state.pausedTotalMs += performance.now() - state.pauseStartedPerf;
    state.pauseStartedPerf = 0;
  }

  setTrainingState("active", "훈련이 시작되었습니다.");
  await ensurePoseTracker();
  state.ui.referenceVideo?.play?.().catch(() => {});
  if (state.bgmEnabled) {
    void playBgm();
  }
  window.IM_BOXER_POSE_ANALYZER?.start?.();
  pushFeedback(getLessonProfile().startMessage, "success");
  startLoop();
}

function togglePause() {
  if (state.trainingState === "ended" || state.trainingState === "check") {
    return;
  }

  if (state.trainingState === "paused") {
    if (state.pauseStartedPerf) {
      state.pausedTotalMs += performance.now() - state.pauseStartedPerf;
      state.pauseStartedPerf = 0;
    }
    setTrainingState("active", "훈련을 재개합니다.");
    pushFeedback("훈련을 재개했습니다.", "info");
    if (state.bgmEnabled) {
      void playBgm();
    }
    startLoop();
    return;
  }

  if (state.trainingState !== "active") {
    return;
  }

  state.pauseStartedPerf = performance.now();
  setTrainingState("paused", "훈련이 일시정지되었습니다.");
  pushFeedback("훈련이 일시정지되었습니다.", "info");
  pauseBgm();
  stopLoop();
  saveDraftSession();
}

function pauseTrainingForObstacle(message = "장애물을 치워주세요") {
  if (state.obstaclePause.active || state.trainingState !== "active") {
    return;
  }
  state.obstaclePause.active = true;
  state.obstaclePause.previousTrainingState = state.trainingState;
  state.pauseStartedPerf = performance.now();
  setTrainingState("paused", message);
  pushFeedback(message, "info");
  pauseBgm();
  state.ui.referenceVideo?.pause?.();
  stopLoop();
  saveDraftSession();
}

function resumeTrainingFromObstacle() {
  if (!state.obstaclePause.active) {
    return;
  }
  const shouldResume = state.obstaclePause.previousTrainingState === "active";
  state.obstaclePause.active = false;
  state.obstaclePause.previousTrainingState = "";

  if (!shouldResume || state.trainingState !== "paused") {
    return;
  }
  if (state.pauseStartedPerf) {
    state.pausedTotalMs += performance.now() - state.pauseStartedPerf;
    state.pauseStartedPerf = 0;
  }
  setTrainingState("active", "장애물이 제거되어 훈련을 재개합니다.");
  state.ui.referenceVideo?.play?.().catch(() => {});
  if (state.bgmEnabled) {
    void playBgm();
  }
  startLoop();
}

async function restartTraining() {
  stopLoop();
  stopPoseTracker();
  state.sessionStartPerf = 0;
  state.sessionStartEpoch = 0;
  state.pausedTotalMs = 0;
  state.pauseStartedPerf = 0;
  state.sessionId = `training-${Date.now()}`;
  state.currentRound = 1;
  state.score = 0;
  state.accuracy = 0;
  state.hp = 100;
  state.combo = 0;
  state.coachMessage = "새 세션을 시작합니다.";
  state.feedback = [];
  state.lastFeedbackBucket = -1;
  state.endedReason = "";
  state.lastMetricTickAt = 0;
  state.lastPoseSnapshot = null;
  ensureBgmTrack({ preserveExisting: false });
  pauseBgm({ reset: true });
  updateBgmButton();
  state.coachMessage = getLessonProfile().startMessage;
  renderFeedbackList();
  updateMetricsUi();
  updateRoundUi();
  setTrainingState("check", "새 훈련 세션을 준비합니다.");
  await ensureWebcam();
  if (state.webcamReady) {
    await startTraining();
  }
}

function endTraining(reason = "manual", options = {}) {
  if (state.trainingState === "ended" && reason !== "manual") {
    return;
  }

  stopLoop();
  stopPoseTracker();
  state.endedReason = reason;
  state.lastMetricTickAt = 0;
  stopBgm({ reset: true });

  if (state.pauseStartedPerf) {
    state.pausedTotalMs += performance.now() - state.pauseStartedPerf;
    state.pauseStartedPerf = 0;
  }

  setTrainingState("ended", reason === "completed" ? "훈련이 완료되었습니다." : "훈련이 종료되었습니다.");
  pushFeedback(
    reason === "completed" ? "훈련 세션이 완료되었습니다." : "훈련 세션을 저장하고 종료합니다.",
    "success",
  );

  const result = saveFinalSession(reason);
  updateMetricsUi();
  renderFeedbackList();

  if (options.navigate !== false) {
    const goResult = () => {
      window.location.href = "./training_result.html";
    };
    Promise.race([
      persistFinalSessionToDatabase(result).catch(() => null),
      new Promise((resolve) => window.setTimeout(resolve, 900)),
    ]).finally(() => {
      window.setTimeout(goResult, 120);
    });
  }

  return result;
}

function bindControls() {
  state.ui.startButton?.addEventListener("click", () => {
    if (state.trainingState === "active" || state.trainingState === "paused") {
      togglePause();
      return;
    }
    void startTraining();
  });

  state.ui.restartButton?.addEventListener("click", () => {
    void restartTraining();
  });

  state.ui.endButton?.addEventListener("click", () => {
    endTraining("manual");
  });

  state.ui.bgmToggle?.addEventListener("click", () => {
    toggleBgm();
  });

  state.ui.resultLink?.addEventListener("click", (event) => {
    event.preventDefault();
    endTraining("manual");
  });

  state.ui.backLink?.addEventListener("click", () => {
    saveDraftSession();
  });
}

function collectElements() {
  state.root =
    firstElement('[data-page="training"]', "[data-training-state]", "main") ||
    document.querySelector("main");

  state.ui = {
    video: firstElement("[data-webcam-video]"),
    webcamVideo: firstElement("[data-webcam-video]"),
    webcamFallback: firstElement("[data-webcam-fallback]"),
    webcamStatus: firstElement("[data-webcam-status]"),
    stateLabel: firstElement("[data-training-state-label]"),
    restartButton: firstElement("[data-training-restart-button]"),
    endButton: firstElement("[data-training-end-button]"),
    startButton: firstElement("[data-training-start-button]"),
    roundNumber: firstElement("[data-round-number]"),
    roundTimer: firstElement("[data-round-timer]"),
    roundProgress: firstElement("[data-round-progress]"),
    scoreCurrent: firstElement("[data-score-current]"),
    scoreAccuracy: firstElement("[data-score-accuracy]"),
    hpValue: firstElement("[data-hp-value]"),
    hpGauge: firstElement("[data-hp-gauge]"),
    comboValue: firstElement("[data-combo-value]"),
    comboGauge: firstElement("[data-combo-gauge]"),
    coachMessage: firstElement("[data-coach-message]"),
    feedbackList: firstElement("[data-feedback-list]"),
    statusLine: firstElement("[data-training-status]"),
    guideTitle: firstElement("[data-training-guide-title]"),
    guideText: firstElement("[data-training-guide-text]"),
    guideList: firstElement("[data-training-guide-list]"),
    guideImage: firstElement("[data-training-guide-image]"),
    debugOrigin: firstElement("[data-training-debug-origin]"),
    debugLesson: firstElement("[data-training-debug-lesson]"),
    debugThreshold: firstElement("[data-training-debug-threshold]"),
    debugSnapshot: firstElement("[data-training-debug-snapshot]"),
    debugJson: firstElement("[data-training-debug-json]"),
    resultLink: firstElement("[data-training-result-link]"),
    backLink: firstElement("[data-training-back-link]"),
    userName: firstElement("[data-user-name]"),
    userSummary: firstElement("[data-user-summary]"),
    userTierBadge: firstElement("[data-user-tier-badge]"),
    userTierText: firstElement("[data-user-tier-text]"),
    pageMessage: firstElement("[data-page-message]"),
    overlayCanvas: firstElement("[data-pose-overlay]"),
    sessionDurationDisplay: firstElement("[data-session-duration-display]"),
    durationButtons: Array.from(document.querySelectorAll("[data-duration-btn]")),
    bgmToggle: firstElement("[data-bgm-toggle]"),
    webcamLesson: firstElement("[data-training-webcam-lesson]"),
    silhouette: firstElement("[data-training-silhouette]"),
    referenceVideo: firstElement("[data-training-reference-video]"),
    gradeBadge: firstElement("[data-training-grade-badge]"),
  };
}

function normalizeCopy() {
  document.title = "IM_BOXER | 훈련";

  if (state.ui.startButton) {
    state.ui.startButton.textContent = "훈련 시작";
  }
  if (state.ui.restartButton) {
    state.ui.restartButton.textContent = "다시 시작";
  }
  if (state.ui.endButton) {
    state.ui.endButton.textContent = "종료";
  }
  updateBgmButton();
  if (state.ui.resultLink) {
    state.ui.resultLink.textContent = "훈련 결과 확인";
  }
  if (state.ui.backLink) {
    state.ui.backLink.textContent = "튜토리얼로";
  }
  if (state.ui.statusLine) {
    setText(state.ui.statusLine, "카메라 연결을 준비합니다.");
  }
  if (state.ui.webcamStatus) {
    setText(state.ui.webcamStatus, "카메라 연결 대기 중");
  }
  updateWebcamLessonBadge();
  if (state.ui.coachMessage) {
    setText(state.ui.coachMessage, "훈련이 시작되면 코치 메시지가 표시됩니다.");
  }
  if (state.ui.feedbackList) {
    renderFeedbackList();
  }
  renderTrainingDebugPanel();
  renderTrainingGuide();
  if (state.root) {
    state.root.dataset.trainingState = "check";
  }
}

function attachGlobalListeners() {
  window.addEventListener("beforeunload", () => {
    saveDraftSession();
    stopBgm({ reset: true });
    stopWebcam();
    stopLoop();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state.trainingState === "active") {
      state.bgmAudio?.pause();
      saveDraftSession();
    } else if (!document.hidden && state.trainingState === "active" && state.bgmEnabled) {
      void playBgm();
    }
  });

  document.addEventListener("im-boxer:training-duration-change", (event) => {
    const nextDurationMs = normalizeDurationMs(event?.detail?.durationMs);
    setTrainingDuration(nextDurationMs, { syncButtons: true });
  });

  window.addEventListener("boxer:obstacle-danger-change", (event) => {
    const detail = event.detail || {};
    if (detail.active) {
      pauseTrainingForObstacle(detail.message || "장애물을 치워주세요");
      return;
    }
    resumeTrainingFromObstacle();
  });
}

async function bootstrap() {
  state.lessonKey = getLessonKeyFromContext();
  state.lessonTitle = getLessonProfile().title;
  state.lessonGoal = getLessonProfile().goal;
  state.bgmTrack = chooseRandomBgmTrack(state.lessonKey);

  const user = await hydratePage({
    requiresAuth: false,
    overrides: {
      summary: "훈련 세션",
      message: "웹캠으로 자세를 확인하고 훈련을 진행합니다.",
      tierText: "훈련 결과는 세션 기록으로 저장됩니다.",
    },
    onUser(currentUser) {
      state.user = currentUser;
    },
  }).catch(() => null);
  state.user = user || state.user || null;

  collectElements();
  setTrainingDuration(getSelectedDurationMsFromDom(), { syncButtons: true });
  normalizeCopy();
  attachPoseAnalyzer();
  bindControls();
  attachGlobalListeners();
  try {
    window.sessionStorage.setItem(TRAINING_LESSON_KEY, state.lessonKey);
  } catch {
    // ignore session storage failures
  }
  window.IM_BOXER_POSE_ANALYZER?.setLessonKey?.(state.lessonKey);
  window.IM_BOXER_POSE_ANALYZER?.reset?.();
  state.coachMessage = `${state.lessonTitle}: ${state.lessonGoal}`;
  updateWebcamLessonBadge();
  renderTrainingDebugPanel();
  setTrainingState("check", "카메라 연결을 확인하고 있습니다.");
  await ensureWebcam();
  updateRoundUi();
  updateMetricsUi();
}

document.addEventListener("DOMContentLoaded", () => {
  bootstrap().catch((error) => {
    console.error("training bootstrap failed:", error);
    continueAsGuest();
  });
});

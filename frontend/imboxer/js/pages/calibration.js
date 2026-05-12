import "../engine/PoseAnalyzer.js";
import "../engine/ThresholdManager.js";
import "../engine/MediaPipePoseTracker.js?v=20260512-local-vendor-path";
import PoseOverlay from "../engine/PoseOverlay.js";
import { apiUrl } from "../core/api.js";

const globalScope = typeof window !== "undefined" ? window : globalThis;
const TRAINING_LESSON_KEY = "im_boxer_current_lesson_key";
const ANALYSIS_INTERVAL_MS = 120;
const SAMPLE_CAPTURE_COUNTDOWN_MS = 5000;
const SAMPLE_CAPTURE_LOSS_LIMIT = 4;
const DEFAULT_MODE = "webcam";
const VIDEO_PLACEHOLDERS = {
  webcam: "webcam",
  "correct-video": "correct-video",
  "incorrect-video": "incorrect-video",
};

const LESSON_LABELS = {
  "beginner-basic-guard": "beginner-basic-guard",
  jab: "jab",
  cross: "cross",
  "left-hook": "left-hook",
  slip: "slip",
  uppercut: "uppercut",
};

const THRESHOLD_META = {
  guardWristToFaceMax: {
    label: "손-얼굴 거리 최대값",
    description: "손이 얼굴 보호 위치에서 얼마나 멀어질 수 있는지 정합니다. 낮을수록 손을 더 높게 들어야 합니다.",
  },
  elbowAngleMin: {
    label: "팔꿈치 각도 최소값",
    description: "팔꿈치가 이 각도보다 너무 많이 접히면 실패합니다.",
  },
  elbowAngleMax: {
    label: "팔꿈치 각도 최대값",
    description: "팔꿈치가 이 각도보다 너무 펴지면 실패합니다.",
  },
  shoulderLevelDiffMax: {
    label: "어깨 높이 차이 최대값",
    description: "양쪽 어깨 높이 차이 허용치입니다. 낮을수록 더 수평을 요구합니다.",
  },
  kneeAngleMin: {
    label: "무릎 각도 최소값",
    description: "무릎이 이 각도보다 더 많이 접히면 실패합니다.",
  },
  kneeAngleMax: {
    label: "무릎 각도 최대값",
    description: "무릎이 이 각도보다 너무 펴지면 실패합니다.",
  },
  stanceWidthMinRatio: {
    label: "발 간격 최소 비율",
    description: "발 간격이 이 값보다 좁으면 실패합니다.",
  },
  stanceWidthMaxRatio: {
    label: "발 간격 최대 비율",
    description: "발 간격이 이 값보다 넓으면 실패합니다.",
  },
  balanceOffsetMax: {
    label: "중심 치우침 최대값",
    description: "몸 중심이 좌우로 얼마나 흔들릴 수 있는지 정합니다. 낮을수록 더 안정적인 중심을 요구합니다.",
  },
  elbowExtensionMin: {
    label: "팔 뻗기 최소값",
    description: "주먹을 뻗을 때 팔이 이 정도 이상은 펴져야 통과합니다.",
  },
  wristSpeedMin: {
    label: "손 속도 최소값",
    description: "주먹이 앞으로 나가는 최소 속도입니다. 높을수록 더 빠른 동작을 요구합니다.",
  },
  wristTravelMinRatio: {
    label: "손 이동량 최소값",
    description: "손이 얼마나 분명하게 앞으로 이동했는지 보는 값입니다.",
  },
  shoulderForwardMin: {
    label: "어깨 전진 최소값",
    description: "주먹과 함께 어깨가 어느 정도 따라 나와야 하는지 정합니다.",
  },
  oppositeGuardMaxDistance: {
    label: "반대손 가드 거리 최대값",
    description: "잽을 칠 때 타격하지 않는 손이 얼굴 보호 위치에서 얼마나 멀어질 수 있는지 정합니다.",
  },
  returnTimeMax: {
    label: "복귀 시간 최대값",
    description: "동작 후 가드로 돌아오는 최대 허용 시간입니다. 낮을수록 더 빠른 복귀를 요구합니다.",
  },
  shoulderRotationMin: {
    label: "어깨 회전 최소값",
    description: "타격할 때 어깨 회전이 이 정도 이상은 나와야 통과합니다.",
  },
  hipRotationMin: {
    label: "골반 회전 최소값",
    description: "골반 회전이 이 정도 이상은 나와야 힘 연결이 있다고 봅니다.",
  },
  wristHeightDiffMax: {
    label: "양손 높이 차이 최대값",
    description: "두 손 높이 차이 허용치입니다. 낮을수록 더 같은 높이를 요구합니다.",
  },
  horizontalMoveMinRatio: {
    label: "수평 이동 최소값",
    description: "손이 옆으로 회전하며 이동하는 정도를 보는 값입니다.",
  },
  elbowHeightMinRatio: {
    label: "팔꿈치 높이 최소값",
    description: "팔꿈치가 어깨선 쪽으로 어느 정도 올라와야 하는지 정합니다.",
  },
  torsoRotationMin: {
    label: "상체 회전 최소값",
    description: "몸통 회전이 이 값보다 작으면 회전이 부족한 것으로 봅니다.",
  },
  headMoveMinRatio: {
    label: "머리 이동 최소값",
    description: "슬립 동작에서 머리가 최소한 얼마나 이동해야 하는지 정합니다.",
  },
  heightChangeMax: {
    label: "높이 변화 최대값",
    description: "동작 중 몸이 위아래로 얼마나 출렁일 수 있는지 정합니다.",
  },
  verticalMoveMinRatio: {
    label: "수직 이동 최소값",
    description: "어퍼컷에서 손이 위로 얼마나 올라가야 하는지 정합니다.",
  },
  kneeBendMin: {
    label: "무릎 굽힘 최소값",
    description: "무릎을 최소한 이 정도는 써야 동작이 살아 있다고 봅니다.",
  },
  kneeBendMax: {
    label: "무릎 굽힘 최대값",
    description: "무릎을 너무 많이 굽히는 것을 막는 상한선입니다.",
  },
  torsoRiseMin: {
    label: "상체 상승 최소값",
    description: "상체가 아래에서 위로 얼마나 따라 올라와야 하는지 정합니다.",
  },
};

const CHECK_TO_THRESHOLD_KEYS = {
  leftHandUp: ["guardWristToFaceMax"],
  rightHandUp: ["guardWristToFaceMax"],
  bothHandsUp: ["guardWristToFaceMax"],
  guardWristToFaceMax: ["guardWristToFaceMax"],
  shoulderLevelDiffMax: ["shoulderLevelDiffMax"],
  kneeAngleRange: ["kneeAngleMin", "kneeAngleMax"],
  kneeAngle: ["kneeAngleMin", "kneeAngleMax"],
  stanceWidth: ["stanceWidthMinRatio", "stanceWidthMaxRatio"],
  stanceWidthRatio: ["stanceWidthMinRatio", "stanceWidthMaxRatio"],
  baseStable: ["kneeAngleMin", "kneeAngleMax", "balanceOffsetMax"],
  balanceOffset: ["balanceOffsetMax"],
  balanceOffsetMax: ["balanceOffsetMax"],
  elbowExtension: ["elbowExtensionMin"],
  shoulderForward: ["shoulderForwardMin"],
  oppositeGuardDistance: ["oppositeGuardMaxDistance"],
  oppositeGuardMaxDistance: ["oppositeGuardMaxDistance"],
  returnTime: ["returnTimeMax"],
  shoulderRotation: ["shoulderRotationMin"],
  hipRotation: ["hipRotationMin"],
  elbowAngle: ["elbowAngleMin", "elbowAngleMax"],
  wristHeightDiff: ["wristHeightDiffMax"],
  elbowHeightRatio: ["elbowHeightMinRatio"],
  horizontalMoveRatio: ["horizontalMoveMinRatio"],
  wristSpeed: ["wristSpeedMin"],
  wristTravelRatio: ["wristTravelMinRatio"],
  torsoRotation: ["torsoRotationMin"],
  rearGuardGap: ["rearGuardGapMax"],
  headMoveRatio: ["headMoveMinRatio"],
  heightChange: ["heightChangeMax"],
  verticalMoveRatio: ["verticalMoveMinRatio"],
  kneeBend: ["kneeBendMin", "kneeBendMax"],
  torsoRise: ["torsoRiseMin"],
};

const FAILURE_FEEDBACK_HOLD_MS = 8000;
const FAILURE_FEEDBACK_LOCK_MS = 20000;
const FAILURE_FEEDBACK_REFRESH_MS = 3000;

const state = {
  lessonKey: "beginner-basic-guard",
  mode: DEFAULT_MODE,
  currentResult: null,
  latestLandmarks: null,
  running: false,
  analysisLoopId: 0,
  lastAnalysisAt: 0,
  webcamStream: null,
  videoUrl: "",
  uploadFileName: "",
  uploadSourceFile: null,
  uploadObjectUrl: "",
  uploadCanvas: null,
  uploadCanvasCtx: null,
  uploadCanvasStream: null,
  uploadImageLoopId: 0,
  uploadImage: null,
  ui: {},
  recommendation: null,
  thresholdDraft: {},
  selectedLogId: "",
  logFilter: "all",
  logSortOrder: "newest",
  logDetailOpen: false,
  compareMode: false,
  thresholdSummaryHistory: [],
  lastFailureFeedback: {
    checks: [],
    signature: "",
    updatedAt: 0,
    lockedUntil: 0,
    manualLock: false,
  },
  latestPreviewImage: "",
  clip: {
    startSec: 0,
    endSec: 0,
    jpegStartSec: 0,
    jpegEndSec: 0,
    createdUrl: "",
    createdName: "",
  },
  youtube: {
    createdUrl: "",
    createdName: "",
  },
  assetProgress: {
    timerId: 0,
    value: 0,
  },
  sampleCapture: {
    label: null,
    armed: false,
    active: false,
    endAt: 0,
    timeoutId: 0,
    missedFrames: 0,
  },
};

const THRESHOLD_HISTORY_LIMIT = 5;

const DEFAULT_POSE_GUIDES = {
  "beginner-basic-guard": {
    title: "기본 가드",
    summary: "양손이 모두 얼굴 가까이에 있고, 어깨가 수평에 가까우며, 발은 어깨너비보다 약간 넓은 안정 자세입니다.",
    points: [
      "양손 모두 광대/턱 라인 근처에 둡니다.",
      "한 손만 올라가 있으면 통과가 아니라 실패입니다.",
      "무릎은 살짝 굽히고 중심이 좌우로 크게 치우치지 않아야 합니다.",
    ],
    keys: ["guardWristToFaceMax", "shoulderLevelDiffMax", "kneeAngleMin", "kneeAngleMax", "stanceWidthMinRatio", "stanceWidthMaxRatio", "balanceOffsetMax"],
  },
  jab: {
    title: "잽",
    summary: "앞손을 빠르게 뻗되 반대손은 얼굴 가까이에 남기고, 뻗은 손은 곧게 펴졌다가 빠르게 복귀하는 동작입니다.",
    points: [
      "타격 손 팔꿈치는 충분히 펴져야 합니다.",
      "반대손은 얼굴 보호 위치에서 떨어지면 안 됩니다.",
      "손 이동량과 속도가 있어야 하며, 어깨가 자연스럽게 조금 따라 나갑니다.",
    ],
    keys: ["elbowExtensionMin", "wristSpeedMin", "wristTravelMinRatio", "shoulderForwardMin", "oppositeGuardMaxDistance", "returnTimeMax"],
  },
  cross: {
    title: "크로스",
    summary: "뒷손을 곧게 뻗으면서 어깨와 골반이 함께 회전하고, 중심이 한쪽으로 무너지지 않는 동작입니다.",
    points: [
      "팔꿈치가 충분히 펴진 뒷손 타격이어야 합니다.",
      "어깨와 골반 회전이 함께 나와야 힘 연결로 봅니다.",
      "타격 중 몸 중심이 크게 치우치지 않아야 합니다.",
    ],
    keys: ["elbowExtensionMin", "wristSpeedMin", "shoulderRotationMin", "hipRotationMin", "balanceOffsetMax"],
  },
  "left-hook": {
    title: "왼훅",
    summary: "팔꿈치를 적당히 접은 상태로 옆 회전을 만들고, 반대손 가드를 유지하며 손 높이가 크게 무너지지 않는 동작입니다.",
    points: [
      "팔꿈치는 너무 접히거나 완전히 펴지지 않아야 합니다.",
      "손이 옆으로 회전하는 수평 이동이 있어야 합니다.",
      "반대손은 얼굴 쪽 가드에 남아 있어야 합니다.",
    ],
    keys: ["elbowAngleMin", "elbowAngleMax", "wristHeightDiffMax", "horizontalMoveMinRatio", "rearGuardGapMax"],
  },
  slip: {
    title: "슬립",
    summary: "머리를 짧게 옆으로 빼되 위아래로 크게 출렁이지 않고, 무릎과 중심이 안정적인 회피 동작입니다.",
    points: [
      "머리 이동이 충분히 있어야 슬립으로 봅니다.",
      "상하 출렁임은 작아야 합니다.",
      "무릎은 살짝 힘이 풀린 범위에서 중심을 유지합니다.",
    ],
    keys: ["headMoveMinRatio", "heightChangeMax", "kneeAngleMin", "kneeAngleMax", "balanceOffsetMax"],
  },
  uppercut: {
    title: "어퍼컷",
    summary: "무릎 반동을 쓰고 주먹이 아래에서 위로 올라가며, 팔꿈치는 너무 펴지지 않은 짧은 상향 타격입니다.",
    points: [
      "주먹의 수직 이동이 분명해야 합니다.",
      "팔꿈치는 짧고 컴팩트한 각도 범위에 있어야 합니다.",
      "무릎 반동과 상체 상승이 함께 연결되어야 합니다.",
    ],
    keys: ["verticalMoveMinRatio", "wristSpeedMin", "elbowAngleMin", "elbowAngleMax", "kneeBendMin", "kneeBendMax", "torsoRiseMin"],
  },
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeUiLabel(value) {
  const label = String(value || "").toLowerCase().trim();
  if (!label) {
    return "unknown";
  }
  if (label.startsWith("incorrect")) {
    return "incorrect";
  }
  if (label.startsWith("correct")) {
    return "correct";
  }
  return "unknown";
}

function getAnalyzer() {
  return globalScope.IM_BOXER_POSE_ANALYZER || null;
}

function getTracker() {
  return globalScope.IM_BOXER_POSE_TRACKER || null;
}

function getOverlay() {
  return globalScope.IM_BOXER_POSE_OVERLAY || PoseOverlay;
}

function getThresholdAPI() {
  return globalScope.IM_BOXER_THRESHOLD_MANAGER || null;
}

function query(selector) {
  return document.querySelector(selector);
}

function queryAll(selector) {
  return Array.from(document.querySelectorAll(selector));
}

function setText(selector, value) {
  const element = query(selector);
  if (element) {
    element.textContent = value;
  }
}

function setHidden(element, hidden) {
  if (element) {
    element.hidden = hidden;
  }
}

function formatMetric(value, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--";
  }
  if (typeof value === "number") {
    return digits > 0 ? value.toFixed(digits) : `${Math.round(value)}`;
  }
  return String(value);
}

function updateModeChips(mode) {
  queryAll("[data-cal-mode-btn]").forEach((button) => {
    button.dataset.active = button.dataset.calModeBtn === mode ? "true" : "false";
  });

  queryAll("[data-mode-chip]").forEach((chip) => {
    chip.dataset.active = chip.dataset.modeChip === mode ? "true" : "false";
  });
}

function updateStatus(text) {
  setText("[data-cal-mode-status]", text);
}

function updateSourceStatus(text) {
  setText("[data-cal-source-status]", text);
}

function updateLessonBadge(lessonKey) {
  setText("[data-calibration-lesson-badge]", LESSON_LABELS[lessonKey] || lessonKey);
}

function updateSampleBadge(count) {
  setText("[data-calibration-sample-badge]", `${count}`);
}

function getCurrentLogsSorted() {
  return getCurrentLogs()
    .slice()
    .sort((left, right) => {
      const delta = toNumber(right.timestamp, 0) - toNumber(left.timestamp, 0);
      return state.logSortOrder === "oldest" ? -delta : delta;
    });
}

function summarizeLogsForUi(logs) {
  const summary = {
    total: 0,
    correctCount: 0,
    incorrectCount: 0,
    unknownCount: 0,
  };

  (logs || []).forEach((sample) => {
    const label = normalizeUiLabel(sample?.label);
    summary.total += 1;
    if (label === "correct") {
      summary.correctCount += 1;
      return;
    }
    if (label === "incorrect") {
      summary.incorrectCount += 1;
      return;
    }
    summary.unknownCount += 1;
  });

  return summary;
}

function getVisibleLogs() {
  const logs = getCurrentLogsSorted();
  if (state.logFilter === "correct") {
    return logs.filter((sample) => normalizeUiLabel(sample?.label) === "correct");
  }
  if (state.logFilter === "incorrect") {
    return logs.filter((sample) => normalizeUiLabel(sample?.label) === "incorrect");
  }
  return logs;
}

function updateLogFilterButtons() {
  queryAll("[data-cal-filter]").forEach((button) => {
    button.dataset.active = button.dataset.calFilter === state.logFilter ? "true" : "false";
  });
}

function updateDetailToggleButton() {
  const button = query('[data-cal-action="toggle-log-detail"]');
  if (button) {
    button.dataset.active = state.logDetailOpen ? "true" : "false";
    button.textContent = state.logDetailOpen ? "상세 접기" : "상세 보기";
  }
}

function updateCompareToggleButton() {
  const button = query('[data-cal-action="toggle-compare-view"]');
  if (button) {
    button.dataset.active = state.compareMode ? "true" : "false";
    button.textContent = state.compareMode ? "목록 보기" : "비교 보기";
  }
}

function updateSortToggleButton() {
  const button = query('[data-cal-action="toggle-log-sort"]');
  if (button) {
    button.dataset.active = state.logSortOrder === "oldest" ? "true" : "false";
    button.textContent = state.logSortOrder === "oldest" ? "오래된순" : "최신순";
  }
}

function formatLogTimestamp(timestamp) {
  const value = toNumber(timestamp, 0);
  if (!value) {
    return "unknown time";
  }

  try {
    return new Intl.DateTimeFormat("ko-KR", {
      dateStyle: "medium",
      timeStyle: "medium",
    }).format(new Date(value));
  } catch {
    return new Date(value).toLocaleString();
  }
}

function getSampleSummary(sample) {
  if (!sample) {
    return "샘플 정보가 없습니다.";
  }

  const parts = [
    `label: ${sample.label || "unknown"}`,
    `accuracy: ${formatMetric(sample.accuracy)}`,
    `source: ${sample.source || "unknown"}`,
    `realPose: ${sample.isRealPose ? "yes" : "no"}`,
  ];

  return parts.join(" / ");
}

function captureCurrentFramePreview() {
  const video = state.ui.video;
  if (!video || !video.videoWidth || !video.videoHeight) {
    return "";
  }

  const width = 180;
  const height = Math.max(1, Math.round((video.videoHeight / video.videoWidth) * width));
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return "";
  }

  canvas.width = width;
  canvas.height = height;

  try {
    ctx.drawImage(video, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", 0.62);
  } catch {
    return "";
  }
}

function createSampleId() {
  if (typeof globalScope.crypto?.randomUUID === "function") {
    try {
      return globalScope.crypto.randomUUID();
    } catch {
      // ignore and fall back
    }
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function getFallbackPreviewImage() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#111a2b"/>
          <stop offset="100%" stop-color="#0b101a"/>
        </linearGradient>
      </defs>
      <rect width="320" height="240" rx="24" fill="url(#g)"/>
      <rect x="24" y="24" width="272" height="192" rx="18" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="2" stroke-dasharray="8 10"/>
      <text x="160" y="112" fill="#7f93ad" font-family="Arial, sans-serif" font-size="20" font-weight="700" text-anchor="middle">NO PREVIEW</text>
      <text x="160" y="140" fill="#5f738d" font-family="Arial, sans-serif" font-size="12" text-anchor="middle">captured frame unavailable</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function getLogPreviewSource(sample) {
  return sample?.previewImage || getFallbackPreviewImage();
}

function getCaptureStatusNode() {
  return query("[data-cal-capture-status]");
}

function getCaptureCountdownNode() {
  return query("[data-cal-capture-countdown]");
}

function shouldUseDelayedCapture() {
  return state.mode === "webcam";
}

function setCaptureButtonState(capture) {
  queryAll('[data-cal-action="sample-correct"], [data-cal-action="sample-incorrect"]').forEach((button) => {
    const shouldHighlight = Boolean(
      capture && (capture.armed || capture.active) && (
        (capture.label === "correct" && button.dataset.calAction === "sample-correct") ||
        (capture.label === "incorrect" && button.dataset.calAction === "sample-incorrect")
      ),
    );
    button.dataset.captureActive = shouldHighlight ? "true" : "false";
  });
}

function renderSampleCaptureUi() {
  const statusNode = getCaptureStatusNode();
  const countdownNode = getCaptureCountdownNode();
  const capture = state.sampleCapture;

  if (statusNode) {
    if (capture.active) {
      const remainingSeconds = Math.max(0, Math.ceil((capture.endAt - Date.now()) / 1000));
      statusNode.textContent = `${capture.label === "correct" ? "correct" : "incorrect"} 저장 중`;
      if (countdownNode) {
        countdownNode.textContent = `${remainingSeconds}s`;
      }
    } else if (capture.armed) {
      statusNode.textContent = `${capture.label === "correct" ? "correct" : "incorrect"} 준비됨`;
      if (countdownNode) {
        countdownNode.textContent = "자세 대기 중";
      }
    } else {
      statusNode.textContent = "대기 중";
      if (countdownNode) {
        countdownNode.textContent = "--";
      }
    }
  } else if (countdownNode && !capture.active && !capture.armed) {
    countdownNode.textContent = "--";
  }

  setCaptureButtonState(capture);
}

function clearSampleCaptureTimer() {
  if (state.sampleCapture.timeoutId) {
    clearTimeout(state.sampleCapture.timeoutId);
    state.sampleCapture.timeoutId = 0;
  }
}

function resetSampleCaptureState() {
  clearSampleCaptureTimer();
  state.sampleCapture.label = null;
  state.sampleCapture.armed = false;
  state.sampleCapture.active = false;
  state.sampleCapture.endAt = 0;
  state.sampleCapture.missedFrames = 0;
  state.latestPreviewImage = "";
  renderSampleCaptureUi();
}

function cancelSampleCapture(reason) {
  const label = state.sampleCapture.label;
  if (!label && !state.sampleCapture.armed && !state.sampleCapture.active) {
    return;
  }

  clearSampleCaptureTimer();
  state.sampleCapture.label = null;
  state.sampleCapture.armed = false;
  state.sampleCapture.active = false;
  state.sampleCapture.endAt = 0;
  state.sampleCapture.missedFrames = 0;
  state.latestPreviewImage = "";
  renderSampleCaptureUi();
  updateStatus(reason || "자동 저장이 취소되었습니다.");
}

function completeSampleCapture() {
  if (!state.sampleCapture.label) {
    resetSampleCaptureState();
    return;
  }

  const label = state.sampleCapture.label;
  const analyzerResult = state.currentResult;

  if (!analyzerResult || analyzerResult.source !== "pose" || analyzerResult.isRealPose !== true) {
    clearSampleCaptureTimer();
    state.sampleCapture.active = false;
    state.sampleCapture.armed = false;
    state.sampleCapture.endAt = 0;
    state.sampleCapture.missedFrames = 0;
    state.sampleCapture.label = null;
    state.latestPreviewImage = "";
    renderSampleCaptureUi();
    updateStatus("자세가 안정되지 않아 자동 저장이 취소되었습니다. 다시 시도해 주세요.");
    return;
  }

  clearSampleCaptureTimer();
  state.sampleCapture.active = false;
  state.sampleCapture.armed = false;
  state.sampleCapture.endAt = 0;
  state.sampleCapture.missedFrames = 0;

  const saved = saveCurrentSample(label, {
    previewImage: state.latestPreviewImage || captureCurrentFramePreview(),
  });
  state.latestPreviewImage = "";
  renderSampleCaptureUi();

  if (!saved) {
    updateStatus("자동 저장에 실패했습니다. 자세를 다시 맞춘 뒤 시도해 주세요.");
  }

  state.sampleCapture.label = null;
}

function armSampleCapture(label) {
  if (!shouldUseDelayedCapture()) {
    const saved = saveCurrentSample(label, {
      previewImage: captureCurrentFramePreview(),
    });
    if (!saved) {
      updateStatus("샘플 저장에 실패했습니다. 현재 프레임과 자세 인식을 확인해 주세요.");
    }
    return;
  }

  clearSampleCaptureTimer();
  state.sampleCapture.label = label;
  state.sampleCapture.armed = true;
  state.sampleCapture.active = false;
  state.sampleCapture.endAt = 0;
  state.sampleCapture.missedFrames = 0;
  state.latestPreviewImage = "";
  renderSampleCaptureUi();
  updateStatus(`${label} 샘플 준비됨. 자세가 잡히면 5초 카운트다운이 시작됩니다.`);
}

function startSampleCaptureCountdown() {
  if (!state.sampleCapture.armed || state.sampleCapture.active || !state.sampleCapture.label) {
    return;
  }

  state.sampleCapture.active = true;
  state.sampleCapture.armed = false;
  state.sampleCapture.endAt = Date.now() + SAMPLE_CAPTURE_COUNTDOWN_MS;
  state.sampleCapture.missedFrames = 0;
  renderSampleCaptureUi();
  updateStatus(`${state.sampleCapture.label} 저장 카운트다운 시작: 5초 동안 자세를 유지해 주세요.`);

  clearSampleCaptureTimer();
  state.sampleCapture.timeoutId = setTimeout(() => {
    completeSampleCapture();
  }, SAMPLE_CAPTURE_COUNTDOWN_MS);
}

function syncSampleCapture(result) {
  if (!shouldUseDelayedCapture()) {
    return;
  }

  const capture = state.sampleCapture;
  if (!capture.label) {
    return;
  }

  if (capture.armed && !capture.active) {
    if (result && result.source === "pose" && result.isRealPose === true) {
      startSampleCaptureCountdown();
    } else {
      renderSampleCaptureUi();
    }
    return;
  }

  if (!capture.active) {
    return;
  }

  const canContinue = result && result.source === "pose" && result.isRealPose === true;
  if (canContinue) {
    capture.missedFrames = 0;
  } else {
    capture.missedFrames += 1;
    if (capture.missedFrames >= SAMPLE_CAPTURE_LOSS_LIMIT) {
      cancelSampleCapture("자세가 끊겨 자동 저장이 취소되었습니다. 다시 시도해 주세요.");
      return;
    }
  }

  renderSampleCaptureUi();
}

function getCurrentThresholds() {
  const api = getThresholdAPI();
  if (api && typeof api.getThresholds === "function") {
    return api.getThresholds(state.lessonKey);
  }
  return {};
}

function getDefaultThresholds() {
  const api = getThresholdAPI();
  if (api && typeof api.getDefaultThresholds === "function") {
    return api.getDefaultThresholds();
  }
  return {};
}

function getCurrentLogs() {
  const api = getThresholdAPI();
  if (api && typeof api.getAccuracyLogs === "function") {
    return api.getAccuracyLogs(state.lessonKey);
  }
  return [];
}

function getLogSummary() {
  const api = getThresholdAPI();
  const logs = getCurrentLogs();
  const uiSummary = summarizeLogsForUi(logs);

  if (api && typeof api.getLogSummary === "function") {
    const summary = api.getLogSummary(state.lessonKey) || {};
    return {
      ...summary,
      lessonKey: state.lessonKey,
      total: uiSummary.total,
      correctCount: uiSummary.correctCount,
      incorrectCount: uiSummary.incorrectCount,
      unknownCount: uiSummary.unknownCount,
    };
  }
  return {
    lessonKey: state.lessonKey,
    total: uiSummary.total,
    correctCount: uiSummary.correctCount,
    incorrectCount: uiSummary.incorrectCount,
    unknownCount: uiSummary.unknownCount,
    poseCount: logs.filter((sample) => sample.source === "pose" && sample.isRealPose === true).length,
    dummyCount: logs.filter((sample) => sample.source === "dummy").length,
    averageAccuracy: 0,
    lastTimestamp: 0,
  };
}

function stopAnalysisLoop() {
  if (state.analysisLoopId) {
    cancelAnimationFrame(state.analysisLoopId);
    state.analysisLoopId = 0;
  }
}

function stopWebcamStream() {
  if (state.webcamStream) {
    state.webcamStream.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch {
        // ignore
      }
    });
    state.webcamStream = null;
  }

  const video = state.ui.video;
  if (video) {
    try {
      video.pause();
    } catch {
      // ignore
    }
    video.srcObject = null;
    video.removeAttribute("src");
  }
}

function stopUploadSource() {
  if (state.uploadImageLoopId) {
    cancelAnimationFrame(state.uploadImageLoopId);
    state.uploadImageLoopId = 0;
  }

  if (state.uploadCanvasStream) {
    state.uploadCanvasStream.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch {
        // ignore
      }
    });
    state.uploadCanvasStream = null;
  }

  if (state.uploadObjectUrl) {
    try {
      URL.revokeObjectURL(state.uploadObjectUrl);
    } catch {
      // ignore
    }
    state.uploadObjectUrl = "";
  }

  state.uploadCanvas = null;
  state.uploadCanvasCtx = null;
  state.uploadImage = null;
  state.uploadFileName = "";
  state.uploadSourceFile = null;
  updateUploadName("file none");
  updateUploadKind("kind none");

  if (state.ui.video) {
    try {
      state.ui.video.pause();
    } catch {
      // ignore
    }
    state.ui.video.srcObject = null;
    state.ui.video.removeAttribute("src");
  }

  if (state.ui.uploadInput) {
    state.ui.uploadInput.value = "";
  }
  updateUploadStatus("upload none");
}

function updateUploadStatus(text) {
  setText("[data-cal-upload-status]", text);
}

function updateUploadName(text) {
  setText("[data-cal-upload-name]", text);
}

function updateUploadKind(text) {
  setText("[data-cal-upload-kind]", text);
}

function updateClipStatus(text) {
  setText("[data-cal-clip-status]", text);
}

function updateYoutubeStatus(text) {
  setText("[data-cal-youtube-status]", text);
}

function renderAssetProgress(value, label, active = false) {
  const progress = query("[data-cal-asset-progress]");
  const fill = query("[data-cal-asset-progress-fill]");
  const labelNode = query("[data-cal-asset-progress-label]");
  const percentNode = query("[data-cal-asset-progress-percent]");
  const percent = clamp(Math.round(toNumber(value, 0)), 0, 100);

  state.assetProgress.value = percent;
  if (progress) {
    progress.dataset.active = active ? "true" : "false";
  }
  if (fill) {
    fill.style.width = `${percent}%`;
  }
  if (labelNode) {
    labelNode.textContent = label || "대기 중";
  }
  if (percentNode) {
    percentNode.textContent = `${percent}%`;
  }
}

function stopAssetProgress(label = "대기 중", value = 0) {
  if (state.assetProgress.timerId) {
    clearInterval(state.assetProgress.timerId);
    state.assetProgress.timerId = 0;
  }
  renderAssetProgress(value, label, false);
}

function startAssetProgress(label) {
  stopAssetProgress(label, 8);
  renderAssetProgress(8, label, true);
  state.assetProgress.timerId = setInterval(() => {
    const current = state.assetProgress.value;
    const increment = current < 45 ? 7 : current < 75 ? 4 : 1;
    renderAssetProgress(Math.min(92, current + increment), label, true);
  }, 700);
}

function completeAssetProgress(label) {
  stopAssetProgress(label, 100);
}

function formatSeconds(value) {
  const seconds = toNumber(value, 0);
  return seconds.toFixed(2);
}

function splitSeconds(totalSeconds) {
  const normalized = Math.max(0, toNumber(totalSeconds, 0));
  const minutes = Math.floor(normalized / 60);
  const seconds = normalized - minutes * 60;
  return { minutes, seconds };
}

function readMinuteSecond(prefix, fallback = 0) {
  const minInput = query(`[data-cal-time="${prefix}-min"]`);
  const secInput = query(`[data-cal-time="${prefix}-sec"]`);
  const minutes = Math.max(0, Math.floor(toNumber(minInput?.value, 0)));
  const seconds = Math.max(0, toNumber(secInput?.value, fallback % 60));
  return minutes * 60 + seconds;
}

function writeMinuteSecond(prefix, totalSeconds) {
  const minInput = query(`[data-cal-time="${prefix}-min"]`);
  const secInput = query(`[data-cal-time="${prefix}-sec"]`);
  const parts = splitSeconds(totalSeconds);
  if (minInput) {
    minInput.value = `${parts.minutes}`;
  }
  if (secInput) {
    secInput.value = formatSeconds(parts.seconds);
  }
}

function syncClipInputs() {
  writeMinuteSecond("clip-start", state.clip.startSec);
  writeMinuteSecond("clip-end", state.clip.endSec);
  writeMinuteSecond("jpeg-start", state.clip.jpegStartSec);
  writeMinuteSecond("jpeg-end", state.clip.jpegEndSec);
}

function readClipStartSec() {
  return readMinuteSecond("clip-start", state.clip.startSec);
}

function readClipEndSec() {
  return readMinuteSecond("clip-end", state.clip.endSec);
}

function readJpegStartSec() {
  return readMinuteSecond("jpeg-start", state.clip.jpegStartSec);
}

function readJpegEndSec() {
  return readMinuteSecond("jpeg-end", state.clip.jpegEndSec);
}

function getVideoCurrentTime() {
  const video = state.ui.video;
  if (!video || !Number.isFinite(video.currentTime)) {
    return 0;
  }
  return Math.max(0, video.currentTime);
}

function setClipPoint(point) {
  const currentTime = getVideoCurrentTime();
  if (point === "start") {
    state.clip.startSec = currentTime;
    state.clip.jpegStartSec = currentTime;
    if (state.clip.endSec <= state.clip.startSec) {
      const duration = Number.isFinite(state.ui.video?.duration) ? state.ui.video.duration : state.clip.startSec + 3;
      state.clip.endSec = Math.min(state.clip.startSec + 3, Math.max(state.clip.startSec + 0.1, duration));
      state.clip.jpegEndSec = state.clip.endSec;
    }
    updateClipStatus(`시작 시간 설정: ${formatSeconds(state.clip.startSec)}초`);
  } else {
    state.clip.endSec = currentTime;
    state.clip.jpegEndSec = currentTime;
    updateClipStatus(`끝 시간 설정: ${formatSeconds(state.clip.endSec)}초`);
  }
  syncClipInputs();
}

function setClipDownload(url, filename) {
  const link = query("[data-cal-clip-download]");
  if (!link) {
    return;
  }

  if (!url) {
    link.hidden = true;
    link.removeAttribute("href");
    link.removeAttribute("download");
    link.textContent = "생성된 업로드 MP4 없음";
    return;
  }

  link.hidden = false;
  link.href = url;
  link.download = filename || "im_boxer_calibration_clip.mp4";
  link.textContent = filename ? `MP4 저장: ${filename}` : "생성된 MP4 저장";
}

function setYoutubeDownload(url, filename) {
  const link = query("[data-cal-youtube-download]");
  if (!link) {
    return;
  }

  if (!url) {
    link.hidden = true;
    link.removeAttribute("href");
    link.removeAttribute("download");
    link.textContent = "생성된 YouTube 파일 없음";
    return;
  }

  link.hidden = false;
  link.href = url;
  link.download = filename || "im_boxer_youtube_asset";
  link.textContent = filename ? `파일 저장: ${filename}` : "생성된 파일 저장";
}

async function saveGeneratedAsset(url, filename) {
  if (!url) {
    return false;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("asset fetch failed");
    }
    const blob = await response.blob();
    const safeName = filename || "im_boxer_asset.jpg";

    if (typeof window.showSaveFilePicker === "function") {
      const extension = safeName.toLowerCase().endsWith(".png") ? ".png" : ".jpg";
      const handle = await window.showSaveFilePicker({
        suggestedName: safeName,
        types: [
          {
            description: "Image file",
            accept: {
              [blob.type || "image/jpeg"]: [extension],
            },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    }

    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = safeName;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
    return true;
  } catch (error) {
    if (error?.name !== "AbortError") {
      console.warn("Asset save failed:", error);
    }
    return false;
  }
}

function showFallbackDummy(reason) {
  updateStatus(`dummy fallback: ${reason}`);
  setPlaceholderMessage(
    "Dummy analysis",
    "Real pose is not available right now. You can still use webcam, upload, or video once the input is ready.",
  );
}

function stopTracker() {
  const tracker = getTracker();
  if (tracker && typeof tracker.stop === "function") {
    try {
      tracker.stop();
    } catch {
      // ignore tracker stop failures
    }
  }
  state.latestLandmarks = null;
  const overlay = getOverlay();
  if (overlay && typeof overlay.clear === "function") {
    overlay.clear(state.ui.overlay);
  }
}

function setPlaceholderMessage(title, message) {
  if (!state.ui.placeholder) {
    return;
  }

  const titleNode = state.ui.placeholder.querySelector("strong");
  const textNode = state.ui.placeholder.querySelector("span");
  if (titleNode) {
    titleNode.textContent = title;
  }
  if (textNode) {
    textNode.textContent = message;
  }
  state.ui.placeholder.hidden = false;
}

function hidePlaceholder() {
  if (state.ui.placeholder) {
    state.ui.placeholder.hidden = true;
  }
}

function openUploadPicker() {
  if (state.ui.uploadInput) {
    state.ui.uploadInput.click();
  }
}

function isSupportedUploadFile(file) {
  if (!file) {
    return false;
  }

  return (
    file.type.startsWith("image/") ||
    file.type.startsWith("video/")
  );
}

async function attachFileToVideo(file, kind) {
  const video = state.ui.video;
  if (!video) {
    return false;
  }

  stopTracker();
  stopWebcamStream();
  stopUploadSource();

  state.uploadFileName = file.name;
  state.uploadSourceFile = kind === "video" ? file : null;
  updateUploadName(file.name);
  updateUploadKind(kind === "image" ? "image upload" : "video upload");
  state.mode = kind === "image" ? "upload-image" : "upload-video";
  updateModeChips(state.mode);
  updateUploadStatus(`upload file: ${file.name}`);
  updateStatus(`${kind === "image" ? "image" : "video"} upload connected`);
  setPlaceholderMessage(
    "Upload preview",
    `${file.name} is loading. Please wait a moment.`,
  );

  const tracker = getTracker();

  if (kind === "video") {
    const objectUrl = URL.createObjectURL(file);
    state.uploadObjectUrl = objectUrl;
    video.srcObject = null;
    video.src = objectUrl;
    setPlaybackRate(state.ui.playbackRate?.value || 1);
    video.onloadedmetadata = () => {
      state.clip.startSec = 0;
      state.clip.endSec = Number.isFinite(video.duration) ? Math.min(video.duration, 5) : 5;
      state.clip.jpegStartSec = state.clip.startSec;
      state.clip.jpegEndSec = state.clip.endSec;
      syncClipInputs();
      setClipDownload("", "");
      updateClipStatus("영상에서 시작/끝 시간을 지정할 수 있습니다.");
    };

    try {
      await video.play();
    } catch {
      // ignore autoplay failures
    }

    hidePlaceholder();
    updateStatus(`upload video analyzing: ${file.name}`);

    if (tracker && typeof tracker.start === "function") {
      await tracker.start(video, {
        onStatus(message, status) {
          updateStatus(message || status || "pose tracker");
        },
        onResult(landmarks) {
          handlePoseFrame(landmarks);
        },
      });
    }

    return true;
  }

  return await new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    state.uploadObjectUrl = objectUrl;

    const image = new Image();
    image.onload = async () => {
      const width = image.naturalWidth || image.width || 1280;
      const height = image.naturalHeight || image.height || 720;
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        updateStatus("image canvas cannot be created.");
        resolve(false);
        return;
      }

      canvas.width = width;
      canvas.height = height;
      state.uploadImage = image;
      state.uploadCanvas = canvas;
      state.uploadCanvasCtx = ctx;
      state.uploadCanvasStream = canvas.captureStream(30);

      const drawFrame = () => {
        if (!state.uploadCanvasCtx || !state.uploadImage) {
          return;
        }
        state.uploadCanvasCtx.drawImage(image, 0, 0, canvas.width, canvas.height);
        state.uploadImageLoopId = requestAnimationFrame(drawFrame);
      };

      drawFrame();
      video.srcObject = state.uploadCanvasStream;
      video.removeAttribute("src");

      try {
        await video.play();
      } catch {
        // ignore autoplay failures
      }

      try {
        URL.revokeObjectURL(objectUrl);
      } catch {
        // ignore URL cleanup failures
      }
      state.uploadObjectUrl = "";
      hidePlaceholder();
      updateStatus(`upload image analyzing: ${file.name}`);

      if (tracker && typeof tracker.start === "function") {
        await tracker.start(video, {
          onStatus(message, status) {
            updateStatus(message || status || "pose tracker");
          },
          onResult(landmarks) {
            handlePoseFrame(landmarks);
          },
        });
      }

      resolve(true);
    };

    image.onerror = () => {
      try {
        URL.revokeObjectURL(objectUrl);
      } catch {
        // ignore URL cleanup failures
      }
      state.uploadObjectUrl = "";
      updateStatus("업로드 이미지를 불러오지 못했습니다.");
      setPlaceholderMessage("Upload failed", "The image file could not be read. Please try webcam or another file.");
      showFallbackDummy("image upload failed");
      resolve(false);
    };

    image.src = objectUrl;
  });
}

async function handleUploadFile(file) {
  if (!file) {
    return false;
  }

  if (!isSupportedUploadFile(file)) {
    updateStatus("unsupported file type");
    return false;
  }

  const kind = file.type.startsWith("image/") ? "image" : "video";
  state.uploadFileName = file.name;
  updateUploadName(file.name);
  updateUploadKind(kind === "image" ? "image upload" : "video upload");
  setText("[data-cal-upload-status]", `upload file: ${file.name}`);
  return attachFileToVideo(file, kind);
}

async function handleUploadUrl(url) {
  const normalizedUrl = String(url || "").trim();
  if (!normalizedUrl) {
    return false;
  }

  updateStatus("데이터셋 이미지를 불러오는 중입니다...");
  try {
    const response = await fetch(normalizedUrl);
    if (!response.ok) {
      throw new Error("image fetch failed");
    }
    const blob = await response.blob();
    const extension = blob.type.includes("png") ? "png" : blob.type.includes("webp") ? "webp" : "jpg";
    const file = new File([blob], `dataset-frame.${extension}`, {
      type: blob.type || "image/jpeg",
    });
    return await handleUploadFile(file);
  } catch {
    updateStatus("데이터셋 이미지를 자동으로 불러오지 못했습니다. 파일을 직접 업로드해 주세요.");
    return false;
  }
}

async function loadCreatedClip(url, filename) {
  const video = state.ui.video;
  if (!video || !url) {
    return false;
  }

  const originalSourceFile = state.uploadSourceFile;
  cancelSampleCapture("생성된 MP4 클립을 불러와 자동 저장이 취소되었습니다.");
  stopTracker();
  stopWebcamStream();
  stopUploadSource();

  state.mode = "upload-video";
  state.uploadSourceFile = originalSourceFile;
  state.clip.createdUrl = url;
  state.clip.createdName = filename || "calibration_clip.mp4";
  updateModeChips(state.mode);
  updateUploadName(state.clip.createdName);
  updateUploadKind("created mp4 clip");
  updateUploadStatus("생성된 MP4 클립 분석 중");

  try {
    video.srcObject = null;
    video.onloadedmetadata = null;
    video.src = url;
    setPlaybackRate(state.ui.playbackRate?.value || 1);
    await video.play();
    hidePlaceholder();
    updateStatus(`생성된 MP4 클립을 불러왔습니다: ${state.clip.createdName}`);

    const tracker = getTracker();
    if (tracker && typeof tracker.start === "function") {
      await tracker.start(video, {
        onStatus(message, status) {
          updateStatus(message || status || "pose tracker");
        },
        onResult(landmarks) {
          handlePoseFrame(landmarks);
        },
      });
    }

    return true;
  } catch (error) {
    console.warn("Calibration clip load failed:", error);
    updateStatus("생성된 MP4 클립을 재생하지 못했습니다.");
    setPlaceholderMessage("Clip playback failed", "The created MP4 clip could not play. Please try another time range.");
    return false;
  }
}

async function createCalibrationClip() {
  const sourceFile = state.uploadSourceFile;
  if (!sourceFile || !sourceFile.type?.startsWith("video/")) {
    updateClipStatus("먼저 영상 파일을 올려 주세요.");
    return false;
  }

  const labelInput = query("[data-cal-clip-label]");
  const startSec = readClipStartSec();
  const endSec = readClipEndSec();

  if (endSec <= startSec) {
    updateClipStatus("끝 시간은 시작 시간보다 커야 합니다.");
    return false;
  }

  const formData = new FormData();
  formData.append("lesson_key", state.lessonKey);
  formData.append("label", labelInput?.value || `${state.lessonKey}_clip`);
  formData.append("start_sec", String(startSec));
  formData.append("end_sec", String(endSec));
  formData.append("file", sourceFile, sourceFile.name);

  updateClipStatus("업로드 MP4 클립 생성 중입니다...");
  startAssetProgress("업로드 MP4 생성 중");

  try {
    const response = await fetch(apiUrl("/api/calibration/video-clips"), {
      method: "POST",
      body: formData,
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload?.success) {
      throw new Error(payload?.detail || payload?.message || "clip request failed");
    }

    const data = payload.data || {};
    const clipUrl = apiUrl(data.clip_url || "");
    state.clip.startSec = startSec;
    state.clip.endSec = endSec;
    state.clip.createdUrl = clipUrl;
    state.clip.createdName = data.filename || "calibration_clip.mp4";
    setClipDownload(clipUrl, state.clip.createdName);
    updateClipStatus(`MP4 생성 완료: ${state.clip.createdName}`);
    completeAssetProgress("업로드 MP4 생성 완료");
    await loadCreatedClip(clipUrl, state.clip.createdName);
    return true;
  } catch (error) {
    console.warn("Calibration clip creation failed:", error);
    updateClipStatus(`MP4 생성 실패: ${error?.message || "서버 오류"}`);
    stopAssetProgress("업로드 MP4 생성 실패", state.assetProgress.value);
    return false;
  }
}

async function createUploadJpegs() {
  const sourceFile = state.uploadSourceFile;
  if (!sourceFile || !sourceFile.type?.startsWith("video/")) {
    updateClipStatus("먼저 영상 파일을 올려 주세요.");
    return false;
  }

  state.clip.jpegStartSec = readJpegStartSec();
  state.clip.jpegEndSec = readJpegEndSec();
  const labelInput = query("[data-cal-clip-label]");
  const formData = new FormData();
  formData.append("lesson_key", state.lessonKey);
  formData.append("label", labelInput?.value || `${state.lessonKey}_upload_jpeg`);
  formData.append("start_sec", String(state.clip.jpegStartSec));
  formData.append("end_sec", String(state.clip.jpegEndSec));
  formData.append("file", sourceFile, sourceFile.name);

  updateClipStatus("업로드 영상에서 JPEG를 만드는 중입니다...");
  startAssetProgress("업로드 JPEG 생성 중");

  try {
    const response = await fetch(apiUrl("/api/calibration/video-frames"), {
      method: "POST",
      body: formData,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.success) {
      throw new Error(payload?.detail || payload?.message || "upload jpeg request failed");
    }

    const frames = Array.isArray(payload.data?.frames) ? payload.data.frames : [];
    if (!frames.length) {
      throw new Error("생성된 JPEG 정보가 없습니다.");
    }

    for (const frame of frames) {
      const frameUrl = apiUrl(frame.frame_url || "");
      setYoutubeDownload(frameUrl, frame.filename || "upload_frame.jpg");
      await saveGeneratedAsset(frameUrl, frame.filename || "upload_frame.jpg");
    }

    const lastFrame = frames[frames.length - 1];
    updateClipStatus(`업로드 JPEG 생성 완료: ${frames.length}장`);
    completeAssetProgress("업로드 JPEG 생성 완료");
    if (lastFrame?.frame_url) {
      await handleUploadUrl(apiUrl(lastFrame.frame_url));
    }
    return true;
  } catch (error) {
    console.warn("Upload JPEG creation failed:", error);
    updateClipStatus(`업로드 JPEG 생성 실패: ${error?.message || "서버 오류"}`);
    stopAssetProgress("업로드 JPEG 생성 실패", state.assetProgress.value);
    return false;
  }
}

function getYoutubeRequestBase() {
  const urlInput = query("[data-cal-youtube-url]");
  const labelInput = query("[data-cal-clip-label]");
  const youtubeUrl = String(urlInput?.value || "").trim();
  if (!youtubeUrl) {
    updateYoutubeStatus("YouTube URL을 입력해 주세요.");
    return null;
  }

  return {
    youtubeUrl,
    label: labelInput?.value || `${state.lessonKey}_youtube`,
  };
}

async function createYoutubeMp4() {
  const requestBase = getYoutubeRequestBase();
  if (!requestBase) {
    return false;
  }

  const startSec = readClipStartSec();
  const endSec = readClipEndSec();
  if (endSec <= startSec) {
    updateYoutubeStatus("끝 시간은 시작 시간보다 커야 합니다.");
    return false;
  }

  const formData = new FormData();
  formData.append("youtube_url", requestBase.youtubeUrl);
  formData.append("lesson_key", state.lessonKey);
  formData.append("label", requestBase.label);
  formData.append("start_sec", String(startSec));
  formData.append("end_sec", String(endSec));

  updateYoutubeStatus("YouTube 영상을 내려받고 MP4를 만드는 중입니다...");
  startAssetProgress("YouTube MP4 생성 중");

  try {
    const response = await fetch(apiUrl("/api/calibration/youtube/mp4"), {
      method: "POST",
      body: formData,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.success) {
      throw new Error(payload?.detail || payload?.message || "youtube mp4 request failed");
    }

    const data = payload.data || {};
    const clipUrl = apiUrl(data.clip_url || "");
    state.youtube.createdUrl = clipUrl;
    state.youtube.createdName = data.filename || "youtube_clip.mp4";
    setYoutubeDownload(clipUrl, state.youtube.createdName);
    updateYoutubeStatus(`YouTube MP4 생성 완료: ${state.youtube.createdName}`);
    completeAssetProgress("YouTube MP4 생성 완료");
    await loadCreatedClip(clipUrl, state.youtube.createdName);
    return true;
  } catch (error) {
    console.warn("YouTube MP4 creation failed:", error);
    updateYoutubeStatus(`YouTube MP4 생성 실패: ${error?.message || "서버 오류"}`);
    stopAssetProgress("YouTube MP4 생성 실패", state.assetProgress.value);
    return false;
  }
}

async function createYoutubeJpeg(point = "start") {
  const requestBase = getYoutubeRequestBase();
  if (!requestBase) {
    return false;
  }

  state.clip.jpegStartSec = readJpegStartSec();
  state.clip.jpegEndSec = readJpegEndSec();
  const timeSec = point === "end" ? state.clip.jpegEndSec : state.clip.jpegStartSec;
  const pointLabel = point === "end" ? "끝" : "시작";
  const formData = new FormData();
  formData.append("youtube_url", requestBase.youtubeUrl);
  formData.append("lesson_key", state.lessonKey);
  formData.append("label", `${requestBase.label}_${point}`);
  formData.append("time_sec", String(timeSec));

  updateYoutubeStatus(`YouTube ${pointLabel} JPEG를 만드는 중입니다...`);
  startAssetProgress(`YouTube ${pointLabel} JPEG 생성 중`);

  try {
    const response = await fetch(apiUrl("/api/calibration/youtube/jpeg"), {
      method: "POST",
      body: formData,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.success) {
      throw new Error(payload?.detail || payload?.message || "youtube jpeg request failed");
    }

    const data = payload.data || {};
    const frameUrl = apiUrl(data.frame_url || "");
    state.youtube.createdUrl = frameUrl;
    state.youtube.createdName = data.filename || `youtube_${point}_frame.jpg`;
    setYoutubeDownload(frameUrl, state.youtube.createdName);
    updateYoutubeStatus(`YouTube ${pointLabel} JPEG 생성 완료: ${state.youtube.createdName}`);
    completeAssetProgress(`YouTube ${pointLabel} JPEG 생성 완료`);
    await saveGeneratedAsset(frameUrl, state.youtube.createdName);
    await handleUploadUrl(frameUrl);
    return true;
  } catch (error) {
    console.warn("YouTube JPEG creation failed:", error);
    updateYoutubeStatus(`YouTube ${pointLabel} JPEG 생성 실패: ${error?.message || "서버 오류"}`);
    stopAssetProgress(`YouTube ${pointLabel} JPEG 생성 실패`, state.assetProgress.value);
    return false;
  }
}

async function createYoutubeJpegs() {
  const createdStart = await createYoutubeJpeg("start");
  if (!createdStart) {
    return false;
  }
  return createYoutubeJpeg("end");
}

function renderAnalysisResult(result) {
  state.currentResult = result || null;

  if (!result) {
    resetThresholdSummaryHistory();
    return;
  }

  setText('[data-cal-metric="accuracy"]', formatMetric(result.accuracy));
  setText('[data-cal-metric="scoreDelta"]', formatMetric(result.scoreDelta));
  setText('[data-cal-metric="postureScore"]', formatMetric(result.postureScore));
  setText('[data-cal-metric="guardScore"]', formatMetric(result.guardScore));
  setText('[data-cal-metric="balanceScore"]', formatMetric(result.balanceScore));
  setText('[data-cal-metric="reactionScore"]', formatMetric(result.reactionScore));
  setText('[data-cal-metric="combo"]', formatMetric(result.combo));
  setText('[data-cal-metric="hp"]', formatMetric(result.hp));

  updateSourceStatus(`source: ${result.source || "unknown"} / mode: ${result.mode || "unknown"} / real: ${result.isRealPose ? "yes" : "no"}`);
  updateSampleBadge(getLogSummary().total);

  if (state.sampleCapture.armed || state.sampleCapture.active) {
    const preview = captureCurrentFramePreview();
    if (preview) {
      state.latestPreviewImage = preview;
    }
  }

  const saveButtons = queryAll('[data-cal-action="sample-correct"], [data-cal-action="sample-incorrect"]');
  saveButtons.forEach((button) => {
    const ready = result.source === "pose" && result.isRealPose === true;
    button.disabled = false;
    button.title = ready
      ? "버튼을 누르면 준비되고, 실제 자세가 들어오면 5초 뒤 자동 저장됩니다."
      : "버튼을 누른 뒤 자세를 맞추면 5초 카운트다운이 시작됩니다.";
  });

  const stabilizedThresholdSummary = getStabilizedThresholdSummary(result.thresholdSummary);

  renderFeatures(result.features || {});
  renderPassBanner(stabilizedThresholdSummary);
  renderFailureFeedback(stabilizedThresholdSummary);
  renderLogSummary(state.lessonKey);
  renderSampleCaptureUi();
}

function renderFeatures(features) {
  const empty = query("[data-cal-features-empty]");
  const list = query("[data-cal-features-list]");
  const entries = Object.entries(features || {});

  if (!list || !empty) {
    return;
  }

  if (entries.length === 0) {
    setHidden(empty, false);
    setHidden(list, true);
    list.innerHTML = "";
    return;
  }

  setHidden(empty, true);
  setHidden(list, false);
  list.innerHTML = "";

  for (const [key, value] of entries) {
    const item = document.createElement("li");
    item.innerHTML = `<strong>${key}</strong><span>${formatFeatureValue(value)}</span>`;
    list.appendChild(item);
  }
}

function renderFailureFeedback(thresholdSummary) {
  const empty = query("[data-cal-failure-empty]");
  const list = query("[data-cal-failure-list]");

  if (!empty || !list) {
    return;
  }

  const failedChecks = Array.isArray(thresholdSummary?.failedChecks)
    ? thresholdSummary.failedChecks
    : [];
  const seenKeys = new Set();
  let normalizedFailedChecks = failedChecks.filter((check) => {
    const rawKey = String(check?.key || "").trim();
    if (!rawKey) {
      return false;
    }

    const normalizedKey = rawKey === "stanceWidthRatio"
      ? "stanceWidth"
      : rawKey === "guardWristToFaceMax"
        ? "bothHandsUp"
        : rawKey;

    if (seenKeys.has(normalizedKey)) {
      return false;
    }

    seenKeys.add(normalizedKey);
    return true;
  });
  const now = Date.now();
  const isLiveFailure = normalizedFailedChecks.length > 0;
  const lastFeedback = state.lastFailureFeedback || {
    checks: [],
    signature: "",
    updatedAt: 0,
    lockedUntil: 0,
    manualLock: false,
  };
  const isFeedbackLocked = Boolean(lastFeedback.manualLock || now < toNumber(lastFeedback.lockedUntil, 0));

  updateFailureLockButton();

  if (isLiveFailure) {
    const signature = getFailureFeedbackSignature(normalizedFailedChecks);
    const age = now - toNumber(lastFeedback.updatedAt, 0);
    const hasRecentFeedback =
      lastFeedback.checks.length > 0 &&
      (isFeedbackLocked || age <= FAILURE_FEEDBACK_LOCK_MS);
    const isDifferentFailure = lastFeedback.signature && signature !== lastFeedback.signature;
    const shouldRefreshSameFailure = signature === lastFeedback.signature && age >= FAILURE_FEEDBACK_REFRESH_MS;

    if (isFeedbackLocked && lastFeedback.checks.length > 0) {
      normalizedFailedChecks = lastFeedback.checks.map((check) => ({
        ...check,
        isLocked: true,
      }));
    } else if (hasRecentFeedback && isDifferentFailure) {
      normalizedFailedChecks = lastFeedback.checks.map((check) => ({
        ...check,
        isLocked: true,
      }));
    } else if (signature === lastFeedback.signature && !shouldRefreshSameFailure && lastFeedback.checks.length > 0) {
      normalizedFailedChecks = lastFeedback.checks.map((check) => ({ ...check }));
    } else {
      state.lastFailureFeedback = {
        checks: normalizedFailedChecks.map((check) => ({ ...check })),
        signature,
        updatedAt: now,
        lockedUntil: now + FAILURE_FEEDBACK_LOCK_MS,
        manualLock: Boolean(lastFeedback.manualLock),
      };
    }
  } else if (
    state.lastFailureFeedback.checks.length > 0 &&
    now - state.lastFailureFeedback.updatedAt <= FAILURE_FEEDBACK_HOLD_MS
  ) {
    normalizedFailedChecks = state.lastFailureFeedback.checks.map((check) => ({
      ...check,
      isRecent: true,
    }));
  }

  if (normalizedFailedChecks.length === 0) {
    setHidden(empty, false);
    setHidden(list, true);
    list.innerHTML = "";
    empty.textContent = "현재 측정에서는 모든 threshold를 통과했거나, 아직 분석 데이터가 충분하지 않습니다.";
    return;
  }

  setHidden(empty, true);
  setHidden(list, false);
  list.innerHTML = "";

  normalizedFailedChecks.forEach((check) => {
    const thresholdKeys = getThresholdKeysForCheck(check);
    const primaryThresholdKey = thresholdKeys[0] || "";
    const title = thresholdKeys.length
      ? thresholdKeys.map((key) => getThresholdDisplayName(key)).join(" / ")
      : check.key;
    const thresholdKeyText = thresholdKeys.length ? thresholdKeys.join(", ") : check.key;
    const guidance = getFailureAdjustmentGuide(check, thresholdKeys);
    const recentBadge = check.isRecent ? '<span class="cal-mini-status">최근 8초 안에 뜬 피드백</span>' : "";
    const lockedBadge = check.isLocked ? '<span class="cal-mini-status">조절하기 쉽게 잠시 고정 중</span>' : "";
    const item = document.createElement("li");
    item.innerHTML = `
      <strong>${title}</strong>
      <span>조절할 Threshold key: ${thresholdKeyText}</span>
      <span>${check.message}</span>
      <span>현재값 ${formatFeatureValue(check.actual)} / 기준 ${check.expectation}</span>
      <span>${guidance}</span>
      ${recentBadge}
      ${lockedBadge}
      ${primaryThresholdKey ? `<button type="button" class="cal-action-btn" data-cal-focus-threshold="${primaryThresholdKey}">해당 Threshold 보기</button>` : ""}
    `;
    list.appendChild(item);
  });
}

function getFailureFeedbackSignature(checks) {
  return (checks || [])
    .map((check) => String(check?.key || "").trim())
    .filter(Boolean)
    .sort()
    .join("|");
}

function isFailureFeedbackLocked() {
  const now = Date.now();
  return Boolean(
    state.lastFailureFeedback.manualLock ||
    now < toNumber(state.lastFailureFeedback.lockedUntil, 0),
  );
}

function lockFailureFeedback(durationMs = FAILURE_FEEDBACK_LOCK_MS) {
  state.lastFailureFeedback.lockedUntil = Date.now() + durationMs;
  updateFailureLockButton();
}

function toggleFailureFeedbackLock() {
  state.lastFailureFeedback.manualLock = !state.lastFailureFeedback.manualLock;
  if (state.lastFailureFeedback.manualLock) {
    state.lastFailureFeedback.lockedUntil = 0;
  }
  updateFailureLockButton();
  renderFailureFeedback({
    failedChecks: state.lastFailureFeedback.checks,
    canPass: false,
  });
}

function updateFailureLockButton() {
  const button = query('[data-cal-action="toggle-failure-lock"]');
  if (!button) {
    return;
  }
  const locked = isFailureFeedbackLocked();
  button.dataset.active = locked ? "true" : "false";
  button.textContent = state.lastFailureFeedback.manualLock
    ? "고정 해제"
    : locked
      ? "고정 중"
      : "피드백 고정";
}

function getThresholdKeysForCheck(check) {
  const rawKey = String(check?.key || "").trim();
  if (!rawKey) {
    return [];
  }

  const mapped = CHECK_TO_THRESHOLD_KEYS[rawKey] || [];
  if (rawKey === "elbowAngle") {
    const actual = toNumber(check.actual, NaN);
    const thresholds = getCurrentThresholds();
    if (Number.isFinite(actual)) {
      if (actual < toNumber(thresholds.elbowAngleMin, -Infinity)) {
        return ["elbowAngleMin"];
      }
      if (actual > toNumber(thresholds.elbowAngleMax, Infinity)) {
        return ["elbowAngleMax"];
      }
    }
  }
  if (rawKey === "kneeAngle" || rawKey === "kneeAngleRange") {
    const actual = toNumber(check.actual, NaN);
    const thresholds = getCurrentThresholds();
    if (Number.isFinite(actual)) {
      if (actual < toNumber(thresholds.kneeAngleMin, -Infinity)) {
        return ["kneeAngleMin"];
      }
      if (actual > toNumber(thresholds.kneeAngleMax, Infinity)) {
        return ["kneeAngleMax"];
      }
    }
  }
  if (rawKey === "kneeBend") {
    const actual = toNumber(check.actual, NaN);
    const thresholds = getCurrentThresholds();
    if (Number.isFinite(actual)) {
      if (actual < toNumber(thresholds.kneeBendMin, -Infinity)) {
        return ["kneeBendMin"];
      }
      if (actual > toNumber(thresholds.kneeBendMax, Infinity)) {
        return ["kneeBendMax"];
      }
    }
  }

  return mapped.length ? mapped : [rawKey];
}

function getFailureAdjustmentGuide(check, thresholdKeys) {
  const key = thresholdKeys[0] || "";
  const actual = toNumber(check?.actual, NaN);
  const thresholdValue = toNumber(getCurrentThresholds()[key], NaN);
  const label = key ? getThresholdDisplayName(key) : "해당 기준값";

  if (!key || !Number.isFinite(actual) || !Number.isFinite(thresholdValue)) {
    return "Feature Snapshot의 현재값과 Thresholds의 기준값을 비교해서 조절하세요.";
  }

  if (/Min/i.test(key)) {
    return actual < thresholdValue
      ? `${label}은 현재값보다 높게 잡혀 있습니다. 사진 기준을 통과시키려면 이 값을 ${formatFeatureValue(actual)} 근처나 조금 낮게 내리세요.`
      : `${label}은 현재값 이상이면 통과합니다. 더 엄격하게 보려면 조금 올리세요.`;
  }

  if (/Max/i.test(key)) {
    return actual > thresholdValue
      ? `${label}은 현재값보다 낮게 잡혀 있습니다. 사진 기준을 통과시키려면 이 값을 ${formatFeatureValue(actual)} 근처나 조금 높게 올리세요.`
      : `${label}은 현재값 이하이면 통과합니다. 더 엄격하게 보려면 조금 내리세요.`;
  }

  return `${label} 값을 현재값 ${formatFeatureValue(actual)}와 비교해서 조절하세요.`;
}

function renderPassBanner(thresholdSummary) {
  const banner = query("[data-cal-pass-banner]");
  const badge = query("[data-cal-pass-badge]");
  const note = query("[data-cal-pass-note]");

  if (!banner || !badge || !note) {
    return;
  }

  const canPass = Boolean(thresholdSummary?.canPass);
  const quality = typeof thresholdSummary?.quality === "number"
    ? Math.round(thresholdSummary.quality * 100)
    : null;

  if (!thresholdSummary) {
    banner.dataset.state = "idle";
    badge.textContent = "READY";
    note.textContent = "자세가 들어오면 success / fail 상태를 여기서 바로 보여줍니다.";
    return;
  }

  if (canPass) {
    banner.dataset.state = "success";
    badge.textContent = "SUCCESS";
    note.textContent = quality === null
      ? "현재 자세는 통과 기준을 만족합니다."
      : `현재 자세는 통과 기준을 만족합니다. pass quality ${quality}%`;
    return;
  }

  banner.dataset.state = "fail";
  badge.textContent = "FAIL";
  note.textContent = quality === null
    ? "현재 자세는 아직 통과 기준에 도달하지 못했습니다."
    : `현재 자세는 아직 통과 기준에 도달하지 못했습니다. pass quality ${quality}%`;
}

function formatFeatureValue(value) {
  if (typeof value === "number") {
    return Number.isInteger(value) ? `${value}` : value.toFixed(3);
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (value === null || value === undefined) {
    return "--";
  }

  return String(value);
}

function getThresholdMeta(key) {
  return THRESHOLD_META[key] || {
    label: key,
    description: "이 threshold가 통과 판정에 쓰이는 기준값입니다.",
  };
}

function getThresholdDisplayName(key, mode = "korean") {
  const meta = getThresholdMeta(key);
  if (mode === "english") {
    return key;
  }
  return meta.label;
}

function resetThresholdSummaryHistory() {
  state.thresholdSummaryHistory = [];
  state.lastFailureFeedback = {
    checks: [],
    signature: "",
    updatedAt: 0,
    lockedUntil: 0,
    manualLock: false,
  };
  updateFailureLockButton();
}

function getStabilizedThresholdSummary(thresholdSummary) {
  if (!thresholdSummary) {
    resetThresholdSummaryHistory();
    return null;
  }

  const entry = {
    canPass: Boolean(thresholdSummary.canPass),
    quality: typeof thresholdSummary.quality === "number" ? thresholdSummary.quality : 0,
    failedChecks: Array.isArray(thresholdSummary.failedChecks) ? thresholdSummary.failedChecks : [],
  };

  state.thresholdSummaryHistory.push(entry);
  state.thresholdSummaryHistory = state.thresholdSummaryHistory.slice(-THRESHOLD_HISTORY_LIMIT);

  const history = state.thresholdSummaryHistory;
  const passVotes = history.filter((item) => item.canPass).length;
  const averageQuality = history.reduce((sum, item) => sum + item.quality, 0) / history.length;
  const stabilizedPass =
    entry.canPass &&
    (
      passVotes >= Math.ceil(history.length / 2) ||
      averageQuality >= 0.76
    );

  return {
    ...thresholdSummary,
    canPass: stabilizedPass,
    quality: Math.max(thresholdSummary.quality || 0, averageQuality),
    failedChecks: stabilizedPass ? [] : entry.failedChecks,
  };
}

function renderThresholdInputs(lessonKey) {
  const grid = query("[data-cal-threshold-grid]");
  if (!grid) {
    return;
  }

  const thresholds = getCurrentThresholds();
  const defaults = getDefaultThresholds()[lessonKey] || {};
  const entries = Object.entries(thresholds);

  if (entries.length === 0) {
    grid.innerHTML = '<div class="cal-empty">현재 레슨의 threshold가 없습니다.</div>';
    return;
  }

  grid.innerHTML = "";

  entries.forEach(([key, value]) => {
    const meta = getThresholdMeta(key);
    const item = document.createElement("div");
    item.className = "cal-threshold-item";
    item.innerHTML = `
      <label for="cal-threshold-${key}">${meta.label}</label>
      <small>${meta.description}</small>
      <input
        id="cal-threshold-${key}"
        data-cal-threshold-input="${key}"
        type="number"
        inputmode="decimal"
        step="0.01"
        value="${Number.isFinite(value) ? value : 0}"
      >
      <small>기본값: ${formatFeatureValue(defaults[key])} / key: ${key}</small>
    `;
    grid.appendChild(item);
  });
}

function renderDefaultPoseGuide(lessonKey) {
  const panel = query("[data-cal-reference-guide]");
  if (!panel) {
    return;
  }

  const normalizedLessonKey = lessonKey || state.lessonKey;
  const guide = DEFAULT_POSE_GUIDES[normalizedLessonKey];
  const defaults = getDefaultThresholds()[normalizedLessonKey] || {};
  if (!guide) {
    panel.innerHTML = '<div class="cal-empty">이 레슨의 기본 기준 자세 정보가 없습니다.</div>';
    return;
  }

  const valueRows = guide.keys
    .filter((key) => Object.prototype.hasOwnProperty.call(defaults, key))
    .map((key) => {
      const meta = getThresholdMeta(key);
      return `<li><strong>${meta.label}</strong><span>${formatFeatureValue(defaults[key])}</span></li>`;
    })
    .join("");

  const points = guide.points
    .map((point) => `<li><span>${point}</span></li>`)
    .join("");

  panel.innerHTML = `
    <div class="cal-empty">
      <strong>${guide.title}</strong><br>
      ${guide.summary}
    </div>
    <ul class="cal-list compact">${points}</ul>
    <ul class="cal-list compact">${valueRows}</ul>
  `;
}

function renderLogSummary(lessonKey) {
  const summary = getLogSummary(lessonKey);
  const logs = getCurrentLogsSorted();
  const uiSummary = summarizeLogsForUi(logs);
  setText('[data-cal-log-count="correct"]', `${summary.correctCount || 0}`);
  setText('[data-cal-log-count="incorrect"]', `${summary.incorrectCount || 0}`);
  setText('[data-cal-log-count="total"]', `${summary.total || 0}`);
  setText('[data-cal-compare-count="correct"]', `${uiSummary.correctCount || 0}`);
  setText('[data-cal-compare-count="incorrect"]', `${uiSummary.incorrectCount || 0}`);
  updateSampleBadge(summary.total || 0);
  updateLogFilterButtons();
  updateDetailToggleButton();
  updateCompareToggleButton();
  updateSortToggleButton();
  renderAccuracyLogEntries(lessonKey);
}

function updateLogPosition(index, total) {
  setText("[data-cal-log-detail-position]", total > 0 ? `${index + 1} / ${total}` : "0 / 0");
}

function createLogItem(sample, selectedId, compact = false) {
  const label = normalizeUiLabel(sample?.label);
  const item = document.createElement("div");
  item.className = compact ? "cal-log-item cal-log-item-compare" : "cal-log-item";
  item.dataset.calLogSelect = sample.id || "";
  item.setAttribute("role", "button");
  item.setAttribute("tabindex", "0");
  item.dataset.active = sample.id === selectedId ? "true" : "false";
  item.dataset.label = label;
  item.innerHTML = `
    <img class="cal-log-thumb" src="${getLogPreviewSource(sample)}" alt="${label || "sample"} thumbnail">
    <div class="cal-log-meta">
      <strong>${label || "unknown"} / ${formatMetric(sample.accuracy)}%</strong>
      <span>${formatLogTimestamp(sample.timestamp)}</span>
      <span>${sample.source || "unknown"} · ${sample.isRealPose ? "real pose" : "dummy"}</span>
    </div>
    <div class="cal-log-actions">
      <span class="cal-mini-status">${sample.id === selectedId ? "selected" : "tap"}</span>
      <button type="button" class="cal-action-btn danger" data-cal-log-delete="${sample.id || ""}">삭제</button>
    </div>
  `;

  const deleteButton = item.querySelector("[data-cal-log-delete]");
  const thumb = item.querySelector(".cal-log-thumb");
  if (thumb) {
    thumb.onerror = () => {
      thumb.onerror = null;
      thumb.src = getFallbackPreviewImage();
    };
  }
  if (deleteButton) {
    deleteButton.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteAccuracyLogSample(sample.id);
    });
  }

  item.addEventListener("click", () => {
    state.selectedLogId = sample.id || "";
    renderAccuracyLogEntries(state.lessonKey);
  });

  item.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      state.selectedLogId = sample.id || "";
      renderAccuracyLogEntries(state.lessonKey);
    }
  });

  return item;
}

function renderComparisonView() {
  const compareNode = query("[data-cal-log-compare]");
  const correctNode = query('[data-cal-compare-list="correct"]');
  const incorrectNode = query('[data-cal-compare-list="incorrect"]');
  const correctCountNode = query('[data-cal-compare-count="correct"]');
  const incorrectCountNode = query('[data-cal-compare-count="incorrect"]');
  if (!compareNode || !correctNode || !incorrectNode) {
    return;
  }

  const logs = getCurrentLogsSorted();
  const correctLogs = logs.filter((sample) => normalizeUiLabel(sample?.label) === "correct");
  const incorrectLogs = logs.filter((sample) => normalizeUiLabel(sample?.label) === "incorrect");
  const selectedId = state.selectedLogId && logs.some((sample) => sample.id === state.selectedLogId)
    ? state.selectedLogId
    : logs[0]?.id || "";

  if (correctCountNode) {
    correctCountNode.textContent = `${correctLogs.length}`;
  }
  if (incorrectCountNode) {
    incorrectCountNode.textContent = `${incorrectLogs.length}`;
  }

  correctNode.innerHTML = "";
  incorrectNode.innerHTML = "";

  const renderColumn = (target, samples) => {
    if (!samples.length) {
      const empty = document.createElement("div");
      empty.className = "cal-empty";
      empty.textContent = "샘플이 없습니다.";
      target.appendChild(empty);
      return;
    }

    samples.forEach((sample) => {
      target.appendChild(createLogItem(sample, selectedId, true));
    });
  };

  renderColumn(correctNode, correctLogs);
  renderColumn(incorrectNode, incorrectLogs);
  setHidden(compareNode, false);
  compareNode.hidden = false;
}

function updateLogDetail(sample) {
  const emptyNode = query("[data-cal-log-detail-empty]");
  const bodyNode = query("[data-cal-log-detail-body]");
  const imageNode = query("[data-cal-log-detail-image]");
  const metaNode = query("[data-cal-log-detail-meta]");
  const jsonNode = query("[data-cal-log-detail-json]");
  const deleteButton = query('[data-cal-action="delete-selected-log"]');

  if (!emptyNode || !bodyNode || !imageNode || !metaNode || !jsonNode || !deleteButton) {
    return;
  }

  if (!sample) {
    setHidden(emptyNode, false);
    setHidden(bodyNode, true);
    setHidden(imageNode, true);
    setHidden(metaNode, true);
    setHidden(jsonNode, true);
    setHidden(deleteButton, true);
    imageNode.removeAttribute("src");
    metaNode.textContent = "";
    jsonNode.textContent = "";
    deleteButton.dataset.selectedLogId = "";
    emptyNode.textContent = "아직 선택된 샘플이 없습니다. 왼쪽에서 샘플을 선택하면 썸네일, 메타데이터, 삭제 버튼이 표시됩니다.";
    return;
  }

  setHidden(emptyNode, true);
  if (!state.logDetailOpen) {
    setHidden(bodyNode, true);
    setHidden(imageNode, true);
    setHidden(metaNode, true);
    setHidden(jsonNode, true);
    setHidden(deleteButton, true);
    emptyNode.hidden = false;
    emptyNode.textContent = "상세가 접혀 있습니다. Sample Detail의 상세 보기 버튼을 누르면 썸네일과 JSON을 확인할 수 있습니다.";
    return;
  }

  setHidden(bodyNode, false);
  setHidden(imageNode, false);
  setHidden(metaNode, false);
  setHidden(jsonNode, false);
  setHidden(deleteButton, false);

  imageNode.onerror = () => {
    imageNode.onerror = null;
    imageNode.src = getFallbackPreviewImage();
  };
  imageNode.src = getLogPreviewSource(sample);
  imageNode.alt = `${sample.label || "sample"} preview`;
  metaNode.textContent = [
    `label: ${sample.label || "unknown"}`,
    `time: ${formatLogTimestamp(sample.timestamp)}`,
    `accuracy: ${formatMetric(sample.accuracy)}`,
    `source: ${sample.source || "unknown"}`,
    `id: ${sample.id || ""}`,
  ].join(" / ");
  jsonNode.textContent = JSON.stringify({
    id: sample.id,
    label: sample.label,
    timestamp: sample.timestamp,
    accuracy: sample.accuracy,
    source: sample.source,
    isRealPose: sample.isRealPose,
    metrics: sample.metrics || {},
    features: sample.features || {},
  }, null, 2);
  deleteButton.dataset.selectedLogId = sample.id || "";
}

function renderAccuracyLogEntries(lessonKey) {
  const listNode = query("[data-cal-log-list]");
  const prevButton = query('[data-cal-action="log-prev"]');
  const nextButton = query('[data-cal-action="log-next"]');
  const compareNode = query("[data-cal-log-compare]");
  if (!listNode) {
    return;
  }

  const logs = state.compareMode ? getCurrentLogsSorted() : getVisibleLogs();
  const selectedId = state.selectedLogId && logs.some((sample) => sample.id === state.selectedLogId)
    ? state.selectedLogId
    : logs[0]?.id || "";

  state.selectedLogId = selectedId;
  listNode.innerHTML = "";

  if (compareNode) {
    setHidden(compareNode, !state.compareMode);
  }

  if (state.compareMode) {
    listNode.hidden = true;
    renderComparisonView();
  } else {
    listNode.hidden = false;
  }

  if (!logs.length) {
    const emptyMessage = state.logFilter === "all"
      ? "아직 저장된 샘플이 없습니다."
      : `현재 ${state.logFilter} 샘플이 없습니다.`;
    listNode.innerHTML = `<div class="cal-empty">${emptyMessage}</div>`;
    updateLogDetail(null);
    updateLogPosition(0, 0);
    if (prevButton) prevButton.disabled = true;
    if (nextButton) nextButton.disabled = true;
    if (state.compareMode) {
      renderComparisonView();
    }
    return;
  }

  const selectedIndex = Math.max(0, logs.findIndex((sample) => sample.id === selectedId));
  updateLogPosition(selectedIndex, logs.length);
  if (prevButton) prevButton.disabled = selectedIndex <= 0;
  if (nextButton) nextButton.disabled = selectedIndex < 0 || selectedIndex >= logs.length - 1;

  if (!state.compareMode) {
    logs.forEach((sample) => {
      listNode.appendChild(createLogItem(sample, selectedId, false));
    });
  }

  const selectedSample = logs.find((sample) => sample.id === selectedId) || logs[0] || null;
  updateLogDetail(selectedSample);
}

function setSelectedLogByOffset(offset) {
  const logs = getVisibleLogs();
  if (!logs.length) {
    return;
  }

  const currentIndex = Math.max(0, logs.findIndex((sample) => sample.id === state.selectedLogId));
  const nextIndex = Math.min(logs.length - 1, Math.max(0, currentIndex + offset));
  const nextSample = logs[nextIndex];
  if (!nextSample) {
    return;
  }

  state.selectedLogId = nextSample.id || "";
  renderAccuracyLogEntries(state.lessonKey);
}

function toggleLogDetailVisibility() {
  state.logDetailOpen = !state.logDetailOpen;
  updateDetailToggleButton();
  updateLogDetail(getVisibleLogs().find((sample) => sample.id === state.selectedLogId) || null);
}

function setLogFilter(filterKey) {
  state.logFilter = filterKey || "all";
  state.selectedLogId = "";
  state.compareMode = false;
  updateLogFilterButtons();
  updateCompareToggleButton();
  renderAccuracyLogEntries(state.lessonKey);
}

function toggleCompareView() {
  state.compareMode = !state.compareMode;
  updateCompareToggleButton();
  renderAccuracyLogEntries(state.lessonKey);
}

function toggleLogSortOrder() {
  state.logSortOrder = state.logSortOrder === "oldest" ? "newest" : "oldest";
  updateSortToggleButton();
  renderAccuracyLogEntries(state.lessonKey);
}

function clearCanvas() {
  const overlay = getOverlay();
  if (overlay && typeof overlay.clear === "function") {
    overlay.clear(state.ui.overlay);
  }
  if (overlay && typeof overlay.hide === "function") {
    overlay.hide(state.ui.debugOverlay);
  }
}

function handlePoseFrame(poseLandmarks) {
  state.latestLandmarks = poseLandmarks || null;

  if (poseLandmarks && Array.isArray(poseLandmarks)) {
    const overlay = getOverlay();
    if (overlay && typeof overlay.draw === "function") {
      overlay.draw(state.ui.overlay, poseLandmarks, state.ui.video);
    }
    if (overlay && typeof overlay.clear === "function") {
      overlay.clear(state.ui.debugOverlay);
    }
    hidePlaceholder();
  } else {
    clearCanvas();
  }
}

function analyzeCurrentFrame(timestamp) {
  if (!state.running) {
    return;
  }

  if (timestamp - state.lastAnalysisAt < ANALYSIS_INTERVAL_MS) {
    state.analysisLoopId = requestAnimationFrame(analyzeCurrentFrame);
    return;
  }

  state.lastAnalysisAt = timestamp;

  const analyzer = getAnalyzer();
  let result = null;
  try {
    if (state.latestLandmarks && analyzer && typeof analyzer.analyzePoseFrame === "function") {
      result = analyzer.analyzePoseFrame(state.latestLandmarks);
    } else if (typeof analyzer === "function") {
      result = analyzer({
        lessonKey: state.lessonKey,
        now: timestamp,
        state: { trainingState: "active" },
      });
    }
  } catch (error) {
    console.error("Calibration analysis failed:", error);
  }

  if (result) {
    renderAnalysisResult(result);
  }

  syncSampleCapture(result);

  state.analysisLoopId = requestAnimationFrame(analyzeCurrentFrame);
}

async function startWebcamMode() {
  cancelSampleCapture("웹캠 모드로 전환되어 자동 저장이 취소되었습니다.");
  state.mode = "webcam";
  state.latestLandmarks = null;
  updateModeChips(state.mode);
  updateStatus("webcam ready");
  setPlaceholderMessage("Webcam / Video Preview", "Connect webcam or upload a file to analyze the pose.");
  stopTracker();
  stopWebcamStream();

  if (!navigator.mediaDevices?.getUserMedia) {
    updateStatus("webcam unavailable");
    setPlaceholderMessage("Webcam unavailable", "This browser cannot use the camera right now. Please use upload or video mode.");
    showFallbackDummy("webcam unavailable");
    return false;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: false,
    });
    state.webcamStream = stream;
    const video = state.ui.video;
    video.srcObject = stream;
    await video.play();
    hidePlaceholder();
    updateStatus("webcam connected");

    const tracker = getTracker();
    if (tracker && typeof tracker.start === "function") {
      await tracker.start(video, {
        onStatus(message, status) {
          updateStatus(message || status || "pose tracker");
        },
        onResult(landmarks) {
          handlePoseFrame(landmarks);
        },
      });
    }

    return true;
  } catch (error) {
    console.warn("Calibration webcam start failed:", error);
    updateStatus("webcam connection failed");
    setPlaceholderMessage("Webcam connection failed", "The camera permission or device may not be available. Dummy analysis will continue.");
    showFallbackDummy("webcam connection failed");
    return false;
  }
}
async function startVideoMode(type) {
  cancelSampleCapture("비디오 모드로 전환되어 자동 저장이 취소되었습니다.");
  state.mode = type;
  state.latestLandmarks = null;
  updateModeChips(state.mode);
  stopTracker();
  stopWebcamStream();

  const configuredSource = globalScope.IM_BOXER_CALIBRATION_VIDEOS?.[type] || "";
  const video = state.ui.video;

  if (!configuredSource) {
    updateStatus(`${type} video source is not configured`);
    setPlaceholderMessage(
      "Video source not configured",
      `${type} mode does not have a configured sample video yet. Calibration will continue with dummy analysis.`,
    );
    video.removeAttribute("src");
    showFallbackDummy(`${type} video source missing`);
    return false;
  }

  try {
    video.srcObject = null;
    video.src = configuredSource;
    await video.play();
    hidePlaceholder();
    updateStatus(`${type} video loaded`);
    const tracker = getTracker();
    if (tracker && typeof tracker.start === "function") {
      await tracker.start(video, {
        onStatus(message, status) {
          updateStatus(message || status || "pose tracker");
        },
        onResult(landmarks) {
          handlePoseFrame(landmarks);
        },
      });
    }
    return true;
  } catch (error) {
    console.warn("Calibration video start failed:", error);
    updateStatus(`${type} video playback failed`);
    setPlaceholderMessage("Video playback failed", `${type} video could not play. Dummy analysis will continue.`);
    showFallbackDummy(`${type} playback failed`);
    return false;
  }
}
function saveCurrentSample(label, options = {}) {
  const analyzerResult = state.currentResult;
  if (!analyzerResult) {
    updateStatus("저장할 결과가 없습니다.");
    return false;
  }

  if (analyzerResult.source !== "pose" || analyzerResult.isRealPose !== true) {
    updateStatus("실제 pose가 아닙니다. 샘플을 저장하지 않았습니다.");
    return false;
  }

  const api = getThresholdAPI();
  if (!api || typeof api.logAccuracySample !== "function") {
    updateStatus("샘플 저장 모듈을 사용할 수 없습니다.");
    return false;
  }

  const sampleId = String(options.sampleId || createSampleId());
  const previewImage = typeof options.previewImage === "string" && options.previewImage
    ? options.previewImage
    : captureCurrentFramePreview();
  const saved = api.logAccuracySample(state.lessonKey, {
    id: sampleId,
    version: 1,
    lessonKey: state.lessonKey,
    timestamp: Date.now(),
    label,
    source: analyzerResult.source,
    isRealPose: analyzerResult.isRealPose,
    accuracy: analyzerResult.accuracy,
    metrics: analyzerResult.metrics || {},
    features: analyzerResult.features || {},
    previewImage,
  });

  if (saved) {
    state.selectedLogId = sampleId;
    updateStatus(`${label} 샘플이 저장되었습니다.`);
    renderLogSummary(state.lessonKey);
    return true;
  }

  updateStatus("샘플 저장에 실패했습니다.");
  return false;
}

function showRecommendations() {
  const api = getThresholdAPI();
  if (!api || typeof api.suggestThresholdAdjustments !== "function") {
    return;
  }

  const result = api.suggestThresholdAdjustments(state.lessonKey);
  state.recommendation = result;

  const empty = query("[data-cal-recommendation-empty]");
  const list = query("[data-cal-recommendation-list]");
  const note = query("[data-cal-recommendation-note]");
  if (!empty || !list || !note) {
    return;
  }

  if (!result || !result.canSuggest || !Array.isArray(result.recommendations) || result.recommendations.length === 0) {
    setHidden(empty, false);
    setHidden(list, true);
    list.innerHTML = "";
    note.textContent = result?.reason || "추천할 threshold가 아직 없습니다.";
    return;
  }

  setHidden(empty, true);
  setHidden(list, false);
  list.innerHTML = "";
  note.textContent = `${result.correctCount} correct / ${result.incorrectCount} incorrect 샘플을 바탕으로 추천했습니다.`;

  result.recommendations.forEach((recommendation) => {
    const currentValue = Number(recommendation.current);
    const suggestedValue = Number(recommendation.suggested);
    const meta = getThresholdMeta(recommendation.key);
    const isApplied = Number.isFinite(currentValue)
      && Number.isFinite(suggestedValue)
      && Math.abs(currentValue - suggestedValue) < 0.0001;
    const buttonLabel = isApplied ? "적용됨" : "적용";
    const item = document.createElement("li");
    item.innerHTML = `
      <div>
        <strong>${getThresholdDisplayName(recommendation.key, "english")}</strong><br>
        <span class="recommendation-meta">${meta.description}</span><br>
        <span class="recommendation-meta">label: ${meta.label}</span><br>
        <span class="recommendation-meta">${recommendation.basedOn || ""}</span>
      </div>
      <div style="text-align:right; display:grid; gap:4px;">
        <span>현재값: ${formatFeatureValue(recommendation.current)}</span>
        <span>추천값: ${formatFeatureValue(recommendation.suggested)}</span>
        <button type="button" class="cal-action-btn" data-cal-apply-key="${recommendation.key}" data-cal-apply-value="${recommendation.suggested}" ${isApplied ? "disabled aria-disabled=\"true\" data-applied=\"true\"" : ""}>${buttonLabel}</button>
      </div>
    `;
    list.appendChild(item);
  });
}

function applyRecommendation(key, value) {
  const api = getThresholdAPI();
  if (!api || typeof api.updateThreshold !== "function") {
    return;
  }

  api.updateThreshold(state.lessonKey, key, value);
  renderThresholdInputs(state.lessonKey);
  renderDefaultPoseGuide(state.lessonKey);
  renderLogSummary(state.lessonKey);
  showRecommendations();
  updateStatus(`${key} threshold를 적용했습니다. 현재 값: ${formatFeatureValue(value)}`);
}

function focusThresholdInput(key) {
  lockFailureFeedback();
  const input = query(`[data-cal-threshold-input="${key}"]`);
  if (!input) {
    updateStatus(`${key} threshold 입력칸을 찾지 못했습니다.`);
    return;
  }

  input.scrollIntoView({ behavior: "smooth", block: "center" });
  input.focus({ preventScroll: true });
  input.select?.();
  updateStatus(`${getThresholdDisplayName(key)} 입력칸을 선택했습니다.`);
}

function saveThresholdInputs() {
  const inputs = queryAll("[data-cal-threshold-input]");
  if (!inputs.length) {
    return;
  }

  const api = getThresholdAPI();
  if (!api || typeof api.saveThresholds !== "function") {
    return;
  }

  const thresholds = getCurrentThresholds();
  const next = { ...thresholds };
  inputs.forEach((input) => {
    const key = input.dataset.calThresholdInput;
    const value = toNumber(input.value, next[key]);
    next[key] = value;
  });
  lockFailureFeedback();

  api.saveThresholds({
    version: 1,
    thresholds: {
      [state.lessonKey]: next,
    },
  });

  renderThresholdInputs(state.lessonKey);
  renderDefaultPoseGuide(state.lessonKey);
  updateStatus("threshold를 저장했습니다.");
}

function resetCurrentLessonThresholds() {
  const api = getThresholdAPI();
  if (!api || typeof api.resetLessonThresholds !== "function") {
    return;
  }

  api.resetLessonThresholds(state.lessonKey);
  renderThresholdInputs(state.lessonKey);
  renderDefaultPoseGuide(state.lessonKey);
  updateStatus("현재 레슨 threshold를 기본값으로 복구했습니다.");
}

function clearCurrentLessonLogs() {
  const api = getThresholdAPI();
  if (!api || typeof api.clearAccuracyLogs !== "function") {
    return;
  }

  api.clearAccuracyLogs(state.lessonKey);
  state.selectedLogId = "";
  renderLogSummary(state.lessonKey);
  showRecommendations();
  updateStatus("현재 레슨 로그를 초기화했습니다.");
}

function deleteAccuracyLogSample(sampleId) {
  const api = getThresholdAPI();
  if (!api || typeof api.deleteAccuracySample !== "function") {
    updateStatus("샘플 삭제 기능을 사용할 수 없습니다.");
    return false;
  }

  const deleted = api.deleteAccuracySample(state.lessonKey, sampleId);
  if (!deleted) {
    updateStatus("삭제할 샘플을 찾지 못했습니다.");
    return false;
  }

  const logs = getCurrentLogsSorted();
  state.selectedLogId = logs[0]?.id || "";
  renderLogSummary(state.lessonKey);
  showRecommendations();
  updateStatus("선택한 샘플을 삭제했습니다.");
  return true;
}

function clearAllLogs() {
  const api = getThresholdAPI();
  if (!api || typeof api.clearAllAccuracyLogs !== "function") {
    return;
  }

  api.clearAllAccuracyLogs();
  state.selectedLogId = "";
  renderLogSummary(state.lessonKey);
  showRecommendations();
  updateStatus("전체 로그를 초기화했습니다.");
}

function exportCalibrationBundle() {
  const api = getThresholdAPI();
  const payload = {
    exportedAt: Date.now(),
    lessonKey: state.lessonKey,
    thresholds: getCurrentThresholds(),
    summary: getLogSummary(state.lessonKey),
    logs: api && typeof api.getAccuracyLogs === "function" ? api.getAccuracyLogs(state.lessonKey) : [],
    recommendation: state.recommendation || null,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `im_boxer_calibration_${state.lessonKey}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function openCalibrationImportPicker() {
  if (!state.ui.importInput) {
    updateStatus("JSON 가져오기 입력창을 찾지 못했습니다.");
    return;
  }

  state.ui.importInput.click();
}

function isNumericThresholdMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const entries = Object.entries(value);
  return entries.length > 0 && entries.every(([, item]) => typeof item === "number" && Number.isFinite(item));
}

function normalizeImportedThresholdMap(value) {
  const output = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return output;
  }

  Object.entries(value).forEach(([key, item]) => {
    const numericValue = Number(item);
    if (Number.isFinite(numericValue)) {
      output[key] = numericValue;
    }
  });
  return output;
}

function resolveImportedThresholdTree(payload) {
  const rawThresholds = payload?.thresholds;
  if (!rawThresholds || typeof rawThresholds !== "object" || Array.isArray(rawThresholds)) {
    return {};
  }

  if (isNumericThresholdMap(rawThresholds)) {
    const lessonKey = String(payload?.lessonKey || state.lessonKey || "").trim();
    if (!lessonKey) {
      return {};
    }
    return {
      [lessonKey]: normalizeImportedThresholdMap(rawThresholds),
    };
  }

  const output = {};
  Object.entries(rawThresholds).forEach(([lessonKey, lessonThresholds]) => {
    const normalized = normalizeImportedThresholdMap(lessonThresholds);
    if (Object.keys(normalized).length > 0) {
      output[lessonKey] = normalized;
    }
  });
  return output;
}

async function importCalibrationJson(file) {
  const api = getThresholdAPI();
  if (!api || typeof api.saveThresholds !== "function") {
    updateStatus("Threshold 저장 기능을 사용할 수 없습니다.");
    return;
  }

  let payload = null;
  try {
    payload = JSON.parse(await file.text());
  } catch {
    updateStatus("JSON 파일을 읽지 못했습니다. 파일 형식을 확인하세요.");
    return;
  }

  const importedThresholds = resolveImportedThresholdTree(payload);
  const lessonKeys = Object.keys(importedThresholds);
  if (lessonKeys.length === 0) {
    updateStatus("가져올 Thresholds 값이 JSON 안에 없습니다.");
    return;
  }

  const currentAllThresholds =
    typeof api.getAllThresholds === "function"
      ? api.getAllThresholds()
      : {};
  const nextThresholds = { ...currentAllThresholds };

  lessonKeys.forEach((lessonKey) => {
    nextThresholds[lessonKey] = {
      ...(nextThresholds[lessonKey] || {}),
      ...importedThresholds[lessonKey],
    };
  });

  api.saveThresholds({
    version: 1,
    thresholds: nextThresholds,
  });

  const targetLessonKey = String(payload?.lessonKey || lessonKeys[0] || state.lessonKey).trim();
  if (targetLessonKey) {
    setLesson(targetLessonKey);
  } else {
    renderThresholdInputs(state.lessonKey);
    renderDefaultPoseGuide(state.lessonKey);
    renderLogSummary(state.lessonKey);
    showRecommendations();
  }

  updateStatus(`${lessonKeys.join(", ")} Thresholds를 JSON에서 가져왔습니다.`);
}

function setLesson(lessonKey) {
  cancelSampleCapture("레슨이 변경되어 자동 저장이 취소되었습니다.");
  resetThresholdSummaryHistory();
  const normalizedLessonKey =
    lessonKey === "basic-guard" || lessonKey === "real-fight-guard"
      ? "beginner-basic-guard"
      : lessonKey;
  state.lessonKey = normalizedLessonKey;
  if (state.ui.lessonSelect) {
    state.ui.lessonSelect.value = normalizedLessonKey;
  }
  state.currentResult = null;
  state.latestLandmarks = null;
  state.selectedLogId = "";
  state.compareMode = false;
  updateLessonBadge(normalizedLessonKey);
  try {
    globalScope.sessionStorage.setItem(TRAINING_LESSON_KEY, normalizedLessonKey);
  } catch {
    // ignore session storage failures
  }

  const analyzer = getAnalyzer();
  if (analyzer && typeof analyzer.setLessonKey === "function") {
    analyzer.setLessonKey(normalizedLessonKey);
  }
  if (analyzer && typeof analyzer.reset === "function") {
    analyzer.reset();
    if (typeof analyzer.setLessonKey === "function") {
      analyzer.setLessonKey(normalizedLessonKey);
    }
  }

  renderThresholdInputs(normalizedLessonKey);
  renderDefaultPoseGuide(normalizedLessonKey);
  renderLogSummary(normalizedLessonKey);
  showRecommendations();
  showFallbackDummy("lesson changed");
}

function bindLessonSelect() {
  if (!state.ui.lessonSelect) {
    return;
  }

  state.ui.lessonSelect.addEventListener("change", (event) => {
    const nextKey = event.target.value || "beginner-basic-guard";
    setLesson(nextKey);
  });
}

function bindUploadInput() {
  if (!state.ui.uploadInput) {
    return;
  }

  state.ui.uploadInput.addEventListener("change", async (event) => {
    const file = event.target.files?.[0] || null;
    if (!file) {
      return;
    }

    await handleUploadFile(file);
  });
}

function bindClipInputs() {
  queryAll("[data-cal-time]").forEach((input) => {
    input.addEventListener("blur", () => {
      const key = input.dataset.calTime || "";
      if (key.endsWith("-min")) {
        input.value = `${Math.max(0, Math.floor(toNumber(input.value, 0)))}`;
      } else {
        input.value = formatSeconds(Math.max(0, toNumber(input.value, 0)));
      }

      state.clip.startSec = readClipStartSec();
      state.clip.endSec = readClipEndSec();
      state.clip.jpegStartSec = readJpegStartSec();
      state.clip.jpegEndSec = readJpegEndSec();
    });
  });
}

function bindPlaybackControls() {
  if (state.ui.playbackRate) {
    state.ui.playbackRate.addEventListener("change", (event) => {
      setPlaybackRate(event.target.value);
    });
  }
}

function bindCalibrationImportInput() {
  if (!state.ui.importInput) {
    return;
  }

  state.ui.importInput.addEventListener("change", async (event) => {
    const file = event.target.files?.[0] || null;
    if (!file) {
      return;
    }

    try {
      await importCalibrationJson(file);
    } finally {
      event.target.value = "";
    }
  });
}

function bindModeButtons() {
  queryAll("[data-cal-mode-btn]").forEach((button) => {
    button.addEventListener("click", async () => {
      const mode = button.dataset.calModeBtn;
      if (!mode) {
        return;
      }

      if (mode === "webcam") {
        await startWebcamMode();
      } else {
        await startVideoMode(mode);
      }
    });
  });
}

function bindActionButtons() {
  queryAll("[data-cal-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.calAction;
      if (!action) {
        return;
      }

      switch (action) {
        case "sample-correct":
          armSampleCapture("correct");
          break;
        case "sample-incorrect":
          armSampleCapture("incorrect");
          break;
        case "apply-threshold":
          showRecommendations();
          break;
        case "pick-upload":
          openUploadPicker();
          break;
        case "clear-upload":
          cancelSampleCapture("업로드가 초기화되어 자동 저장이 취소되었습니다.");
          stopTracker();
          stopUploadSource();
          state.mode = DEFAULT_MODE;
          state.clip.startSec = 0;
          state.clip.endSec = 0;
          state.clip.jpegStartSec = 0;
          state.clip.jpegEndSec = 0;
          state.clip.createdUrl = "";
          state.clip.createdName = "";
          state.youtube.createdUrl = "";
          state.youtube.createdName = "";
          syncClipInputs();
          setClipDownload("", "");
          setYoutubeDownload("", "");
          updateClipStatus("영상 구간 없음");
          updateYoutubeStatus("YouTube 대기 중");
          stopAssetProgress("대기 중", 0);
          updateModeChips(DEFAULT_MODE);
          updateStatus("업로드를 초기화했습니다.");
          renderAnalysisResult(null);
          setPlaceholderMessage("Webcam / Video Preview", "웹캠, 업로드 파일, 또는 sample video를 선택하면 자세를 분석할 수 있습니다.");
          break;
        case "set-clip-start":
          setClipPoint("start");
          break;
        case "set-clip-end":
          setClipPoint("end");
          break;
        case "create-clip":
          createCalibrationClip();
          break;
        case "create-upload-jpegs":
          createUploadJpegs();
          break;
        case "create-youtube-mp4":
          createYoutubeMp4();
          break;
        case "create-youtube-jpegs":
          createYoutubeJpegs();
          break;
        case "video-play":
          playVideoFromCurrentTime();
          break;
        case "video-pause":
          pauseVideo();
          break;
        case "video-replay":
          replayVideo();
          break;
        case "reset-lesson":
          resetCurrentLessonThresholds();
          break;
        case "reset-thresholds":
          resetCurrentLessonThresholds();
          break;
        case "clear-current-logs":
          clearCurrentLessonLogs();
          break;
        case "clear-all-logs":
        case "reset-all":
          clearAllLogs();
          break;
        case "show-recommendations":
          showRecommendations();
          break;
        case "toggle-failure-lock":
          toggleFailureFeedbackLock();
          break;
        case "toggle-log-detail":
          toggleLogDetailVisibility();
          break;
        case "toggle-compare-view":
          toggleCompareView();
          break;
        case "toggle-log-sort":
          toggleLogSortOrder();
          break;
        case "log-prev":
          setSelectedLogByOffset(-1);
          break;
        case "log-next":
          setSelectedLogByOffset(1);
          break;
        case "delete-selected-log":
          if (state.selectedLogId) {
            deleteAccuracyLogSample(state.selectedLogId);
          }
          break;
        case "save-thresholds":
          saveThresholdInputs();
          break;
        case "export-json":
          exportCalibrationBundle();
          break;
        case "import-json":
          openCalibrationImportPicker();
          break;
        case "open-training":
          cancelSampleCapture("훈련 화면으로 이동하여 자동 저장이 취소되었습니다.");
          stopTracker();
          stopWebcamStream();
          stopUploadSource();
          state.mode = DEFAULT_MODE;
          updateModeChips(DEFAULT_MODE);
          window.location.href = `./training_session.html?lesson_key=${encodeURIComponent(state.lessonKey)}`;
          break;
        default:
          break;
      }
    });
  });

  queryAll("[data-cal-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      const filterKey = button.dataset.calFilter || "all";
      setLogFilter(filterKey);
    });
  });

  document.addEventListener("click", (event) => {
    const button = event.target.closest?.("[data-cal-apply-key]");
    if (!button) {
      return;
    }

    const key = button.dataset.calApplyKey;
    const value = button.dataset.calApplyValue;
    applyRecommendation(key, value);
  });

  document.addEventListener("click", (event) => {
    const button = event.target.closest?.("[data-cal-focus-threshold]");
    if (!button) {
      return;
    }

    focusThresholdInput(button.dataset.calFocusThreshold || "");
  });
}

function updateVideoStatus() {
  const label = state.mode === "webcam" ? "webcam ready" : `${state.mode} mode`;
  updateStatus(label);
  updateModeChips(state.mode);
}

function setPlaybackRate(value) {
  const video = state.ui.video;
  if (!video) {
    return;
  }
  const rate = clamp(toNumber(value, 1), 0.25, 2);
  video.playbackRate = rate;
  updateStatus(`재생속도 ${rate}x`);
}

async function playVideoFromCurrentTime() {
  const video = state.ui.video;
  if (!video || (!video.src && !video.srcObject)) {
    updateStatus("재생할 영상이 없습니다.");
    return false;
  }
  try {
    await video.play();
    updateStatus("영상 재생 중");
    return true;
  } catch {
    updateStatus("영상을 재생하지 못했습니다.");
    return false;
  }
}

function pauseVideo() {
  const video = state.ui.video;
  if (!video) {
    return;
  }
  video.pause();
  updateStatus("영상 일시정지");
}

async function replayVideo() {
  const video = state.ui.video;
  if (!video || (!video.src && !video.srcObject)) {
    updateStatus("다시 재생할 영상이 없습니다.");
    return false;
  }
  try {
    video.currentTime = 0;
  } catch {
    // live streams may not support seeking
  }
  return playVideoFromCurrentTime();
}

function initDom() {
  state.ui = {
    video: query("[data-cal-video]"),
    overlay: query("[data-cal-overlay]"),
    debugOverlay: query("[data-cal-debug-overlay]"),
    placeholder: query("[data-cal-placeholder]"),
    lessonSelect: query("[data-cal-lesson-select]"),
    uploadInput: query("[data-cal-upload-input]"),
    importInput: query("[data-cal-import-input]"),
    playbackRate: query("[data-cal-playback-rate]"),
  };
}

async function initCalibrationPage() {
  initDom();

  if (!state.ui.video || !state.ui.overlay || !state.ui.lessonSelect) {
    console.warn("Calibration page UI not ready.");
    return;
  }

  const lessonFromSession = (() => {
    try {
      return globalScope.sessionStorage.getItem(TRAINING_LESSON_KEY) || "beginner-basic-guard";
    } catch {
      return "beginner-basic-guard";
    }
  })();

  const startupParams = new URLSearchParams(globalScope.location?.search || "");
  const lessonFromQuery = startupParams.get("lesson") || startupParams.get("lessonKey") || "";
  const initialLesson = lessonFromQuery || lessonFromSession;

  state.ui.lessonSelect.value = initialLesson;
  setLesson(initialLesson);
  state.logFilter = "all";
  state.logSortOrder = "newest";
  state.logDetailOpen = false;
  state.compareMode = false;
  updateLogFilterButtons();
  updateDetailToggleButton();
  updateSortToggleButton();
  updateModeChips(DEFAULT_MODE);
  updateVideoStatus();

  bindLessonSelect();
  bindUploadInput();
  bindClipInputs();
  bindPlaybackControls();
  bindCalibrationImportInput();
  bindModeButtons();
  bindActionButtons();
  renderSampleCaptureUi();

  const overlay = getOverlay();
  if (overlay && typeof overlay.clear === "function") {
    overlay.clear(state.ui.overlay);
    overlay.clear(state.ui.debugOverlay);
  }

  state.running = true;
  state.lastAnalysisAt = 0;
  const startupImageUrl = startupParams.get("imageUrl") || "";
  const shouldAutoStartWebcam = startupParams.get("autostart") === "webcam";
  if (startupImageUrl) {
    await handleUploadUrl(startupImageUrl);
  } else if (shouldAutoStartWebcam) {
    await startWebcamMode();
  } else {
    state.mode = "idle";
    updateModeChips("idle");
    updateStatus("input mode를 선택해 주세요.");
    updateSourceStatus("source: idle");
    setPlaceholderMessage(
      "Input mode 선택",
      "webcam을 누르거나 사진/영상/YouTube 소스를 불러오면 분석을 시작합니다.",
    );
  }
  stopAnalysisLoop();
  state.analysisLoopId = requestAnimationFrame(analyzeCurrentFrame);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCalibrationPage, { once: true });
} else {
  initCalibrationPage();
}

globalScope.IM_BOXER_CALIBRATION = {
  initCalibrationPage,
  bindLessonSelect,
  bindModeButtons,
  startWebcamMode,
  startVideoMode,
  createCalibrationClip,
  createUploadJpegs,
  createYoutubeMp4,
  createYoutubeJpeg,
  createYoutubeJpegs,
  handlePoseFrame,
  renderAnalysisResult,
  renderFeatures,
  renderThresholdInputs,
  renderLogSummary,
  saveCurrentSample,
  showRecommendations,
  applyRecommendation,
  resetCurrentLessonThresholds,
  clearCurrentLessonLogs,
};





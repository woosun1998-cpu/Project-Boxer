import { hydratePage } from "../core/ui.js";
import { authFetch } from "../core/auth.js";

const RESULT_STORAGE_KEYS = [
  "im_boxer_sparring_last_result",
];
const TRAINING_RESULT_KEY = "im_boxer_training_last_result";
const SPARRING_PENDING_SAVE_KEY = "im_boxer_sparring_pending_save";

const TRAINING_ANALYSIS_VIDEO_MAP = {
  "basic-guard": "/assets/images/result/analysis_1.mp4",
  "beginner-basic-guard": "/assets/images/result/analysis_1.mp4",
  jab: "/assets/images/result/analysis_2.mp4",
  cross: "/assets/images/result/analysis_3.mp4",
  "left-hook": "/assets/images/result/analysis_4.mp4",
  slip: "/assets/images/result/analysis_5.mp4",
  uppercut: "/assets/images/result/analysis_6.mp4",
  default: "/assets/images/result/analysis_7.mp4",
};

const SPARRING_ANALYSIS_VIDEO_MAP = {
  beginner: "/assets/videos/sparring/sparring_result_1.mp4",
  intermediate: "/assets/videos/sparring/sparring_result_1.mp4",
  advanced: "/assets/videos/sparring/sparring_result_1.mp4",
  pro: "/assets/videos/sparring/sparring_result_1.mp4",
  default: "/assets/videos/sparring/sparring_result_1.mp4",
};

function pickFirst(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return null;
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function safeJsonParse(raw) {
  if (typeof raw !== "string" || !raw.trim()) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function readStoredResult() {
  for (const key of RESULT_STORAGE_KEYS) {
    try {
      const parsed = safeJsonParse(window.localStorage.getItem(key));
      if (parsed) {
        return parsed;
      }
    } catch {
      // try next key
    }
  }
  return null;
}

function buildSparringSavePayload(result) {
  if (!result || typeof result !== "object") {
    return null;
  }

  const source = result.raw && typeof result.raw === "object" ? result.raw : result;
  return {
    mode: source.mode || result.mode || "beginner",
    sessionId: source.sessionId || source.session_id || null,
    score: toNumber(source.score || result.score, 0),
    maxCombo: toNumber(source.maxCombo || source.max_combo || result.maxCombo || result.combo, 0),
    hitCount: toNumber(source.hitCount || source.hit_count || result.hitCount, 0),
    dodgeCount: toNumber(source.dodgeCount || source.dodge_count || result.dodgeCount, 0),
    perfectCount: toNumber(source.perfectCount || source.perfect_count || result.perfectCount, 0),
    playerHp: toNumber(source.playerHp || source.player_hp || result.playerHp || result.hp, 0),
    opponentHp: toNumber(source.opponentHp || source.opponent_hp || result.opponentHp, 0),
    accuracy: toNumber(source.accuracy || result.accuracy, 0),
    dodgeSuccessRate: toNumber(source.dodgeSuccessRate || source.dodge_success_rate || result.dodgeSuccessRate, 0),
    averageReactionMs: toNumber(source.averageReactionMs || source.average_reaction_ms || result.averageReactionMs, 0),
    grade: source.grade || result.grade || null,
    coachComment: source.coachComment || source.coach_comment || result.coachMessage || "",
    durationSec: toNumber(source.durationSec || source.duration_sec || 0, 0),
    endedAt: source.endedAt || source.ended_at || new Date().toISOString(),
  };
}

async function retryPendingSparringSave(result) {
  if (!result || result.gameType !== "sparring") {
    return;
  }

  const source = result.raw && typeof result.raw === "object" ? result.raw : {};
  if (source.serverResult) {
    window.localStorage.removeItem(SPARRING_PENDING_SAVE_KEY);
    return;
  }

  const pending = safeJsonParse(window.localStorage.getItem(SPARRING_PENDING_SAVE_KEY)) || source;
  const pendingAgeMs = Date.now() - new Date(pending.saveAttemptedAt || 0).getTime();
  if (pending.saveStatus === "pending" && Number.isFinite(pendingAgeMs) && pendingAgeMs < 10000) {
    return;
  }
  const payload = buildSparringSavePayload({ ...result, raw: { ...source, ...pending } });
  if (!payload || payload.score <= 0) {
    return;
  }

  try {
    const response = await authFetch("/api/sparring/end", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      window.localStorage.setItem(SPARRING_PENDING_SAVE_KEY, JSON.stringify({
        ...pending,
        saveStatus: response.status === 401 || response.status === 403 ? "auth_required" : "failed",
        saveHttpStatus: response.status,
        saveAttemptedAt: new Date().toISOString(),
      }));
      return;
    }

    const serverResult = await response.json().catch(() => null);
    if (!serverResult) {
      return;
    }

    const merged = {
      ...source,
      serverResult,
      saveStatus: "saved",
    };
    window.localStorage.setItem("im_boxer_sparring_last_result", JSON.stringify(merged));
    window.localStorage.removeItem(SPARRING_PENDING_SAVE_KEY);
  } catch (error) {
    window.localStorage.setItem(SPARRING_PENDING_SAVE_KEY, JSON.stringify({
      ...pending,
      saveStatus: "failed",
      saveError: String(error?.message || error),
      saveAttemptedAt: new Date().toISOString(),
    }));
  }
}

function getResultTimestamp(result) {
  const raw = result?.endedAt || result?.serverResult?.createdAt || result?.createdAt || result?.startedAt || "";
  const time = new Date(raw).getTime();
  return Number.isFinite(time) ? time : 0;
}

function redirectTrainingResultIfNeeded() {
  const params = new URLSearchParams(window.location.search);
  if (params.has("mode")) {
    return false;
  }

  const training = safeJsonParse(window.localStorage.getItem(TRAINING_RESULT_KEY));
  if (!training) {
    return false;
  }

  const sparring = safeJsonParse(window.localStorage.getItem("im_boxer_sparring_last_result"));
  if (!sparring || getResultTimestamp(training) >= getResultTimestamp(sparring)) {
    window.location.replace("./training_result.html");
    return true;
  }

  return false;
}

function normalizeFeedbackList(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (typeof item === "string") {
        return item.trim();
      }

      if (item && typeof item === "object") {
        return String(item.message || item.text || item.label || "").trim();
      }

      return "";
    })
    .filter(Boolean);
}

function calculateGrade(score, accuracy) {
  const basis = accuracy > 0 ? accuracy : clamp(score > 100 ? score / 10 : score, 0, 100);

  if (basis >= 90) return "S";
  if (basis >= 80) return "A";
  if (basis >= 70) return "B";
  if (basis >= 60) return "C";
  return "D";
}

function normalizeTrainingKey(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) {
    return "";
  }

  if (text.includes("basic-guard") || text.includes("beginner-basic-guard") || text.includes("가드")) {
    return "basic-guard";
  }
  if (text.includes("jab") || text.includes("잽")) {
    return "jab";
  }
  if (text.includes("cross") || text.includes("크로스")) {
    return "cross";
  }
  if (text.includes("left-hook") || text.includes("left hook") || text.includes("레프트") || text.includes("왼훅")) {
    return "left-hook";
  }
  if (text.includes("slip") || text.includes("슬립")) {
    return "slip";
  }
  if (text.includes("uppercut") || text.includes("어퍼컷")) {
    return "uppercut";
  }

  return "";
}

function mapTrainingResult(raw) {
  const metrics = raw?.metrics && typeof raw.metrics === "object" ? raw.metrics : {};
  const score = toNumber(pickFirst(raw?.score, raw?.totalScore, metrics.score, metrics.totalScore), 0);
  const accuracy = toNumber(pickFirst(raw?.accuracy, metrics.accuracy), 0);
  const hp = toNumber(pickFirst(raw?.hp, metrics.hp), 0);
  const combo = toNumber(pickFirst(raw?.combo, raw?.bestCombo, metrics.combo, metrics.bestCombo), 0);
  const roundsTotal = toNumber(pickFirst(raw?.roundsTotal, raw?.totalRounds, metrics.roundsTotal, metrics.totalRounds), 0);
  const round = toNumber(pickFirst(raw?.round, raw?.currentRound, metrics.round, metrics.currentRound), 0);
  const lessonKey = String(pickFirst(raw?.lessonKey, raw?.lesson_key) || "").trim();
  const lessonTitle = String(pickFirst(raw?.lessonTitle, raw?.title) || "").trim();
  const lessonGoal = String(pickFirst(raw?.lessonGoal, raw?.lessonSummary) || "").trim();
  const coachMessage = String(pickFirst(raw?.coachMessage, raw?.message, metrics.message) || "").trim();
  const feedback = normalizeFeedbackList(pickFirst(raw?.feedbackItems, raw?.feedback, metrics.feedbackItems, metrics.feedback));

  return {
    raw,
    gameType: "training",
    mode: String(pickFirst(raw?.mode, metrics.mode) || "").trim(),
    score,
    accuracy,
    hp,
    combo,
    roundsTotal,
    round,
    lessonKey,
    lessonTitle,
    lessonGoal,
    coachMessage,
    feedback,
    trainingState: String(pickFirst(raw?.state, raw?.trainingState, raw?.status, metrics.state) || "").trim(),
    metrics,
  };
}

function buildSparringMetrics(result) {
  const score = toNumber(result?.score, 0);
  const accuracy = toNumber(result?.accuracy, 0);
  const hp = toNumber(result?.playerHp, 0);
  const combo = toNumber(result?.maxCombo, 0);
  const dodgeSuccessRate = toNumber(result?.dodgeSuccessRate, 0);
  const averageReactionMs = toNumber(result?.averageReactionMs, 0);
  const opponentHp = toNumber(result?.opponentHp, 0);

  const reactionScore = clamp(100 - averageReactionMs / 12, 0, 100);
  const comboScore = clamp(combo * 12, 0, 100);

  return {
    score,
    hp,
    accuracy,
    postureScore: clamp(accuracy, 0, 100),
    guardScore: clamp(Math.max(accuracy * 0.6, dodgeSuccessRate), 0, 100),
    balanceScore: clamp((hp + dodgeSuccessRate) / 2, 0, 100),
    reactionScore,
    consistencyScore: comboScore,
    speedScore: clamp(100 - averageReactionMs / 14, 0, 100),
    powerScore: clamp((100 - opponentHp) * 1.2, 0, 100),
    recoveryScore: clamp(hp, 0, 100),
    tipLevel: score >= 90 ? "excellent" : score >= 75 ? "good" : score >= 55 ? "warning" : "critical",
    trend: result?.winner === "player" ? "up" : result?.winner === "ai" ? "down" : "flat",
    analysisLabel: `SPARRING ${String(result?.modeLabel || result?.mode || "RESULT").toUpperCase()}`,
    mode: String(result?.mode || "").trim(),
  };
}

function normalizeSparringResult(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const serverResult = raw.serverResult && typeof raw.serverResult === "object" ? raw.serverResult : {};
  const source = { ...raw, ...serverResult };
  const mode = String(pickFirst(source.mode, source.trainingMode, source.state) || "beginner").trim();
  const modeLabel = String(pickFirst(raw.modeLabel, mode.toUpperCase()) || mode.toUpperCase()).trim();
  const score = toNumber(pickFirst(source.score, source.totalScore), 0);
  const accuracy = toNumber(pickFirst(source.accuracy), 0);
  const hp = toNumber(pickFirst(source.playerHp, source.player_hp, source.hp), 0);
  const combo = toNumber(pickFirst(source.maxCombo, source.max_combo, source.combo), 0);
  const roundsTotal = toNumber(pickFirst(source.roundsTotal, source.totalRounds), 0);
  const round = toNumber(pickFirst(source.round, source.currentRound), 0);
  const coachMessage = String(pickFirst(source.coachComment, source.coach_comment, source.coachMessage, source.message) || "").trim();
  const grade = String(pickFirst(source.grade, calculateGrade(score, accuracy)) || "D").trim();
  const feedback = normalizeFeedbackList([
    coachMessage || `${modeLabel} 스파링 결과입니다.`,
    `최고 콤보 ${combo}x`,
    `정확도 ${Math.round(accuracy)}%`,
  ]);
  const mergedRaw = { ...raw, serverResult };

  return {
    raw: mergedRaw,
    gameType: "sparring",
    mode,
    modeLabel,
    score,
    accuracy,
    hp,
    combo,
    roundsTotal,
    round,
    lessonKey: mode,
    lessonTitle: `${modeLabel} SPARRING`,
    lessonGoal: coachMessage || `${modeLabel} 모드 스파링 결과입니다.`,
    coachMessage: coachMessage || `${modeLabel} 모드 스파링을 완료했습니다.`,
    feedback,
    trainingState: "SPARRING",
    grade,
    winner: String(pickFirst(raw.winner, source.winner, "") || "").trim(),
    reason: String(pickFirst(raw.reason, source.reason, "") || "").trim(),
    maxCombo: toNumber(pickFirst(source.maxCombo, source.max_combo), combo),
    hitCount: toNumber(pickFirst(source.hitCount, source.hit_count), 0),
    dodgeCount: toNumber(pickFirst(source.dodgeCount, source.dodge_count), 0),
    perfectCount: toNumber(pickFirst(source.perfectCount, source.perfect_count), 0),
    playerHp: hp,
    opponentHp: toNumber(pickFirst(source.opponentHp, source.opponent_hp), 0),
    dodgeSuccessRate: toNumber(pickFirst(source.dodgeSuccessRate, source.dodge_success_rate), 0),
    averageReactionMs: toNumber(pickFirst(source.averageReactionMs, source.average_reaction_ms), 0),
    modeBadge: modeLabel,
    metrics: buildSparringMetrics({ ...source, winner: raw.winner || source.winner }),
  };
}

function normalizeResult(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const gameType = String(pickFirst(raw.gameType, raw.type, raw.resultType) || "").trim().toLowerCase();
  if (gameType === "sparring" || ("mode" in raw && "maxCombo" in raw)) {
    return normalizeSparringResult(raw);
  }

  return mapTrainingResult(raw);
}

function resolveAnalysisVideoSource(result) {
  if (!result) {
    return TRAINING_ANALYSIS_VIDEO_MAP.default;
  }

  if (result.gameType === "sparring") {
    const key = String(result.mode || "").trim().toLowerCase();
    return SPARRING_ANALYSIS_VIDEO_MAP[key] || SPARRING_ANALYSIS_VIDEO_MAP.default;
  }

  const candidates = [
    result.lessonKey,
    result.lessonTitle,
    result.lessonGoal,
    result.metrics?.analysisLabel,
    result.raw?.analysisLabel,
    result.raw?.lessonKey,
  ];

  for (const candidate of candidates) {
    const text = normalizeTrainingKey(candidate);
    if (text && TRAINING_ANALYSIS_VIDEO_MAP[text]) {
      return TRAINING_ANALYSIS_VIDEO_MAP[text];
    }
  }

  return TRAINING_ANALYSIS_VIDEO_MAP.default;
}

function resolveGrade(result) {
  if (!result) {
    return "D";
  }

  if (result.gameType === "sparring" && result.grade) {
    return result.grade;
  }

  return calculateGrade(result.score, result.accuracy);
}

function resolveTheme(result) {
  const tipLevel = result?.metrics?.tipLevel || (result?.gameType === "sparring" ? "good" : "good");
  const trend = result?.metrics?.trend || (result?.gameType === "sparring" && result.winner === "player" ? "up" : "flat");

  return { tipLevel, trend };
}

function applyResultTheme(metrics) {
  const slot = document.querySelector("[data-api-result-slot]");
  if (!slot) {
    return;
  }

  const tipLevel = String(metrics?.tipLevel || "good").trim().toLowerCase();
  const trend = String(metrics?.trend || "flat").trim().toLowerCase();

  slot.dataset.tipLevel = tipLevel;
  slot.dataset.trend = trend;

  const toneMap = {
    excellent: "61, 180, 120",
    good: "255, 154, 61",
    warning: "255, 205, 86",
    critical: "255, 99, 99",
  };

  slot.style.setProperty("--result-tone-rgb", toneMap[tipLevel] || toneMap.good);
}

function resetResultTheme() {
  const slot = document.querySelector("[data-api-result-slot]");
  if (!slot) {
    return;
  }

  slot.dataset.tipLevel = "good";
  slot.dataset.trend = "flat";
  slot.style.setProperty("--result-tone-rgb", "255, 154, 61");
}

function setText(target, value) {
  if (!target) {
    return;
  }

  target.textContent = String(value ?? "");
}

function setList(target, items) {
  if (!target) {
    return;
  }

  target.innerHTML = "";
  const list = Array.isArray(items) ? items : [];

  if (!list.length) {
    const li = document.createElement("li");
    li.textContent = "데이터가 없습니다.";
    target.appendChild(li);
    return;
  }

  list.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    target.appendChild(li);
  });
}

function setMetricValue(selector, value, suffix = "%") {
  const target = document.querySelector(selector);
  if (!target) {
    return;
  }

  const display = typeof value === "number" ? `${Math.round(value)}${suffix}` : String(value ?? "");
  target.textContent = display;
}

function setMetricBar(selector, value) {
  const target = document.querySelector(selector);
  if (!target) {
    return;
  }

  target.style.width = `${clamp(toNumber(value, 0), 0, 100)}%`;
}

function setAnalysisVideoSource(result) {
  const video = document.querySelector("[data-result-analysis-video]");
  if (!video) {
    return;
  }

  const source = resolveAnalysisVideoSource(result);
  if (!source) {
    return;
  }

  if (video.getAttribute("src") !== source) {
    video.setAttribute("src", source);
    if (typeof video.load === "function") {
      video.load();
    }
  }
}

function applyMetricCards(result) {
  const metrics = result?.gameType === "sparring" ? result.metrics : result?.metrics || {};

  const config = [
    { selector: "[data-result-posture-score]", bar: "[data-result-posture-bar]", value: metrics.postureScore ?? toNumber(metrics.accuracy, 0) },
    { selector: "[data-result-guard-score]", bar: "[data-result-guard-bar]", value: metrics.guardScore ?? toNumber(metrics.hp, 0) },
    { selector: "[data-result-balance-score]", bar: "[data-result-balance-bar]", value: metrics.balanceScore ?? toNumber(metrics.combo, 0) * 10 },
    { selector: "[data-result-reaction-score]", bar: "[data-result-reaction-bar]", value: metrics.reactionScore ?? 0 },
    { selector: "[data-result-consistency-score]", bar: "[data-result-consistency-bar]", value: metrics.consistencyScore ?? 0 },
    { selector: "[data-result-speed-score]", bar: "[data-result-speed-bar]", value: metrics.speedScore ?? 0 },
    { selector: "[data-result-power-score]", bar: "[data-result-power-bar]", value: metrics.powerScore ?? 0 },
    { selector: "[data-result-recovery-score]", bar: "[data-result-recovery-bar]", value: metrics.recoveryScore ?? 0 },
  ];

  config.forEach((item) => {
    setMetricValue(item.selector, item.value);
    setMetricBar(item.bar, item.value);
  });

  setMetricBar("[data-bar-fill-accuracy]", toNumber(metrics.accuracy, 0));
  setMetricBar("[data-bar-fill-hp]", toNumber(metrics.hp, 0));
  setText(document.querySelector("[data-result-analysis-label]"), metrics.analysisLabel || "기술 분석");
  setText(document.querySelector("[data-result-tip-level]"), String(metrics.tipLevel || "good").toUpperCase());
  setText(document.querySelector("[data-result-trend]"), String(metrics.trend || "flat").toUpperCase());
}

function toggleVisibility(target, visible) {
  if (!target) {
    return;
  }

  target.hidden = !visible;
  target.style.display = visible ? "" : "none";
}

function resolveHomePath() {
  return "/sparring.html";
}

function bindResultButtons(result) {
  const isSparring = result?.gameType === "sparring";
  const retryHref = isSparring
    ? `./sparring_start.html?mode=${encodeURIComponent(result.mode || "beginner")}`
    : result?.lessonKey
      ? `./training_session.html?lesson_key=${encodeURIComponent(result.lessonKey)}`
      : "./training.html";
  const secondaryHref = isSparring ? "" : "/tutorial-new.html";
  const homeHref = resolveHomePath();

  const retryButton = document.querySelector("[data-result-retry-button]");
  const tutorialButton = document.querySelector("[data-result-tutorial-button]");
  const homeButton = document.querySelector("[data-result-home-button]");

  if (retryButton) {
    retryButton.disabled = !result;
    retryButton.setAttribute("aria-disabled", String(!result));
    retryButton.addEventListener("click", () => {
      if (!result) {
        return;
      }
      window.location.href = retryHref;
    });
    retryButton.textContent = isSparring ? "다시 스파링" : "다시 훈련하기";
  }

  if (tutorialButton) {
    tutorialButton.hidden = isSparring;
    tutorialButton.style.display = isSparring ? "none" : "";
    tutorialButton.textContent = isSparring ? "" : "튜토리얼 목록";
    tutorialButton.addEventListener("click", () => {
      if (!secondaryHref) {
        return;
      }
      window.location.href = secondaryHref;
    });
  }

  if (homeButton) {
    homeButton.addEventListener("click", () => {
      window.location.href = homeHref;
    });
  }

  return { retryHref, secondaryHref, homeHref };
}

function renderResult(result) {
  const content = document.querySelector("[data-result-content]");
  const empty = document.querySelector("[data-result-empty]");
  const slot = document.querySelector("[data-api-result-slot]");

  const hasResult = Boolean(result);
  toggleVisibility(content, hasResult);
  toggleVisibility(empty, !hasResult);

  if (!hasResult) {
    resetResultTheme();
    if (empty) {
      setText(empty, "저장된 결과가 없습니다. 먼저 훈련이나 스파링을 진행해 주세요.");
    } else if (slot) {
      slot.textContent = "저장된 결과가 없습니다. 먼저 훈련이나 스파링을 진행해 주세요.";
    }
    return;
  }

  const score = toNumber(result.score, 0);
  const displayScore = clamp(Math.round(score), 0, 100);
  const accuracy = toNumber(result.accuracy, 0);
  const hp = toNumber(result.gameType === "sparring" ? result.hp : result.hp, 0);
  const combo = toNumber(result.combo, 0);
  const roundsLabel = result.roundsTotal > 0
    ? `${result.round}/${result.roundsTotal}`
    : result.round > 0
      ? String(result.round)
      : "0";
  const stateLabel = result.gameType === "sparring"
    ? `${String(result.modeLabel || result.mode || "SPARRING").toUpperCase()}`
    : result.trainingState || result.mode || "training";
  const lessonTitle = result.lessonTitle || (result.gameType === "sparring" ? `${String(result.modeLabel || result.mode || "SPARRING").toUpperCase()} SPARRING` : "기본 가드");
  const lessonKey = result.lessonKey || (result.gameType === "sparring" ? result.mode : "");
  const lessonGoal = result.lessonGoal || (result.gameType === "sparring" ? "스파링 결과를 확인해 보세요." : "레슨 목표가 표시됩니다.");
  const coachMessage = result.coachMessage || "코치 메시지가 없습니다.";
  const feedback = result.feedback?.length ? result.feedback : [coachMessage].filter(Boolean);
  const grade = resolveGrade(result);
  const theme = resolveTheme(result);

  setText(document.querySelector("[data-result-score]"), displayScore);
  setText(document.querySelector("[data-result-grade]"), grade);
  setText(document.querySelector("[data-result-accuracy]"), `${Math.round(accuracy)}%`);
  setText(document.querySelector("[data-result-hp]"), `${Math.round(hp)}%`);
  setText(document.querySelector("[data-result-combo]"), `${Math.round(combo)}x`);
  setText(document.querySelector("[data-result-rounds]"), roundsLabel);
  setText(document.querySelector("[data-result-state]"), stateLabel);
  setText(document.querySelector("[data-result-lesson-title]"), lessonTitle);
  setText(document.querySelector("[data-result-lesson-key]"), lessonKey || "-");
  setText(document.querySelector("[data-result-lesson-goal]"), lessonGoal);
  setText(document.querySelector("[data-result-coach-message]"), coachMessage);
  setList(document.querySelector("[data-result-feedback-list]"), feedback);
  applyMetricCards(result);
  setAnalysisVideoSource(result);
  applyResultTheme({ ...theme, analysisLabel: result.metrics?.analysisLabel || "기술 분석" });

  if (content && slot && content !== slot) {
    content.dataset.resultState = "loaded";
  }

  if (slot) {
    slot.dataset.apiState = "loaded";
    slot.textContent = "";
    if (content) {
      slot.appendChild(content);
    }
  }
}

async function hydrateResultPage() {
  const stored = normalizeResult(readStoredResult());
  renderResult(stored);
  bindResultButtons(stored);
  await retryPendingSparringSave(stored);
}

document.addEventListener("DOMContentLoaded", () => {
  if (redirectTrainingResultIfNeeded()) {
    return;
  }

  hydratePage({
    requiresAuth: false,
    overrides: {
      summary: "리더보드",
      message: "스파링과 훈련 결과를 한눈에 확인하세요.",
      tierText: "스파링 기록과 훈련 기록을 함께 볼 수 있습니다.",
    },
  }).catch(() => {
    // Guest mode is allowed in the woosunshin integration.
  });

  hydrateResultPage();
});

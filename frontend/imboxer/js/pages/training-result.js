import { hydratePage } from "../core/ui.js";

const STORAGE_KEY = "im_boxer_training_last_result";

const ANALYSIS_VIDEO_MAP = {
  "basic-guard": "/assets/images/result/analysis_1.mp4",
  "beginner-basic-guard": "/assets/images/result/analysis_1.mp4",
  jab: "/assets/images/result/analysis_2.mp4",
  cross: "/assets/images/result/analysis_3.mp4",
  "left-hook": "/assets/images/result/analysis_4.mp4",
  slip: "/assets/images/result/analysis_5.mp4",
  uppercut: "/assets/images/result/analysis_6.mp4",
  default: "/assets/images/result/analysis_7.mp4",
};

function $(selector) {
  return document.querySelector(selector);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function pickFirst(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return null;
}

function setText(selector, value) {
  const element = $(selector);
  if (element) {
    element.textContent = String(value ?? "");
  }
}

function setBar(selector, value) {
  const element = $(selector);
  if (element) {
    element.style.width = `${clamp(toNumber(value, 0), 0, 100)}%`;
  }
}

function readResult() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function normalizeLessonKey(value) {
  const key = String(value || "").trim();
  if (key === "beginner-basic-guard") {
    return "basic-guard";
  }
  return key || "basic-guard";
}

function calculateGrade(score, accuracy) {
  if (score >= 900 || accuracy >= 92) return "S";
  if (score >= 800 || accuracy >= 82) return "A";
  if (score >= 700 || accuracy >= 72) return "B";
  if (score >= 600 || accuracy >= 60) return "C";
  return "D";
}

function normalizeResult(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const metrics = raw.metrics && typeof raw.metrics === "object" ? raw.metrics : {};
  const score = toNumber(pickFirst(raw.score, metrics.score), 0);
  const accuracy = toNumber(pickFirst(raw.accuracy, metrics.accuracy), 0);
  const hp = toNumber(pickFirst(raw.hp, metrics.hp), 0);
  const combo = toNumber(pickFirst(raw.combo, metrics.combo), 0);
  const lessonKey = normalizeLessonKey(pickFirst(raw.lessonKey, raw.lesson_key));

  return {
    score,
    displayScore: Math.round(score > 100 ? score / 10 : score),
    accuracy,
    hp,
    combo,
    lessonKey,
    lessonTitle: String(pickFirst(raw.lessonTitle, raw.title, "훈련 결과") || "훈련 결과"),
    lessonGoal: String(pickFirst(raw.lessonGoal, raw.goal, "자세 분석 결과를 확인하세요.") || "자세 분석 결과를 확인하세요."),
    coachMessage: String(pickFirst(raw.coachMessage, raw.message, "훈련이 완료되었습니다. 좋은 흐름을 이어가세요.") || ""),
    round: toNumber(pickFirst(raw.round, raw.roundsCompleted), 0),
    roundsTotal: toNumber(raw.roundsTotal, 0),
    elapsedMs: toNumber(raw.elapsedMs, 0),
    feedback: Array.isArray(raw.feedback) ? raw.feedback : [],
    metrics: {
      postureScore: toNumber(pickFirst(metrics.postureScore, accuracy), accuracy),
      guardScore: toNumber(pickFirst(metrics.guardScore, accuracy), accuracy),
      balanceScore: toNumber(pickFirst(metrics.balanceScore, accuracy), accuracy),
      reactionScore: toNumber(pickFirst(metrics.reactionScore, combo * 10), combo * 10),
      consistencyScore: toNumber(pickFirst(metrics.consistencyScore, accuracy), accuracy),
      speedScore: toNumber(pickFirst(metrics.speedScore, combo * 10), combo * 10),
      powerScore: toNumber(pickFirst(metrics.powerScore, hp), hp),
      recoveryScore: toNumber(pickFirst(metrics.recoveryScore, hp), hp),
    },
  };
}

function formatTime(ms) {
  const total = Math.max(0, Math.round(toNumber(ms, 0) / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function renderFeedback(items) {
  const target = $("[data-training-result-feedback]");
  if (!target) {
    return;
  }

  target.innerHTML = "";
  const list = items.length
    ? items
    : [{ message: "다음 훈련에서는 같은 자세를 한 번 더 반복해 안정성을 높여보세요." }];

  list.slice(0, 6).forEach((item) => {
    const li = document.createElement("li");
    li.textContent = typeof item === "string" ? item : item.message || "피드백을 확인하세요.";
    target.appendChild(li);
  });
}

function setAnalysisVideo(result) {
  const video = $("[data-training-result-video]");
  if (!video) {
    return;
  }

  const source = ANALYSIS_VIDEO_MAP[result.lessonKey] || ANALYSIS_VIDEO_MAP.default;
  video.src = source;
  video.onerror = () => {
    video.removeAttribute("src");
    const placeholder = $("[data-training-video-placeholder]");
    if (placeholder) {
      placeholder.dataset.visible = "";
    }
  };
}

function renderMetric(name, value) {
  setText(`[data-metric-value="${name}"]`, `${Math.round(clamp(value, 0, 100))}%`);
  setBar(`[data-metric-bar="${name}"]`, value);
}

function renderResult(result) {
  if (!result) {
    setText("[data-training-result-empty]", "저장된 훈련 결과가 없습니다. 먼저 훈련을 완료해 주세요.");
    const content = $("[data-training-result-content]");
    if (content) content.hidden = true;
    return;
  }

  const grade = calculateGrade(result.score, result.accuracy);
  setText("[data-training-result-score]", result.displayScore);
  setText("[data-training-result-grade]", grade);
  const gradeImg = $("[data-training-result-grade-img]");
  if (gradeImg) {
    gradeImg.src = `./assets/images/tutorials/grades/grade_${grade.toLowerCase()}.svg`;
    gradeImg.alt = `${grade}등급`;
  }
  setText("[data-training-result-accuracy]", `${Math.round(result.accuracy)}%`);
  setText("[data-training-result-hp]", `${Math.round(result.hp)}%`);
  setText("[data-training-result-combo]", `${Math.round(result.combo)}x`);
  setText("[data-training-result-round]", result.roundsTotal ? `${result.round}/${result.roundsTotal}` : String(result.round || "—"));
  setText("[data-training-result-time]", formatTime(result.elapsedMs));
  setText("[data-training-result-title]", result.lessonTitle);
  setText("[data-training-result-key]", result.lessonKey);
  setText("[data-training-result-goal]", result.lessonGoal);
  setText("[data-training-result-coach]", result.coachMessage);

  Object.entries(result.metrics).forEach(([key, value]) => renderMetric(key, value));
  setAnalysisVideo(result);
  renderFeedback(result.feedback);
}

function bindActions(result) {
  const retry = $("[data-training-result-retry]");
  const list = $("[data-training-result-list]");

  retry?.addEventListener("click", () => {
    const lessonKey = result?.lessonKey || "basic-guard";
    window.location.href = `./training_session.html?lesson_key=${encodeURIComponent(lessonKey)}`;
  });
  list?.addEventListener("click", () => {
    window.location.href = "/tutorial-new.html";
  });
}

document.addEventListener("DOMContentLoaded", () => {
  hydratePage({
    requiresAuth: false,
    overrides: {
      summary: "훈련 결과",
      message: "자세 분석 결과를 한눈에 확인하세요.",
      tierText: "훈련 리포트는 로컬 결과를 기준으로 표시됩니다.",
    },
  }).catch(() => {
    // Guest mode is allowed in the woosunshin integration.
  });

  const result = normalizeResult(readResult());
  renderResult(result);
  bindActions(result);
});

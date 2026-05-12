import { authFetch, clearSession, getStoredUser, refreshCurrentUser } from "../core/auth.js";

const TRAINING_LAST_RESULT_KEY = "im_boxer_training_last_result";
const SPARRING_LAST_RESULT_KEY = "im_boxer_sparring_last_result";

function redirectToLogin() {
  window.location.href = "/index.html";
}

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value;
}

function bindLogoutButtons() {
  document.querySelectorAll("[data-logout-button]").forEach((button) => {
    button.addEventListener("click", () => {
      clearSession();
      redirectToLogin();
    });
  });
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function pickFirst(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
}

function resolveUserName(user) {
  return String(pickFirst(user?.nickname, user?.username, user?.email, "BOXER"));
}

function resolveTierLabel(tier) {
  const value = String(tier || "free").trim();
  return value ? `${value} user` : "free user";
}

function readStoredJson(key) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function resultBelongsToUser(result, user) {
  const resultUserId = pickFirst(result?.userId, result?.user_id, result?.serverResult?.userId, result?.serverResult?.user_id);
  const userId = pickFirst(user?.id, user?.userId, user?.user_id);
  if (resultUserId == null || userId == null) return true;
  return String(resultUserId) === String(userId);
}

function getResultTimestamp(result) {
  const raw = pickFirst(
    result?.endedAt,
    result?.ended_at,
    result?.createdAt,
    result?.created_at,
    result?.serverResult?.createdAt,
    result?.serverResult?.created_at,
    result?.startedAt,
    result?.started_at,
  );
  const timestamp = raw ? new Date(raw).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

async function fetchLatestTrainingResult() {
  try {
    const response = await authFetch("/api/training-results/latest");
    if (response.status === 404) return null;
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function formatDisplayScore(value) {
  const score = Math.max(0, Math.min(1000, toNumber(value, 0)));
  return Math.round(score > 100 ? score / 10 : score);
}

function normalizeDashboardResult(result, type = "training") {
  if (!result || typeof result !== "object") {
    return null;
  }

  const serverResult = result.serverResult && typeof result.serverResult === "object" ? result.serverResult : {};
  const source = { ...result, ...serverResult };
  const metrics = source.metrics && typeof source.metrics === "object" ? source.metrics : {};
  const gameType = String(pickFirst(source.gameType, source.type, type) || type).toLowerCase();
  const isSparring = gameType === "sparring";

  return {
    raw: result,
    gameType,
    score: pickFirst(source.score, source.totalScore, metrics.score, metrics.totalScore),
    accuracy: pickFirst(source.accuracy, metrics.accuracy),
    combo: pickFirst(source.combo, source.maxCombo, source.max_combo, metrics.combo, metrics.maxCombo),
    lesson: isSparring
      ? `${String(pickFirst(source.modeLabel, source.mode, "SPARRING")).toUpperCase()} SPARRING`
      : pickFirst(source.lesson?.title, source.lessonTitle, source.lesson_title, source.title),
    timestamp: getResultTimestamp(source) || getResultTimestamp(result),
  };
}

function pickLatestResult(...results) {
  const list = results.filter(Boolean);
  if (!list.length) {
    return null;
  }
  return list.sort((a, b) => b.timestamp - a.timestamp)[0];
}

function renderLastResult(result) {
  const score = result?.score;
  const accuracy = result?.accuracy;
  const combo = result?.combo;
  const lesson = result?.lesson;
  const displayScore = score != null ? formatDisplayScore(score) : null;

  setText("#db-last-score", displayScore != null ? String(displayScore) : "0");
  setText("#db-last-accuracy", accuracy != null ? `${Math.round(accuracy)}%` : "0%");
  setText("#db-last-combo", combo != null ? `${Math.round(combo)}x` : "0x");

  const banner = document.getElementById("db-result-banner");
  if (!banner) return;

  if (score != null || accuracy != null || combo != null) {
    banner.classList.add("visible");
    setText("#db-banner-score", String(displayScore ?? 0));
    const bannerMeta = document.getElementById("db-banner-meta");
    if (bannerMeta) {
      const lessonText = lesson ? `${lesson} / ` : "";
      const accuracyText = accuracy != null ? `정확도 ${Math.round(accuracy)}%` : "최근 결과";
      bannerMeta.textContent = `${lessonText}${accuracyText}`;
    }
    const resultLink = document.querySelector(".db-result-link");
    if (resultLink) {
      resultLink.href = result?.gameType === "sparring" ? "./result.html" : "./training_result.html";
    }
    return;
  }

  banner.classList.remove("visible");
}

async function renderUser(user) {
  const name = resolveUserName(user);
  const tier = String(user?.tier || "free").trim();
  const level = toNumber(user?.level, 1);
  const totalXp = toNumber(user?.total_xp ?? user?.totalXp, 0);

  setText("[data-user-name]", name);
  setText("[data-user-summary]", `${name}의 Dashboard`);
  setText("[data-user-tier-badge]", tier);
  setText("[data-user-tier-text]", resolveTierLabel(tier));
  setText("[data-page-message]", "훈련 데이터를 확인하고 다음 라운드를 준비하세요.");

  const dbLastResult = normalizeDashboardResult(await fetchLatestTrainingResult(), "training");
  const localTrainingResult = readStoredJson(TRAINING_LAST_RESULT_KEY);
  const localSparringResult = readStoredJson(SPARRING_LAST_RESULT_KEY);
  const lastResult = pickLatestResult(
    dbLastResult,
    resultBelongsToUser(localTrainingResult, user) ? normalizeDashboardResult(localTrainingResult, "training") : null,
    resultBelongsToUser(localSparringResult, user) ? normalizeDashboardResult(localSparringResult, "sparring") : null,
  );
  renderLastResult(lastResult);

  const userLabel = document.querySelector("[data-user-name]");
  if (userLabel) userLabel.title = `${name} / LV.${level} / ${totalXp} XP`;

  document.querySelectorAll("[data-admin-nav]").forEach((element) => {
    element.hidden = tier !== "admin";
  });
}

async function init() {
  bindLogoutButtons();

  const storedUser = getStoredUser();
  if (storedUser) await renderUser(storedUser);

  const refreshedUser = await refreshCurrentUser();
  if (!refreshedUser && !storedUser) {
    redirectToLogin();
    return;
  }

  if (refreshedUser) await renderUser(refreshedUser);
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch(() => redirectToLogin());
});

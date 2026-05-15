import { clearSession, getStoredUser, refreshCurrentUser, authFetch } from "../core/auth.js";
import { apiFetch } from "../core/api.js";
import { SparringSound } from "../engine/SparringSound.js?v=20260506-alternating-bgm";

function redirectToLogin() {
  window.location.href = "/index.html";
}

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) {
    element.textContent = value;
  }
}

function styleTrainerName(value) {
  const element = document.querySelector("[data-my-nickname]");
  if (!element) return;
  const text = String(value || "").trim();
  const hasKorean = /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(text);
  const isEnglish = /^[A-Za-z0-9\s._-]+$/.test(text) && /[A-Za-z]/.test(text);

  element.classList.toggle("is-korean", hasKorean);
  element.classList.toggle("is-english", !hasKorean && isEnglish);
}

function pickNumber(...values) {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
}

function bindLogoutButtons() {
  document.querySelectorAll("[data-logout-button]").forEach((button) => {
    button.addEventListener("click", () => {
      clearSession();
      redirectToLogin();
    });
  });
}

function bindSparringSound() {
  SparringSound.init();
  SparringSound.stopBgm();
}

function pickFirst(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return null;
}

function formatScore(value) {
  const score = Math.round(pickNumber(value));
  return score > 0 ? String(score) : "—";
}

function normalizeRows(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (!payload || typeof payload !== "object") {
    return [];
  }
  return payload.items || payload.results || payload.data || payload.leaderboard || [];
}

function normalizeMode(value) {
  const mode = String(value || "").trim().toLowerCase();
  return ["beginner", "intermediate", "advanced"].includes(mode) ? mode : "beginner";
}

function normalizeResult(row) {
  return {
    id: row?.id,
    mode: normalizeMode(pickFirst(row?.mode, row?.sparringMode)),
    score: pickNumber(row?.score, row?.total_score, row?.totalScore),
    grade: String(pickFirst(row?.grade, "") || "").trim().toUpperCase(),
    maxCombo: pickNumber(row?.maxCombo, row?.max_combo, row?.combo),
    accuracy: pickNumber(row?.accuracy),
    playerHp: pickNumber(row?.playerHp, row?.player_hp),
    opponentHp: pickNumber(row?.opponentHp, row?.opponent_hp),
    nickname: String(pickFirst(row?.nickname, row?.username, row?.name, "PLAYER")).trim(),
  };
}

function renderUser(user) {
  const username = String(pickFirst(user?.nickname, user?.username, user?.email, "사용자"));
  const tier = String(user?.tier || "free").trim();

  setText("[data-user-name]", username);
  setText("[data-user-summary]", `${username}님의 스파링`);
  setText("[data-user-tier-text]", `${tier} 사용자도 기본 스파링 화면에 들어올 수 있습니다.`);
}

async function fetchMySparringResults() {
  try {
    const response = await authFetch("/api/sparring/my?limit=50");
    if (!response.ok) {
      return [];
    }
    return normalizeRows(await response.json()).map(normalizeResult);
  } catch {
    return [];
  }
}

async function fetchTopLeaderboard() {
  try {
    const response = await apiFetch("/api/sparring/leaderboard?limit=3");
    if (!response.ok) {
      return [];
    }
    return normalizeRows(await response.json()).map(normalizeResult);
  } catch {
    return [];
  }
}

function readLocalLastResult() {
  try {
    const raw = window.localStorage.getItem("im_boxer_sparring_last_result");
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? normalizeResult(parsed.serverResult || parsed) : null;
  } catch {
    return null;
  }
}

function renderMyStats(rows, user) {
  const records = rows.length ? rows : [readLocalLastResult()].filter(Boolean);
  const nickname = String(pickFirst(user?.nickname, user?.username, user?.email, "사용자"));
  const best = records.reduce((winner, item) => (item.score > winner.score ? item : winner), { score: 0 });
  const winCount = records.filter((item) => item.playerHp > 0 && item.opponentHp <= 0).length;
  const bestGrade = records.find((item) => item.grade)?.grade || "—";

  setText("[data-my-nickname]", nickname);
  styleTrainerName(nickname);
  setText("[data-my-best-score]", formatScore(best.score));
  setText("[data-my-win-count]", records.length ? String(winCount) : "—");
  setText("[data-my-total-matches]", records.length ? String(records.length) : "—");
  setText("[data-my-best-grade]", bestGrade);

  ["beginner", "intermediate", "advanced"].forEach((mode) => {
    const modeBest = records
      .filter((item) => item.mode === mode)
      .reduce((winner, item) => (item.score > winner.score ? item : winner), { score: 0 });
    setText(`[data-mode-best-score="${mode}"]`, formatScore(modeBest.score));
  });
}

function renderTopPreview(rows) {
  const fallback = [
    { nickname: "CHAMPION", score: 9999 },
    { nickname: "PLAYER 02", score: 8450 },
    { nickname: "PLAYER 03", score: 7890 },
  ];
  const list = rows.length ? rows : fallback;

  [1, 2, 3].forEach((rank) => {
    const row = list[rank - 1];
    setText(`[data-top${rank}-name]`, row ? row.nickname : "—");
    setText(`[data-top${rank}-score]`, row ? formatScore(row.score) : "—");
  });
}

function normalizeCopy() {
  document.title = "IM_BOXER | 스파링";

  setText("[data-round-label]", "ROUND 1");
  setText("[data-round-timer]", "02:00");
  setText("[data-sparring-score]", "0000");
  setText("[data-sparring-combo]", "x0");
  setText("[data-sparring-hit-count]", "0");
}

async function init() {
  bindLogoutButtons();
  bindSparringSound();
  normalizeCopy();

  const storedUser = getStoredUser();
  if (storedUser) {
    renderUser(storedUser);
  }

  const refreshedUser = await refreshCurrentUser().catch(() => null);
  if (!refreshedUser && !storedUser) {
    redirectToLogin();
    return;
  }

  if (refreshedUser) {
    renderUser(refreshedUser);
  }

  const activeUser = refreshedUser || storedUser;
  const [myRows, topRows] = await Promise.all([
    fetchMySparringResults(),
    fetchTopLeaderboard(),
  ]);
  renderMyStats(myRows, activeUser);
  renderTopPreview(topRows);
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch(() => redirectToLogin());
});

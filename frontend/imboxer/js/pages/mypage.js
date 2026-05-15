import { authFetch, clearSession, getStoredUser, refreshCurrentUser, setStoredUser } from "../core/auth.js";
import { apiUrl } from "../core/api.js";

const PROFILE_OVERRIDES_KEY = "im_boxer_profile_overrides";
const TRAINING_LIMIT = 30;
const SPARRING_LIMIT = 30;

const RANK_GRADES = ["d", "c", "b", "a", "s"];
const RANK_LABELS = { d: "D", c: "C", b: "B", a: "A", s: "S" };
const RANK_XP_THRESHOLDS = { d: 0, c: 200, b: 600, a: 1200, s: 2200 };
const RANK_XP_NEXT = { d: 200, c: 400, b: 600, a: 1000, s: null };
const GRADE_IMG_PATH = "./assets/images/tutorials/grades/grade_";

let pageState = {
  user: null,
  training: [],
  sparring: [],
  leaderboardMe: null,
};

function redirectToLogin() {
  window.location.href = "/index.html";
}

function setText(selector, value) {
  const el = document.querySelector(selector);
  if (el) el.textContent = value;
}

function pickFirst(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatNumber(value, fallback = "0") {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? String(Math.round(parsed)) : fallback;
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getLocalDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getResultDate(result) {
  const value = pickFirst(result?.createdAt, result?.created_at, result?.endedAt, result?.ended_at, result?.startedAt, result?.started_at);
  const date = new Date(value || Date.now());
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function getRankFromXp(totalXp) {
  const xp = Math.max(0, toNumber(totalXp, 0));
  if (xp >= RANK_XP_THRESHOLDS.s) return "s";
  if (xp >= RANK_XP_THRESHOLDS.a) return "a";
  if (xp >= RANK_XP_THRESHOLDS.b) return "b";
  if (xp >= RANK_XP_THRESHOLDS.c) return "c";
  return "d";
}

function getRankXpPct(rank, totalXp) {
  const xp = Math.max(0, toNumber(totalXp, 0));
  const threshold = RANK_XP_THRESHOLDS[rank];
  const needed = RANK_XP_NEXT[rank];
  if (!needed) return 100;
  return Math.min(100, Math.max(0, Math.round(((xp - threshold) / needed) * 100)));
}

function getLevelTitle(level) {
  const v = toNumber(level, 1);
  if (v >= 20) return "CHAMPION";
  if (v >= 15) return "ELITE";
  if (v >= 10) return "HUNTER";
  if (v >= 5) return "FIGHTER";
  return "ROOKIE";
}

function readProfileOverrides() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PROFILE_OVERRIDES_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveProfileOverrides(overrides) {
  window.localStorage.setItem(PROFILE_OVERRIDES_KEY, JSON.stringify(overrides));
}

function getDisplayName(user) {
  return String(pickFirst(user?.nickname, user?.username, user?.email, "BOXER"));
}

function getAvatarUrl(user) {
  return String(pickFirst(user?.avatarUrl, user?.avatar_url, user?.profileImage, user?.profile_image, "") || "");
}

function resolveAvatarUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^(https?:|data:|blob:)/i.test(raw)) return raw;
  if (raw.startsWith("/uploads/") || raw.startsWith("/dataset/")) return apiUrl(raw);
  if (raw.startsWith("./") || raw.startsWith("../")) return raw;
  if (raw.startsWith("uploads/")) return apiUrl(`/${raw}`);
  return raw;
}

function getTrainingScore(result) {
  const raw = toNumber(pickFirst(result?.score, result?.metrics?.score, result?.accuracy, result?.metrics?.accuracy), 0);
  return raw > 100 ? Math.round(raw / 10) : Math.round(raw);
}

function getTrainingTitle(result) {
  return String(pickFirst(result?.lessonTitle, result?.lesson_title, result?.lesson?.title, "Training")).trim();
}

function getSparringScore(result) {
  return Math.round(toNumber(result?.score, 0));
}

function getSparringTitle(result) {
  const mode = String(pickFirst(result?.mode, "beginner")).toUpperCase();
  return `Sparring ${mode}`;
}

async function fetchJson(path, fallback) {
  try {
    const response = await authFetch(path);
    if (!response.ok) return fallback;
    return await response.json();
  } catch {
    return fallback;
  }
}

async function fetchTrainingHistory() {
  const payload = await fetchJson(`/api/training-results?limit=${TRAINING_LIMIT}`, []);
  return Array.isArray(payload) ? payload : [];
}

async function fetchSparringHistory() {
  const payload = await fetchJson(`/api/sparring/my?limit=${SPARRING_LIMIT}`, []);
  return Array.isArray(payload) ? payload : [];
}

async function fetchMyLeaderboardRank() {
  return await fetchJson("/api/sparring/leaderboard/me", null);
}

function bindLogoutButtons() {
  document.querySelectorAll("[data-logout-button]").forEach((btn) => {
    btn.addEventListener("click", () => {
      clearSession();
      redirectToLogin();
    });
  });
}

function renderAvatar(avatarUrl, name) {
  const avatar = document.querySelector("[data-user-avatar]");
  if (!avatar) return;
  const initial = String(name || "B").trim().charAt(0).toUpperCase() || "B";
  const resolvedUrl = resolveAvatarUrl(avatarUrl);
  avatar.innerHTML = resolvedUrl
    ? `<img src="${resolvedUrl}" alt="${initial} profile" onerror="this.remove();this.parentElement.textContent='${initial}'">`
    : `<span data-avatar-initial>${initial}</span>`;
}

function renderHero(user) {
  const overrides = readProfileOverrides();
  const profile = { ...user, ...overrides };
  const name = getDisplayName(profile);
  const email = String(pickFirst(profile.email, "-"));
  const tier = String(user?.tier || "free").trim();
  const level = toNumber(user?.level, 1);
  const xp = toNumber(user?.exp ?? user?.total_xp ?? user?.totalXp, 0);
  const rank = getRankFromXp(xp);
  const xpPct = getRankXpPct(rank, xp);

  setText("[data-user-name]", name);
  setText("[data-avatar-initial]", name.charAt(0).toUpperCase() || "B");
  setText("[data-user-email]", email);
  setText("[data-user-email-display]", email);
  setText("[data-user-tier-badge]", tier.toUpperCase());
  setText("[data-user-tier-text]", `${tier} user`);
  setText("[data-my-level]", String(level));
  setText("[data-my-level-title]", `${getLevelTitle(level)} FIGHTER`);
  setText("[data-my-xp-text]", `${xp} XP`);
  setText("[data-user-joined]", formatDate(pickFirst(user?.createdAt, user?.created_at, user?.joinedAt)));
  setText("[data-user-summary]", `${name}의 기록`);

  document.querySelectorAll("[data-my-xp-fill]").forEach((fill) => {
    requestAnimationFrame(() => { fill.style.width = `${xpPct}%`; });
  });

  document.querySelectorAll("[data-rank-main-img], [data-rank-hero-img]").forEach((img) => {
    img.src = `${GRADE_IMG_PATH}${rank}.svg`;
    img.alt = `${RANK_LABELS[rank]} Rank`;
  });
  setText("[data-rank-current-text]", `${RANK_LABELS[rank]} RANK`);
  setText("[data-rank-hero-label]", `${RANK_LABELS[rank]} RANK`);

  const next = RANK_GRADES[RANK_GRADES.indexOf(rank) + 1] || null;
  const xpNeeded = next ? RANK_XP_NEXT[rank] - Math.max(0, xp - RANK_XP_THRESHOLDS[rank]) : 0;
  setText("[data-rank-xp-needed]", next ? `${RANK_LABELS[next]} Rank까지 ${Math.max(0, xpNeeded)} XP` : "최고 랭크 달성");
  setText("[data-rank-today-earn]", "오늘 훈련 기록은 DB 기준으로 반영됩니다.");

  const ladder = document.querySelector("[data-rank-ladder]");
  if (ladder) {
    ladder.innerHTML = RANK_GRADES.map((grade) => `
      <div class="rank-step ${grade === rank ? "rank-step--active" : ""}">
        <img class="rank-step__img" src="${GRADE_IMG_PATH}${grade}.svg" alt="${RANK_LABELS[grade]}">
        <span class="rank-step__label">${RANK_LABELS[grade]}</span>
      </div>
    `).join("");
  }

  renderAvatar(getAvatarUrl(profile), name);
}

function renderSummaryStats(user, training, sparring, leaderboardMe) {
  const trainingScores = training.map(getTrainingScore).filter((score) => score > 0);
  const sparringScores = sparring.map(getSparringScore).filter((score) => score > 0);
  const allScores = [...trainingScores, ...sparringScores];
  const bestScore = allScores.length ? Math.max(...allScores) : 0;
  const sessions = training.length + sparring.length;
  const rankLabel = leaderboardMe?.rank ? `#${leaderboardMe.rank}` : `LV.${toNumber(user?.level, 1)}`;
  const avgScore = allScores.length ? Math.round(allScores.reduce((sum, score) => sum + score, 0) / allScores.length) : 0;

  setText("[data-my-total-sessions]", String(sessions));
  setText("[data-my-best-score]", bestScore > 0 ? String(bestScore) : "0");
  setText("[data-my-rank]", rankLabel);
  setText("[data-my-best-streak]", String(toNumber(user?.streak ?? user?.currentStreak, 0)));

  const avgEl = document.querySelector("[data-stat-avg-score]");
  const bestEl = document.querySelector("[data-stat-best-score-display]");
  if (avgEl) avgEl.innerHTML = `<span class="mp-num">${avgScore}</span><span class="mp-unit">점</span>`;
  if (bestEl) bestEl.innerHTML = `<span class="mp-num">${bestScore}</span><span class="mp-unit">점</span>`;

  const bestTraining = training
    .map((item) => ({ title: getTrainingTitle(item), score: getTrainingScore(item) }))
    .sort((a, b) => b.score - a.score)[0];
  const weakTraining = training
    .map((item) => ({ title: getTrainingTitle(item), score: getTrainingScore(item) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => a.score - b.score)[0];

  setText("[data-stat-best-move]", bestTraining?.title || "-");
  setText("[data-stat-weak-move]", weakTraining?.title || "-");
}

function renderHistory(training, sparring) {
  const slot = document.querySelector("[data-session-history-slot]");
  if (!slot) return;

  const rows = [
    ...training.map((item) => ({
      type: "training",
      title: getTrainingTitle(item),
      date: getResultDate(item),
      score: getTrainingScore(item),
    })),
    ...sparring.map((item) => ({
      type: "sparring",
      title: getSparringTitle(item),
      date: getResultDate(item),
      score: getSparringScore(item),
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 8);

  if (!rows.length) {
    slot.innerHTML = '<div class="mp-history-empty">아직 기록이 없습니다.</div>';
    return;
  }

  slot.innerHTML = rows.map((row) => `
    <div class="mp-session-row">
      <span class="mp-session-type" data-type="${row.type}">${row.type.toUpperCase()}</span>
      <div class="mp-session-info">
        <div class="mp-session-lesson">${row.title}</div>
        <div class="mp-session-date">${formatDate(row.date)}</div>
      </div>
      <div class="mp-session-score">${row.score}</div>
    </div>
  `).join("");
}

function renderToday(training) {
  const todayKey = getLocalDateKey(new Date());
  const todayResults = training.filter((item) => getLocalDateKey(getResultDate(item)) === todayKey);
  const elapsedMs = todayResults.reduce((sum, item) => sum + toNumber(item.elapsedMs ?? item.elapsed_ms, 0), 0);
  const minutes = elapsedMs > 0 ? Math.max(1, Math.round(elapsedMs / 60000)) : 0;
  const lessons = [...new Set(todayResults.map(getTrainingTitle))];

  const timeEl = document.querySelector("[data-today-time]");
  if (timeEl) timeEl.innerHTML = `<span class="mp-num">${minutes}</span><span class="mp-unit">분</span>`;

  const completedEl = document.querySelector("[data-today-completed]");
  if (completedEl) {
    completedEl.innerHTML = lessons.length
      ? lessons.map((name) => `<span class="today-chip today-chip--done">완료 ${name}</span>`).join("")
      : '<span class="today-chip today-chip--pending">오늘 완료한 훈련 없음</span>';
  }

  const pendingEl = document.querySelector("[data-today-pending]");
  if (pendingEl) {
    pendingEl.innerHTML = ["Guard", "Jab", "Slip"].map((name) => (
      `<span class="today-chip today-chip--pending">${name}</span>`
    )).join("");
  }

  setText("[data-today-recommend]", lessons.length
    ? "오늘 기록이 저장되었습니다. 다음 세션에서는 낮은 점수 동작을 보완해보세요."
    : "아직 오늘 훈련 기록이 없습니다. 기본 가드부터 시작해보세요.");

  document.querySelectorAll("[data-today-cta-link], .today-cta").forEach((link) => {
    link.href = "./training.html";
  });
}

function renderWeeklyChart(training) {
  const slot = document.querySelector("[data-weekly-chart-slot]");
  if (!slot) return;

  const now = new Date();
  const dayIndex = now.getDay();
  const mondayOffset = dayIndex === 0 ? -6 : 1 - dayIndex;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);

  const labels = ["월", "화", "수", "목", "금", "토", "일"];
  const days = labels.map((label, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    const key = getLocalDateKey(date);
    const scores = training
      .filter((item) => getLocalDateKey(getResultDate(item)) === key)
      .map(getTrainingScore)
      .filter((score) => score > 0);
    const score = scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : 0;
    return { label, date, score, isToday: key === getLocalDateKey(now) };
  });

  const max = Math.max(...days.map((day) => day.score), 1);
  slot.innerHTML = days.map((day, index) => {
    const heightPct = day.score > 0 ? Math.round((day.score / max) * 100) : 0;
    const fillClass = day.isToday ? "week-bar-fill week-bar-fill--today" : "week-bar-fill";
    const dayClass = day.isToday ? "week-bar-day week-bar-day--today" : "week-bar-day";
    return `
      <div class="week-col">
        <span class="week-bar-score">${day.score || ""}</span>
        <div class="week-bar-track">
          <div class="${fillClass}" style="height:${heightPct}%;--delay:${index * 0.07}s"></div>
        </div>
        <span class="${dayClass}">${day.label}</span>
        <span class="week-bar-date">${new Intl.DateTimeFormat("ko-KR", { month: "2-digit", day: "2-digit" }).format(day.date).replace(/\.$/, "")}</span>
      </div>
    `;
  }).join("");
}

function renderSkills(training) {
  const latest = training[0] || null;
  const metrics = latest?.metrics || {};
  const values = {
    guard: pickFirst(metrics.guardScore, metrics.guard_score, latest?.accuracy),
    jab: pickFirst(metrics.speedScore, metrics.speed_score, latest?.score),
    cross: pickFirst(metrics.powerScore, metrics.power_score, latest?.score),
    "left-hook": pickFirst(metrics.consistencyScore, metrics.consistency_score, latest?.accuracy),
    uppercut: pickFirst(metrics.recoveryScore, metrics.recovery_score, latest?.accuracy),
    slip: pickFirst(metrics.balanceScore, metrics.balance_score, latest?.accuracy),
  };

  Object.entries(values).forEach(([key, value]) => {
    const pct = Math.max(0, Math.min(100, toNumber(value, 0)));
    const fill = document.querySelector(`[data-skill-bar='${key}']`);
    const label = document.querySelector(`[data-skill-pct='${key}']`);
    const feedback = document.querySelector(`[data-skill-feedback='${key}']`);
    if (fill) {
      fill.style.width = `${pct}%`;
      fill.dataset.level = pct >= 80 ? "excellent" : pct >= 65 ? "good" : pct >= 50 ? "warning" : "critical";
    }
    if (label) label.textContent = pct > 0 ? `${Math.round(pct)}%` : "0%";
    if (feedback) feedback.textContent = pct > 0 ? "최근 훈련 결과 기준입니다." : "아직 측정된 기록이 없습니다.";
  });
}

function renderCoach(training, sparring) {
  const latestTraining = training[0];
  const latestSparring = sparring[0];
  const message = latestSparring
    ? `최근 스파링 최고 콤보는 ${formatNumber(latestSparring.maxCombo ?? latestSparring.max_combo)}입니다. 다음에는 방어 성공률을 함께 올려보세요.`
    : latestTraining
      ? `최근 ${getTrainingTitle(latestTraining)} 훈련이 저장되었습니다. 정확도와 리듬을 이어가세요.`
      : "아직 기록이 없습니다. 첫 훈련을 시작하면 이곳에 맞춤 피드백이 표시됩니다.";
  setText("[data-coach-message]", message);
}

function renderAchievements(training, sparring) {
  const slot = document.querySelector("[data-achievements-slot]");
  if (!slot) return;

  const achievements = [
    { title: "First Training", desc: "훈련 기록 1회", unlocked: training.length > 0 },
    { title: "First Sparring", desc: "스파링 기록 1회", unlocked: sparring.length > 0 },
    { title: "Combo 10", desc: "스파링 콤보 10 이상", unlocked: sparring.some((item) => toNumber(item.maxCombo ?? item.max_combo) >= 10) },
    { title: "Score 80", desc: "훈련 점수 80 이상", unlocked: training.some((item) => getTrainingScore(item) >= 80) },
  ];

  slot.innerHTML = achievements.map((item) => `
    <div class="ach-card ${item.unlocked ? "" : "ach-card--locked"}">
      <span class="ach-icon">${item.unlocked ? "OK" : "LOCK"}</span>
      <div class="ach-title">${item.title}</div>
      <div class="ach-desc">${item.desc}</div>
      <span class="ach-badge ${item.unlocked ? "ach-badge--done" : "ach-badge--lock"}">
        ${item.unlocked ? "달성" : "대기"}
      </span>
    </div>
  `).join("");
}

function renderPage(user, training, sparring, leaderboardMe) {
  renderHero(user);
  renderSummaryStats(user, training, sparring, leaderboardMe);
  renderHistory(training, sparring);
  renderToday(training);
  renderWeeklyChart(training);
  renderSkills(training);
  renderCoach(training, sparring);
  renderAchievements(training, sparring);
}

function openProfileModal() {
  const overrides = readProfileOverrides();
  const stored = getStoredUser() || {};
  const profile = { ...stored, ...overrides };
  const nameInput = document.querySelector("[data-profile-name-input]");
  const emailInput = document.querySelector("[data-profile-email-input]");
  const avatarInput = document.querySelector("[data-profile-avatar-input]");
  const fileInput = document.querySelector("[data-profile-avatar-file]");
  const name = pickFirst(profile.nickname, profile.username, "");
  const avatarUrl = getAvatarUrl(profile);
  if (nameInput) nameInput.value = name;
  if (emailInput) emailInput.value = pickFirst(profile.email, "");
  if (avatarInput) avatarInput.value = avatarUrl;
  if (fileInput) fileInput.value = "";
  renderProfilePreview(avatarUrl, name);
  const modal = document.querySelector("[data-profile-modal]");
  if (modal) {
    modal.dataset.open = "true";
    modal.setAttribute("aria-hidden", "false");
  }
}

function renderProfilePreview(avatarUrl, name) {
  const preview = document.querySelector("[data-profile-preview]");
  if (!preview) return;
  const initial = String(name || "B").trim().charAt(0).toUpperCase() || "B";
  const resolvedUrl = resolveAvatarUrl(avatarUrl);
  preview.innerHTML = resolvedUrl
    ? `<img src="${resolvedUrl}" alt="${initial} profile" onerror="this.remove();this.parentElement.textContent='${initial}'">`
    : initial;
}

function closeProfileModal() {
  const modal = document.querySelector("[data-profile-modal]");
  if (modal) {
    delete modal.dataset.open;
    modal.setAttribute("aria-hidden", "true");
  }
}

function bindProfileModal() {
  document.querySelector("[data-edit-profile]")?.addEventListener("click", openProfileModal);
  document.querySelector("[data-profile-cancel]")?.addEventListener("click", closeProfileModal);
  document.querySelector("[data-profile-modal]")?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) closeProfileModal();
  });
  document.querySelector("[data-profile-avatar-file]")?.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || "");
      const avatarInput = document.querySelector("[data-profile-avatar-input]");
      if (avatarInput) avatarInput.value = value;
      renderProfilePreview(value, document.querySelector("[data-profile-name-input]")?.value || "B");
    };
    reader.readAsDataURL(file);
  });
  document.querySelector("[data-profile-avatar-input]")?.addEventListener("input", (event) => {
    renderProfilePreview(event.target.value, document.querySelector("[data-profile-name-input]")?.value || "B");
  });
  document.querySelector("[data-profile-name-input]")?.addEventListener("input", (event) => {
    const avatarUrl = document.querySelector("[data-profile-avatar-input]")?.value || "";
    renderProfilePreview(avatarUrl, event.target.value || "B");
  });
  document.querySelector("[data-profile-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const stored = getStoredUser() || {};
    const fileInput = document.querySelector("[data-profile-avatar-file]");
    const nameValue = document.querySelector("[data-profile-name-input]")?.value.trim() || stored.nickname || stored.username || "";
    const emailValue = document.querySelector("[data-profile-email-input]")?.value.trim() || stored.email || "";
    const avatarValue = document.querySelector("[data-profile-avatar-input]")?.value.trim() || "";
    const formData = new FormData();
    formData.append("username", nameValue);
    formData.append("email", emailValue);
    if (fileInput?.files?.[0]) {
      formData.append("avatar_file", fileInput.files[0]);
    } else if (avatarValue && !avatarValue.startsWith("data:")) {
      formData.append("avatar_url", avatarValue);
    }

    let savedUser = null;
    try {
      const response = await authFetch("/api/users/me/profile", {
        method: "PATCH",
        body: formData,
      });
      if (response.ok) {
        savedUser = await response.json();
      }
    } catch {
      savedUser = null;
    }

    const overrides = savedUser ? {} : {
      nickname: nameValue,
      username: nameValue,
      email: emailValue,
      avatarUrl: avatarValue || getAvatarUrl(stored),
    };
    saveProfileOverrides(overrides);
    pageState.user = savedUser || { ...stored, ...overrides };
    setStoredUser(pageState.user);
    renderPage(pageState.user, pageState.training, pageState.sparring, pageState.leaderboardMe);
    closeProfileModal();
  });
}

async function init() {
  bindLogoutButtons();
  bindProfileModal();

  const storedUser = getStoredUser();
  if (storedUser) {
    pageState.user = storedUser;
    renderPage(storedUser, [], [], null);
  }

  const refreshedUser = await refreshCurrentUser();
  if (!refreshedUser && !storedUser) {
    redirectToLogin();
    return;
  }

  const user = refreshedUser || storedUser;
  const [training, sparring, leaderboardMe] = await Promise.all([
    fetchTrainingHistory(),
    fetchSparringHistory(),
    fetchMyLeaderboardRank(),
  ]);

  pageState = { user, training, sparring, leaderboardMe };
  renderPage(user, training, sparring, leaderboardMe);
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch(() => redirectToLogin());
});

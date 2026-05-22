import { hydratePage } from "../core/ui.js";
import { apiFetch, apiUrl } from "../core/api.js";
import { authFetch, clearSession, getStoredUser } from "../core/auth.js";

const VALID_MODES = new Set(["all", "beginner", "intermediate", "advanced"]);
const SPARRING_LAST_RESULT_KEY = "im_boxer_sparring_last_result";
const SPARRING_PENDING_SAVE_KEY = "im_boxer_sparring_pending_save";
const PROFILE_OVERRIDES_KEY = "im_boxer_profile_overrides";

let currentMode = "all";
let myRank = null;

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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatScore(value) {
  return String(Math.round(toNumber(value, 0)));
}

function formatDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw.slice(0, 10);
  return date.toLocaleDateString("ko-KR", {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  });
}

function extractRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  return payload.items || payload.results || payload.data || payload.leaderboard || payload.ranks || [];
}

function safeJsonParse(raw) {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function readProfileOverrides() {
  return safeJsonParse(window.localStorage.getItem(PROFILE_OVERRIDES_KEY)) || {};
}

function pickAvatarUrl(source) {
  return String(pickFirst(
    source?.avatarUrl,
    source?.avatar_url,
    source?.avatar,
    source?.profileImage,
    source?.profile_image,
    source?.profilePhoto,
    source?.profile_photo,
    source?.profileUrl,
    source?.profile_url,
    source?.photoUrl,
    source?.photo_url,
    source?.imageUrl,
    source?.image_url,
    source?.picture,
    source?.user?.avatarUrl,
    source?.user?.avatar_url,
    source?.user?.profileImage,
    source?.user?.profile_image,
    "",
  ) || "");
}

function modeLabel(mode) {
  const key = String(mode || "").toLowerCase();
  if (key === "beginner") return "초급";
  if (key === "intermediate") return "중급";
  if (key === "advanced") return "고급";
  return "";
}

function normalizeRow(row, index = 0) {
  const userId = toNumber(pickFirst(row?.userId, row?.user_id, row?.id), 0);
  const rank = toNumber(pickFirst(row?.rank, row?.position, row?.place, index + 1), index + 1);
  const name = String(pickFirst(row?.nickname, row?.username, row?.name, row?.displayName, "PLAYER")).trim();
  const scoreValue = toNumber(pickFirst(row?.score, row?.final_score, row?.total_score, row?.points, 0), 0);
  const mode = String(pickFirst(row?.mode, row?.sparringMode, "")).trim();
  const grade = String(pickFirst(row?.grade, row?.tier, row?.levelName, "")).trim().toUpperCase();
  const badgeParts = [modeLabel(mode), grade].filter(Boolean);

  return {
    userId,
    rank,
    name,
    scoreValue,
    score: formatScore(scoreValue),
    date: formatDate(pickFirst(row?.createdAt, row?.created_at, row?.date, row?.recordedAt, "")),
    badge: badgeParts.join(" · "),
    avatarUrl: pickAvatarUrl(row),
    mode,
    grade,
    accuracy: toNumber(pickFirst(row?.accuracy, row?.accuracy_rate, row?.accuracyRate, 0), 0),
    maxCombo: toNumber(pickFirst(row?.maxCombo, row?.max_combo, row?.combo, 0), 0),
  };
}

function resolveAvatarUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^(https?:|data:|blob:)/i.test(raw)) return raw;
  if (raw.startsWith("/uploads/") || raw.startsWith("/dataset/")) return apiUrl(raw);
  if (raw.startsWith("./") || raw.startsWith("../")) return raw;
  if (raw.startsWith("uploads/")) return apiUrl(`/${raw}`);
  if (raw.startsWith("profiles/")) return apiUrl(`/uploads/${raw}`);
  if (raw.startsWith("media/")) return apiUrl(`/uploads/${raw}`);
  if (/^user_\d+_[\w-]+\.(jpe?g|png|webp|gif)$/i.test(raw)) return apiUrl(`/uploads/profiles/${raw}`);
  return raw;
}

function normalizeMyRank(payload) {
  if (!payload || typeof payload !== "object") return null;
  const row = normalizeRow(payload, 0);
  row.rank = payload.rank === null || payload.rank === undefined ? null : toNumber(payload.rank, 0);
  row.totalRanked = toNumber(pickFirst(payload.totalRanked, payload.total_ranked, 0), 0);
  return row;
}

function buildSparringSavePayload(result) {
  if (!result || typeof result !== "object" || result.serverResult) return null;
  return {
    mode: result.mode || "beginner",
    sessionId: result.sessionId || result.session_id || null,
    score: Math.max(0, toNumber(result.score, 0)),
    maxCombo: toNumber(result.maxCombo || result.max_combo, 0),
    hitCount: toNumber(result.hitCount || result.hit_count, 0),
    dodgeCount: toNumber(result.dodgeCount || result.dodge_count, 0),
    perfectCount: toNumber(result.perfectCount || result.perfect_count, 0),
    playerHp: toNumber(result.playerHp || result.player_hp, 0),
    opponentHp: toNumber(result.opponentHp || result.opponent_hp, 0),
    accuracy: toNumber(result.accuracy, 0),
    dodgeSuccessRate: toNumber(result.dodgeSuccessRate || result.dodge_success_rate, 0),
    averageReactionMs: toNumber(result.averageReactionMs || result.average_reaction_ms, 0),
    grade: result.grade || null,
    coachComment: result.coachComment || result.coach_comment || "",
    durationSec: toNumber(result.durationSec || result.duration_sec, 0),
    endedAt: result.endedAt || result.ended_at || new Date().toISOString(),
  };
}

async function retryPendingSparringSave() {
  const pending = safeJsonParse(window.localStorage.getItem(SPARRING_PENDING_SAVE_KEY));
  const latest = safeJsonParse(window.localStorage.getItem(SPARRING_LAST_RESULT_KEY));
  const candidate = pending || latest;
  const payload = buildSparringSavePayload(candidate);
  if (!payload || payload.score <= 0) return;

  const pendingAgeMs = Date.now() - new Date(candidate.saveAttemptedAt || 0).getTime();
  if (candidate.saveStatus === "pending" && Number.isFinite(pendingAgeMs) && pendingAgeMs < 10000) {
    return;
  }

  try {
    const response = await authFetch("/api/sparring/end", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      window.localStorage.setItem(SPARRING_PENDING_SAVE_KEY, JSON.stringify({
        ...candidate,
        saveStatus: response.status === 401 || response.status === 403 ? "auth_required" : "failed",
        saveHttpStatus: response.status,
        saveAttemptedAt: new Date().toISOString(),
      }));
      return;
    }

    const serverResult = await response.json().catch(() => null);
    if (serverResult) {
      window.localStorage.setItem(SPARRING_LAST_RESULT_KEY, JSON.stringify({
        ...candidate,
        serverResult,
        saveStatus: "saved",
      }));
      window.localStorage.removeItem(SPARRING_PENDING_SAVE_KEY);
    }
  } catch (error) {
    window.localStorage.setItem(SPARRING_PENDING_SAVE_KEY, JSON.stringify({
      ...candidate,
      saveStatus: "failed",
      saveError: String(error?.message || error),
      saveAttemptedAt: new Date().toISOString(),
    }));
  }
}

function initialsForName(name) {
  const trimmed = String(name || "P").trim();
  const korean = trimmed.match(/[가-힣]/g);
  if (korean?.length) return korean.slice(0, 2).join("");
  return trimmed.slice(0, 2).toUpperCase();
}

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value;
}

function setAvatar(target, row, size = "small") {
  if (!target) return;
  target.innerHTML = "";
  target.dataset.avatarSize = size;
  const resolvedUrl = resolveAvatarUrl(row?.avatarUrl);
  if (resolvedUrl) {
    const image = document.createElement("img");
    image.src = resolvedUrl;
    image.alt = `${row.name} avatar`;
    image.loading = "lazy";
    image.onerror = () => {
      target.innerHTML = "";
      target.textContent = initialsForName(row?.name);
    };
    target.appendChild(image);
    return;
  }
  target.textContent = initialsForName(row?.name);
}

function updatePodium(rows) {
  [1, 2, 3].forEach((position) => {
    const row = rows[position - 1] || null;
    const nameEl = document.querySelector(`[data-podium-name-${position}]`);
    const scoreEl = document.querySelector(`[data-podium-score-${position}]`);
    const avatarEl = document.querySelector(`[data-podium-avatar-${position}]`);
    if (!row) {
      if (nameEl) nameEl.textContent = "-";
      if (scoreEl) scoreEl.textContent = "0";
      if (avatarEl) avatarEl.textContent = String(position);
      return;
    }
    if (nameEl) nameEl.textContent = row.name;
    if (scoreEl) scoreEl.textContent = row.score;
    setAvatar(avatarEl, row, position === 1 ? "large" : "small");
  });
}

function renderMyRank(rows) {
  const storedUser = getStoredUser() || {};
  const profileOverrides = readProfileOverrides();
  const localProfile = { ...storedUser, ...profileOverrides };
  const fallbackName = localProfile.username || localProfile.nickname || "BOXER";
  const storedId = toNumber(storedUser.id, -1);
  const localMatch = myRank?.rank ? myRank : rows.find((row) => row.userId && row.userId === storedId);
  const rankLabel = localMatch?.rank ? String(localMatch.rank) : "-";
  const nameLabel = localMatch?.name || fallbackName;
  const localAvatarUrl = pickAvatarUrl(localProfile);
  const avatarRow = {
    ...(localMatch || {}),
    name: nameLabel,
    avatarUrl: localMatch?.avatarUrl || localAvatarUrl,
  };

  const rankEl = document.querySelector("[data-my-rank-num]");
  if (rankEl) {
    rankEl.innerHTML = `${escapeHtml(rankLabel)}<span>위</span>`;
  }
  setText("[data-user-name]", nameLabel);
  setAvatar(document.querySelector("[data-my-rank-avatar]"), avatarRow, "small");

  const scoreEl = document.querySelector("[data-my-rank-score]");
  if (scoreEl) {
    scoreEl.innerHTML = localMatch?.rank
      ? `<span class="lb-score-num">${escapeHtml(localMatch.score)}</span>점`
      : "기록 없음";
  }
}

function renderTable(rows) {
  const tbody = document.querySelector("[data-leaderboard-tbody]");
  if (!tbody) return;

  tbody.innerHTML = "";
  if (!rows.length) {
    const emptyRow = document.createElement("tr");
    emptyRow.className = "lb-placeholder-row";
    emptyRow.innerHTML = '<td colspan="4">아직 리더보드 기록이 없습니다.</td>';
    tbody.appendChild(emptyRow);
    return;
  }

  rows.forEach((row) => {
    const tr = document.createElement("tr");
    const avatarUrl = resolveAvatarUrl(row.avatarUrl);
    if (myRank?.rank && row.userId && row.userId === myRank.userId) {
      tr.dataset.ownRank = "true";
    }
    if (avatarUrl) {
      tr.dataset.avatarUrl = avatarUrl;
    }

    tr.innerHTML = `
      <td class="lb-td-num"><span class="lb-td-rank" data-rank="${row.rank}">${row.rank}</span></td>
      <td>
        <div class="lb-td-user">
          <span class="lb-td-avatar" data-avatar-cell data-avatar-url="${escapeHtml(avatarUrl)}" data-avatar-initial="${escapeHtml(initialsForName(row.name))}"></span>
          <span class="lb-td-username">${escapeHtml(row.name)}</span>
          ${row.badge ? `<span class="lb-td-badge">${escapeHtml(row.badge)}</span>` : ""}
        </div>
      </td>
      <td class="lb-td-score">${escapeHtml(row.score)}</td>
      <td class="lb-td-date">${escapeHtml(row.date)}</td>
    `;

    setAvatar(tr.querySelector("[data-avatar-cell]"), row, "small");
    tbody.appendChild(tr);
  });
}

async function fetchLeaderboardRows() {
  const modeQuery = currentMode === "all" ? "" : `&mode=${encodeURIComponent(currentMode)}`;
  const response = await apiFetch(`/api/sparring/leaderboard?limit=100${modeQuery}`);
  if (!response.ok) throw new Error("leaderboard fetch failed");
  return extractRows(await response.json()).map(normalizeRow);
}

async function fetchMyRank() {
  const modeQuery = currentMode === "all" ? "" : `?mode=${encodeURIComponent(currentMode)}`;
  const response = await authFetch(`/api/sparring/leaderboard/me${modeQuery}`);
  if (!response.ok) return null;
  return normalizeMyRank(await response.json());
}

function setLoading() {
  const tbody = document.querySelector("[data-leaderboard-tbody]");
  if (tbody) {
    tbody.innerHTML = '<tr class="lb-placeholder-row"><td colspan="4">DB에서 랭킹을 불러오는 중입니다.</td></tr>';
  }
}

function updateFilterButtons() {
  document.querySelectorAll("[data-filter]").forEach((button) => {
    const mode = button.dataset.filter || "all";
    button.setAttribute("aria-pressed", mode === currentMode ? "true" : "false");
  });
}

function prepareFilterButtons() {
  const container = document.querySelector(".lb-table-filter");
  if (!container) return;
  container.innerHTML = "";
  [
    ["all", "전체"],
    ["beginner", "초급"],
    ["intermediate", "중급"],
    ["advanced", "고급"],
  ].forEach(([mode, label]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "lb-filter-btn";
    button.dataset.filter = mode;
    button.setAttribute("aria-pressed", mode === currentMode ? "true" : "false");
    button.textContent = label;
    container.appendChild(button);
  });
}

async function loadLeaderboard() {
  updateFilterButtons();
  setLoading();
  try {
    await retryPendingSparringSave();
    const [rows, rank] = await Promise.all([
      fetchLeaderboardRows(),
      fetchMyRank(),
    ]);
    myRank = rank;
    updatePodium(rows);
    renderMyRank(rows);
    renderTable(rows);
  } catch (error) {
    console.warn("leaderboard:", error);
    myRank = null;
    updatePodium([]);
    renderMyRank([]);
    const tbody = document.querySelector("[data-leaderboard-tbody]");
    if (tbody) {
      tbody.innerHTML = '<tr class="lb-placeholder-row"><td colspan="4">리더보드 데이터를 불러오지 못했습니다.</td></tr>';
    }
  }
}

function normalizeCopy() {
  document.title = "IM_BOXER | 스파링 리더보드";
  setText("[data-page-message]", "스파링 최고 점수 기준으로 DB에서 실시간 정렬합니다.");
  setText("[data-user-summary]", "스파링 리더보드");
}

function bindLogoutButtons() {
  document.querySelectorAll("[data-logout-button]").forEach((button) => {
    button.addEventListener("click", () => {
      clearSession();
      window.location.href = "/index.html";
    });
  });
}

function bindFilters() {
  prepareFilterButtons();
  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextMode = button.dataset.filter || "all";
      currentMode = VALID_MODES.has(nextMode) ? nextMode : "all";
      void loadLeaderboard();
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  hydratePage({
    overrides: {
      summary: "스파링 리더보드",
      message: "스파링 결과를 DB 최고 점수순으로 확인하세요.",
      tierText: "리더보드는 사용자별 최고 점수 한 개만 집계합니다.",
    },
  }).catch(() => {
    window.location.href = "/index.html";
  });

  bindLogoutButtons();
  bindFilters();
  normalizeCopy();
  void loadLeaderboard();
});

import { clearSession } from "../core/auth.js";
import { apiFetch, apiUrl } from "../core/api.js";

const SCORE_PREFIX = "im_boxer_lesson_score_";
const TUTORIAL_MAIN_IMAGE_DIR = "./assets/images/tutorials/main";
const LESSON_LEVEL_BY_KEY = {
  "basic-guard": "beginner",
  jab: "beginner",
  cross: "intermediate",
  "left-hook": "intermediate",
  slip: "intermediate",
  uppercut: "intermediate",
};
const LESSON_IMAGE_BY_KEY = {
  "basic-guard": `${TUTORIAL_MAIN_IMAGE_DIR}/기본가드.jpg`,
  jab: `${TUTORIAL_MAIN_IMAGE_DIR}/잽.jpg`,
  cross: `${TUTORIAL_MAIN_IMAGE_DIR}/크로스.jpg`,
  "left-hook": `${TUTORIAL_MAIN_IMAGE_DIR}/왼훅.jpg`,
  slip: `${TUTORIAL_MAIN_IMAGE_DIR}/슬립.jpg`,
  uppercut: `${TUTORIAL_MAIN_IMAGE_DIR}/어퍼컷.jpg`,
};
const DEFAULT_IMAGE = LESSON_IMAGE_BY_KEY["basic-guard"];
const KNOWN_LESSON_KEYS = Object.keys(LESSON_IMAGE_BY_KEY);
const LESSON_KEY_ALIASES = {
  guard: "basic-guard",
  "basic-guard": "basic-guard",
  "basic_guard": "basic-guard",
  "basicguard": "basic-guard",
  "beginner-basic-guard": "basic-guard",
  jab: "jab",
  cross: "cross",
  hook: "left-hook",
  "left-hook": "left-hook",
  "left_hook": "left-hook",
  "lefthook": "left-hook",
  slip: "slip",
  uppercut: "uppercut",
};

const DEFAULT_LESSONS = [
  {
    lessonKey: "basic-guard",
    title: "기본 가드",
    titleEn: "Guard",
    level: "beginner",
    image: LESSON_IMAGE_BY_KEY["basic-guard"],
    summary: "양손을 얼굴 가까이에 두고 중심을 안정적으로 유지하는 기본 자세.",
    keyPoint: "턱과 주먹의 간격을 좁게 유지하고, 팔꿈치는 몸통 쪽으로 붙입니다.",
  },
  {
    lessonKey: "jab",
    title: "잽",
    titleEn: "Jab",
    level: "beginner",
    image: LESSON_IMAGE_BY_KEY.jab,
    summary: "앞손을 빠르게 뻗고 즉시 가드로 복귀하는 가장 빠른 기본 타격.",
    keyPoint: "앞손은 빠르게, 반대손 가드는 끝까지 유지합니다.",
  },
  {
    lessonKey: "cross",
    title: "크로스",
    titleEn: "Cross",
    level: "intermediate",
    image: LESSON_IMAGE_BY_KEY.cross,
    summary: "뒷손과 몸통 회전을 함께 써서 강하게 밀어 넣는 직선 펀치.",
    keyPoint: "팔보다 골반 회전을 먼저 생각하고, 반대손 가드를 지킵니다.",
  },
  {
    lessonKey: "left-hook",
    title: "왼훅",
    titleEn: "Left Hook",
    level: "intermediate",
    image: LESSON_IMAGE_BY_KEY["left-hook"],
    summary: "짧은 팔 궤적으로 몸통 회전을 연결해 타격하는 원형 동작.",
    keyPoint: "팔꿈치를 너무 펴지 말고 짧고 안정적으로 휘두릅니다.",
  },
  {
    lessonKey: "slip",
    title: "슬립",
    titleEn: "Slip",
    level: "intermediate",
    image: LESSON_IMAGE_BY_KEY.slip,
    summary: "상체를 짧게 빼서 상대 펀치선을 피하는 방어 동작.",
    keyPoint: "허리만 꺾지 말고, 머리와 몸통을 같이 부드럽게 이동합니다.",
  },
  {
    lessonKey: "uppercut",
    title: "어퍼컷",
    titleEn: "Uppercut",
    level: "intermediate",
    image: LESSON_IMAGE_BY_KEY.uppercut,
    summary: "아래에서 위로 짧게 치며 반응 속도를 키우는 상향 타격.",
    keyPoint: "백스윙을 크게 만들지 말고, 몸 가까이에서 짧게 올립니다.",
  },
];

let LESSONS = [...DEFAULT_LESSONS];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getStoredScore(lessonKey) {
  try {
    const value = Number(window.localStorage.getItem(SCORE_PREFIX + lessonKey));
    return Number.isFinite(value) && value > 0 ? Math.round(value) : null;
  } catch {
    return null;
  }
}

function getStoredUser() {
  try {
    const raw = window.localStorage.getItem("im_boxer_user_profile");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeAssetUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw) || raw.startsWith("./")) return raw;
  if (raw.startsWith("/uploads/") || raw.startsWith("/dataset/")) return apiUrl(raw);
  if (raw.startsWith("/")) return `.${raw}`;
  return `./${raw}`;
}

function compactLessonText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replaceAll(/\s+/g, "")
    .replaceAll("_", "-");
}

function normalizeLessonKey(value) {
  const compact = compactLessonText(value);
  return LESSON_KEY_ALIASES[compact] || "";
}

function inferLessonKeyFromText(value) {
  const text = compactLessonText(value);
  if (!text) return "";
  if (text.includes("기본가드") || text.includes("가드") || text.includes("guard")) return "basic-guard";
  if (text.includes("잽") || text.includes("jab")) return "jab";
  if (text.includes("크로스") || text.includes("cross")) return "cross";
  if (text.includes("왼훅") || text.includes("레프트훅") || text.includes("훅") || text.includes("hook")) return "left-hook";
  if (text.includes("슬립") || text.includes("slip")) return "slip";
  if (text.includes("어퍼컷") || text.includes("uppercut")) return "uppercut";
  return "";
}

function resolveLessonKey(item, fallbackKey = "") {
  const rawKey = String(item?.lesson_key || item?.lessonKey || fallbackKey || "").trim();
  return (
    normalizeLessonKey(rawKey) ||
    inferLessonKeyFromText(rawKey) ||
    inferLessonKeyFromText(item?.title) ||
    inferLessonKeyFromText(item?.title_en || item?.titleEn) ||
    rawKey
  );
}

function levelFromTutorial(item) {
  const lessonKey = resolveLessonKey(item);
  if (LESSON_LEVEL_BY_KEY[lessonKey]) return LESSON_LEVEL_BY_KEY[lessonKey];
  const raw = String(item?.level_key || item?.difficulty || item?.level || "beginner").toLowerCase();
  if (raw.includes("basic") || raw.includes("beginner") || raw.includes("초급") || raw.includes("입문")) return "beginner";
  if (raw.includes("intermediate") || raw.includes("middle") || raw.includes("중급")) return "intermediate";
  if (raw.includes("advanced") || raw.includes("pro")) return "advanced";
  return "beginner";
}

function normalizeApiTutorial(item, index) {
  const lessonKey = resolveLessonKey(item, `tutorial-${index + 1}`);
  const title = String(item?.title || lessonKey).trim();
  const knownLesson = KNOWN_LESSON_KEYS.includes(lessonKey);
  return {
    lessonKey,
    title,
    titleEn: String(item?.title_en || item?.titleEn || lessonKey).trim(),
    level: levelFromTutorial(item),
    image: knownLesson
      ? LESSON_IMAGE_BY_KEY[lessonKey]
      : normalizeAssetUrl(item?.thumbnail_url || item?.video_poster || item?.image) || DEFAULT_IMAGE,
    summary: String(item?.summary || item?.description || item?.detail || "").trim(),
    keyPoint: String(item?.coach_tip || item?.mindset || item?.summary || item?.description || "").trim(),
  };
}

async function loadLessonsFromApi() {
  try {
    const response = await apiFetch("/api/tutorials");
    if (!response.ok) return;
    const payload = await response.json();
    const items = Array.isArray(payload) ? payload : (payload.items || []);
    const nextLessons = items.map(normalizeApiTutorial).filter((lesson) => lesson.lessonKey && lesson.title);
    if (nextLessons.length) {
      LESSONS = nextLessons;
    }
  } catch {
    LESSONS = [...DEFAULT_LESSONS];
  }
}

function lessonDetailUrl(lessonKey) {
  return `./tutorial-lesson.html?lesson=${encodeURIComponent(lessonKey)}`;
}

function trainingUrl(lessonKey) {
  return `./training_session.html?lesson_key=${encodeURIComponent(lessonKey)}`;
}

function calibrationUrl(lessonKey) {
  return `./calibration.html?lessonKey=${encodeURIComponent(lessonKey)}`;
}

function getGrade(score) {
  if (score === null) return { label: "미시작", tone: "idle" };
  if (score >= 90) return { label: "PERFECT", tone: "perfect" };
  if (score >= 70) return { label: "GOOD", tone: "good" };
  if (score >= 50) return { label: "보통", tone: "warning" };
  return { label: "도움 필요", tone: "bad" };
}

function renderUser() {
  const el = document.querySelector("[data-user-name]");
  if (!el) return;

  const user = getStoredUser();
  const name = user?.username || user?.nickname || user?.email || "GUEST";
  const parts = String(name).match(/[\uAC00-\uD7A3]+|[A-Za-z0-9]+|[^A-Za-z0-9\uAC00-\uD7A3]+/g) || [String(name)];
  el.innerHTML = parts
    .map((part) => {
      if (/^[\uAC00-\uD7A3]+$/.test(part)) {
        return `<span class="tut-user-name-kr">${escapeHtml(part)}</span>`;
      }
      if (/^[A-Za-z0-9]+$/.test(part)) {
        return `<span class="tut-user-name-en">${escapeHtml(part)}</span>`;
      }
      return escapeHtml(part);
    })
    .join("");
}

function renderProgress() {
  const doneCount = LESSONS.filter((lesson) => {
    const score = getStoredScore(lesson.lessonKey);
    return score !== null && score >= 70;
  }).length;

  const percent = Math.round((doneCount / LESSONS.length) * 100);
  const bar = document.querySelector("[data-progress-bar]");
  const pct = document.querySelector("[data-progress-pct]");
  const count = document.querySelector("[data-lesson-count]");
  const target = document.querySelector("[data-score-target]");
  const dots = document.querySelector("[data-progress-dots]");

  if (bar) bar.style.width = `${percent}%`;
  if (pct) pct.textContent = `${percent}%`;
  if (count) count.textContent = String(LESSONS.length);
  if (target) target.textContent = "100";

  if (dots) {
    dots.innerHTML = LESSONS
      .map((lesson) => {
        const score = getStoredScore(lesson.lessonKey);
        const done = score !== null && score >= 70;
        return `<span class="tut-dot" data-done="${done}" title="${escapeHtml(lesson.title)}"></span>`;
      })
      .join("");
  }
}

function renderPath() {
  const root = document.querySelector("[data-tutorial-path]");
  if (!root) return;

  root.innerHTML = LESSONS.map((lesson, index) => {
    const score = getStoredScore(lesson.lessonKey);
    const done = score !== null && score >= 70;
    const last = index === LESSONS.length - 1;

    return `
      <div class="tut-path-step">
        <div class="tut-path-node">
          <a class="tut-path-circle" href="${lessonDetailUrl(lesson.lessonKey)}" data-done="${done}">
            ${done ? "✓" : String(index + 1)}
          </a>
          <span class="tut-path-name">${escapeHtml(lesson.titleEn)}</span>
        </div>
        ${last ? "" : `<div class="tut-path-line" data-done="${done}"></div>`}
      </div>
    `;
  }).join("");
}

function renderGrid() {
  const root = document.querySelector("[data-tutorial-grid]");
  if (!root) return;

  root.innerHTML = LESSONS.map((lesson, index) => {
    const score = getStoredScore(lesson.lessonKey);
    const grade = getGrade(score);
    const pct = clamp(score ?? 0, 0, 100);

    return `
      <article class="lesson-card" data-lesson-key="${escapeHtml(lesson.lessonKey)}" data-level="${escapeHtml(lesson.level)}">
        <a class="lesson-card-link" href="${lessonDetailUrl(lesson.lessonKey)}" aria-label="${escapeHtml(lesson.title)} 상세 레슨 보기"></a>
        <div class="card-media">
          <img class="card-pose-img" src="${lesson.image}" alt="${escapeHtml(lesson.title)}" loading="lazy" onerror="this.src='${DEFAULT_IMAGE}'">
          <span class="card-number">${String(index + 1).padStart(2, "0")}</span>
          <span class="card-level-badge" data-level="${escapeHtml(lesson.level)}">
            ${lesson.level === "beginner" ? "초급" : lesson.level === "intermediate" ? "중급" : "고급"}
          </span>
        </div>
        <div class="card-body">
          <h2 class="card-name">
            ${escapeHtml(lesson.title)}
            <span class="card-name-en">${escapeHtml(lesson.titleEn)}</span>
          </h2>
          <p class="card-summary">${escapeHtml(lesson.keyPoint || lesson.summary)}</p>
          <div class="card-score-row">
            <div class="card-score-bar-track">
              <div class="card-score-bar-fill" style="width:${pct}%"></div>
            </div>
            <span class="card-score-label" data-has-score="${score !== null}">${score !== null ? `${score}점` : grade.label}</span>
          </div>
          <div class="card-actions">
            <a class="card-btn-main" href="${lessonDetailUrl(lesson.lessonKey)}">배우기 →</a>
            <a class="card-btn-icon" href="${calibrationUrl(lesson.lessonKey)}" aria-label="캘리브레이션">⚙</a>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

function renderLevelCounts() {
  const beginnerCount = LESSONS.filter((lesson) => lesson.level === "beginner").length;
  const intermediateCount = LESSONS.filter((lesson) => lesson.level === "intermediate").length;

  const beginnerEl = document.querySelector("[data-beginner-count]");
  const intermediateEl = document.querySelector("[data-intermediate-count]");

  if (beginnerEl) beginnerEl.textContent = String(beginnerCount);
  if (intermediateEl) intermediateEl.textContent = String(intermediateCount);
}

function renderEmptyState(level) {
  const root = document.querySelector("[data-empty-state]");
  if (!root) return;

  const isAdvanced = level === "advanced";
  root.hidden = !isAdvanced;
  root.innerHTML = isAdvanced
    ? `
      <div class="tut-empty-card">
        <p class="tut-empty-kicker">레벨 선택</p>
        <h3 class="tut-empty-title">고급 레슨 준비중</h3>
        <p class="tut-empty-desc">지금은 초급과 중급 레슨을 먼저 진행할 수 있습니다.</p>
      </div>
    `
    : "";
}

function updateActiveLevelLabel(label) {
  const el = document.querySelector("[data-active-level-label]");
  if (!el) return;
  el.innerHTML = `현재 보기 <strong>${escapeHtml(label)}</strong>`;
}

function updateHeroMessage() {
  const message = document.querySelector("[data-page-message]");
  if (!message) return;
  message.innerHTML = "기본 가드부터 어퍼컷까지,<br>6가지 동작을 순서대로 익히고 AI 피드백으로 바로 확인하세요.";
}

function bindLevelFilters() {
  const buttons = Array.from(document.querySelectorAll("[data-filter]"));
  if (!buttons.length) return;

  const cards = Array.from(document.querySelectorAll("[data-tutorial-grid] .lesson-card"));

  function setAllVisible() {
    cards.forEach((card) => {
      card.style.display = "";
    });
  }

  function applyFilter(level) {
    cards.forEach((card) => {
      card.style.display = card.dataset.level === level ? "" : "none";
    });
    renderEmptyState(level);
  }

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      if (button.disabled) return;

      const wasActive = button.classList.contains("is-active");
      buttons.forEach((item) => item.classList.remove("is-active"));

      if (wasActive) {
        setAllVisible();
        updateActiveLevelLabel("전체 레슨");
        renderEmptyState("");
        return;
      }

      button.classList.add("is-active");
      applyFilter(button.dataset.filter);
      updateActiveLevelLabel(
        button.dataset.filter === "beginner" ? "초급" :
        button.dataset.filter === "intermediate" ? "중급" : "고급"
      );
    });
  });
}

function bindLogout() {
  const button = document.querySelector("[data-logout-button]");
  if (!button) return;

  button.addEventListener("click", () => {
    clearSession();
    window.location.href = "/index.html";
  });
}

async function renderAll() {
  await loadLessonsFromApi();
  updateHeroMessage();
  renderUser();
  renderProgress();
  renderLevelCounts();
  renderGrid();
  renderPath();
  updateActiveLevelLabel("전체 레슨");
  renderEmptyState("");
  bindLevelFilters();
}

document.addEventListener("DOMContentLoaded", renderAll);

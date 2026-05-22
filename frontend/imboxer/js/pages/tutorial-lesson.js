import { clearSession, getStoredUser, refreshCurrentUser } from "../core/auth.js";
import "../engine/PoseAnalyzer.js";
import "../engine/MediaPipePoseTracker.js?v=20260512-local-vendor-path";
import "../engine/ThresholdManager.js";

const CAMERA_SETTINGS_KEY = "im_boxer_camera_settings";

/* ── Lesson data (source of truth for all Korean copy) ─ */
const LESSON_DATA = [
  {
    lessonKey: "basic-guard",
    title: "기본 가드",
    titleEn: "GUARD STANCE",
    summary: "양손을 얼굴 가까이 두고 턱, 어깨, 중심을 안정적으로 유지하는 출발 자세.",
    keyPoint: "양 주먹을 턱 높이에, 팔꿈치는 갈비뼈 쪽으로",
    goals:    ["양손이 얼굴 가까이에 있다", "팔꿈치가 과하게 벌어지지 않는다", "상체 중심이 좌우로 크게 무너지지 않는다"],
    mistakes: ["손이 턱 아래로 내려감", "한쪽 어깨가 크게 떨어짐", "카메라에서 몸이 너무 멀거나 가까움"],
    checks:   ["정면에서 상반신이 보이게 서기", "양손과 얼굴이 화면 안에 들어오게 맞추기", "2초 이상 같은 자세 유지하기"],
    scoreNote: "손-얼굴 거리와 팔꿈치 각도가 핵심입니다.",
    tip:      "캘리브레이션을 먼저 완료하면 내 Threshold가 훈련에 그대로 적용됩니다.",
  },
  {
    lessonKey: "jab",
    title: "잽",
    titleEn: "JAB",
    summary: "앞손을 빠르게 뻗고, 반대손은 얼굴 가드 위치에 남긴 뒤 즉시 복귀.",
    keyPoint: "앞손 뻗는 동안 반대손은 절대 내리지 말 것",
    goals:    ["앞손이 충분히 뻗어진다", "반대손은 얼굴 가까이 남아 있다", "타격 후 가드로 빠르게 돌아온다"],
    mistakes: ["반대손 가드가 내려감", "팔만 뻗고 어깨와 손목이 따라오지 않음", "몸이 앞으로 무너짐"],
    checks:   ["기본 가드에서 시작하기", "앞손만 뻗고 뒷손은 얼굴 옆 유지하기", "동작 끝에서 1초 멈춰 기준 확인"],
    scoreNote: "반대손 가드 유지가 통과 조건에 포함됩니다.",
    tip:      "잽은 반대손이 내려가면 PoseAnalyzer가 성공으로 처리하지 않습니다.",
  },
  {
    lessonKey: "cross",
    title: "크로스",
    titleEn: "CROSS",
    summary: "뒷손을 뻗으며 골반과 어깨 회전을 함께 사용하고, 중심은 무너지지 않게 유지.",
    keyPoint: "팔이 아닌 골반 회전이 먼저, 앞손 가드는 끝까지",
    goals:    ["뒷손이 몸 중앙을 지나 앞으로 뻗어진다", "어깨와 골반 회전이 함께 나온다", "앞손 가드가 얼굴 근처에 남아 있다"],
    mistakes: ["팔만 뻗고 몸통 회전이 없음", "앞손이 같이 내려감", "상체가 과하게 앞으로 쏠림"],
    checks:   ["발은 넓게 고정하기", "뒷어깨가 앞으로 따라오게 회전하기", "타격 후 정면 가드로 복귀"],
    scoreNote: "회전과 가드 유지가 같이 맞아야 높은 점수.",
    tip:      "거리만 맞고 자세가 무너지면 100점이 제한됩니다.",
  },
  {
    lessonKey: "left-hook",
    title: "레프트 훅",
    titleEn: "LEFT HOOK",
    summary: "왼팔 각도를 유지한 채 몸통 회전으로 짧고 둥글게 치는 동작.",
    keyPoint: "팔꿈치를 90° 접고 짧게 — 스윙하면 감점",
    goals:    ["팔꿈치 각도가 훅 형태를 만든다", "손이 얼굴 높이 근처를 지난다", "회전 후 중심이 옆으로 무너지지 않는다"],
    mistakes: ["팔을 너무 펴서 스윙처럼 변함", "손이 어깨 아래로 떨어짐", "회전이 너무 커서 자세가 열림"],
    checks:   ["팔꿈치를 살짝 접은 상태로 시작하기", "손보다 몸통 회전을 먼저 만들기", "끝 자세에서 반대손 가드 확인"],
    scoreNote: "팔꿈치 각도와 손 높이가 핵심 기준.",
    tip:      "훅은 크게 휘두르는 것보다 짧고 안정적인 동작이 좋습니다.",
  },
  {
    lessonKey: "slip",
    title: "슬립",
    titleEn: "SLIP",
    summary: "머리와 상체를 짧게 빼서 공격선을 피하고, 양손 가드는 유지.",
    keyPoint: "머리는 조금만, 가드는 끝까지 — 크게 피하면 역효과",
    goals:    ["머리가 중앙선에서 벗어난다", "상체 기울기가 과하지 않다", "양손이 얼굴 근처를 유지한다"],
    mistakes: ["허리만 크게 꺾음", "손이 내려가며 피함", "발과 중심이 같이 무너짐"],
    checks:   ["가드 상태에서 시작하기", "머리만 살짝 옆으로 빼기", "피한 뒤 바로 원래 가드로 돌아오기"],
    scoreNote: "과한 기울기는 감점, 슬립 중 가드 유지가 핵심.",
    tip:      "슬립 중에도 가드가 유지되어야 좋은 점수가 나옵니다.",
  },
  {
    lessonKey: "uppercut",
    title: "어퍼컷",
    titleEn: "UPPERCUT",
    summary: "무릎 반동과 짧은 팔 궤적으로 아래에서 위로 올려 치는 동작.",
    keyPoint: "무릎 반동으로 시작, 팔꿈치는 몸 가까이 — 백스윙 금지",
    goals:    ["손이 아래에서 위로 올라간다", "팔꿈치가 몸에서 너무 멀어지지 않는다", "반대손 가드가 얼굴 근처에 남아 있다"],
    mistakes: ["팔을 크게 뒤로 빼고 시작함", "상체가 뒤로 젖혀짐", "가드 손이 같이 내려감"],
    checks:   ["짧게 앉았다 올라오기", "손은 몸 가까이에서 올리기", "끝 자세에서 턱과 반대손 가드 확인"],
    scoreNote: "위쪽 방향성, 팔꿈치 거리, 반대손 가드가 같이 맞아야 합니다.",
    tip:      "큰 동작보다 짧고 빠른 동작이 안정적으로 인식됩니다.",
  },
];

const LESSON_KEYS = LESSON_DATA.map((l) => l.lessonKey);
const SCORE_KEY_PREFIX = "im_boxer_lesson_score_";
const TICK_INTERVAL_MS = 1000;
const GUIDE_AUDIO_BASE = "./assets/sounds/training_guide/";
const GUIDE_VIDEO_URL = "./assets/videos/tutorials/tutorial_guide.mp4?v=20260508-h264-video";
const GUIDE_VIDEO_ABSOLUTE_URL = new URL(GUIDE_VIDEO_URL, window.location.href).href;
const GUIDE_AUDIO_FILES = {
  "basic-guard": "guide_guard.mp3",
  jab: "guide_jab.mp3",
  cross: "guide_cross.mp3",
  "left-hook": "guide_hook.mp3",
  slip: "guide_slip.mp3",
  uppercut: "guide_uppercut.mp3",
};

const GUIDE_COACH_SCRIPTS = {
  "basic-guard": {
    title: "기본 자세 코칭",
    lines: [
      "기본 자세가 가장 중요합니다.",
      "발은 어깨너비보다 조금 넓게 벌리고, 무릎을 살짝 굽히세요.",
      "턱을 살짝 당기고, 양 팔꿈치는 몸에 붙입니다.",
      "앞손은 눈 높이, 뒷손은 턱 바로 옆에 두세요.",
    ],
  },
  jab: {
    title: "잽 코칭",
    lines: [
      "이제 잽을 날려보겠습니다.",
      "앞손을 직선으로 빠르게 뻗으면서 주먹을 회전시켜주세요.",
      "너클이 수평이 되도록 만들고, 팔이 펴지는 순간까지 집중합니다.",
      "뒷손은 항상 얼굴을 지키고, 바로 기본 자세로 돌아옵니다.",
    ],
  },
  cross: {
    title: "크로스 코칭",
    lines: [
      "이번엔 크로스입니다.",
      "뒷발 뒤꿈치를 바깥쪽으로 돌리며 골반과 어깨를 함께 회전하세요.",
      "뒷손을 직선으로 힘껏 뻗고, 너클을 수평으로 맞춥니다.",
      "타격 후에는 앞손으로 얼굴을 보호하며 기본 자세로 복귀하세요.",
    ],
  },
  "left-hook": {
    title: "훅 코칭",
    lines: [
      "이제 훅을 연습해보겠습니다.",
      "팔꿈치를 90도 정도로 유지한 채 수평으로 휘둘러주세요.",
      "어깨와 골반을 함께 회전시키며 주먹이 곡선을 그리게 합니다.",
      "타격 순간 손목은 단단하게 고정하고, 끝나면 바로 가드로 복귀하세요.",
    ],
  },
  slip: {
    title: "슬립 코칭",
    lines: [
      "이번엔 방어 동작 슬립입니다.",
      "기본 자세를 유지한 채 상체를 부드럽게 좌우로 움직이세요.",
      "머리는 살짝 원을 그리듯 피하고, 양손은 얼굴을 보호합니다.",
      "눈은 정면을 보고, 무릎은 살짝 굽힌 상태로 균형을 잡아주세요.",
    ],
  },
  uppercut: {
    title: "어퍼컷 코칭",
    lines: [
      "이제 어퍼컷을 배워보겠습니다.",
      "무릎을 살짝 더 굽혔다가 올라오며 아래에서 위로 펀치를 올리세요.",
      "팔꿈치는 굽힌 상태로 유지하고, 주먹은 몸 중앙에서 수직에 가깝게 올라갑니다.",
      "타격 후에는 바로 기본 가드로 복귀합니다.",
    ],
  },
};

/* ── State ─────────────────────────────────────────────── */
const state = {
  lessonKey:    "basic-guard",
  lessonIndex:  0,
  lesson:       LESSON_DATA[0],
  webcamReady:  false,
  webcamStream: null,
  practicing:   false,
  score:        0,
  accuracy:     0,
  feedback:     [],
  tickId:       0,
  frameId:      0,
  poseTracker:  null,
  poseAnalyzer: null,
  poseLandmarks: null,
  lastSnapshot: null,
  guideAudio: null,
  ui:           {},
};

/* ── Helpers ────────────────────────────────────────────── */
function continueAsGuest() {
  state.user = null;
}

function bindLogoutButton() {
  document.querySelector("[data-logout-button]")?.addEventListener("click", () => {
    clearSession();
    window.location.href = "/index.html";
  });
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

function normalizeLessonKey(raw) {
  const key = String(raw || "").trim();
  if (key === "guard" || key === "basic-guard" || key === "beginner-basic-guard") return "basic-guard";
  if (key === "hook") return "left-hook";
  return LESSON_KEYS.includes(key) ? key : "basic-guard";
}

function trainingUrl(lessonKey) {
  return `./training_session.html?lesson_key=${encodeURIComponent(normalizeLessonKey(lessonKey))}`;
}

function calibrationUrl(lessonKey) {
  return `./calibration.html?lessonKey=${encodeURIComponent(lessonKey)}`;
}

function lessonHubUrl(lessonKey) {
  return `./tutorial-lesson.html?lesson=${encodeURIComponent(lessonKey)}`;
}

function guideAudioUrl(lessonKey) {
  const normalized = normalizeLessonKey(lessonKey);
  const fileName = GUIDE_AUDIO_FILES[normalized] || GUIDE_AUDIO_FILES["basic-guard"];
  return `${GUIDE_AUDIO_BASE}${fileName}`;
}

function getGrade(score) {
  if (score >= 90) return { label: "PERFECT", key: "perfect", color: "var(--t-yellow)" };
  if (score >= 70) return { label: "GOOD",    key: "good",    color: "var(--t-green)" };
  if (score >= 50) return { label: "보통",     key: "warning", color: "var(--t-orange)" };
  return              { label: "개선 필요",    key: "bad",     color: "var(--t-red)" };
}

function escapeHtml(v) {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function saveBestScore(lessonKey, score) {
  try {
    const prev = Number(window.localStorage.getItem(SCORE_KEY_PREFIX + lessonKey) || 0);
    if (score > prev) {
      window.localStorage.setItem(SCORE_KEY_PREFIX + lessonKey, String(score));
    }
  } catch { /* ignore */ }
}

function getPoseImagePaths(lessonKey) {
  if (lessonKey === "basic-guard") {
    return {
      good: "./assets/images/tutorials/guard_right.png",
      bad: "./assets/images/tutorials/guard_wrong.png",
    };
  }

  return {
    good: `./assets/poses/${encodeURIComponent(lessonKey)}-good.svg`,
    bad: `./assets/poses/${encodeURIComponent(lessonKey)}-bad.svg`,
  };
}

function getPoseMediaConfig(lessonKey, variant) {
  if (lessonKey === "basic-guard") {
    return {
      type: "img",
      src: variant === "good"
        ? "./assets/images/tutorials/guard_right.png"
        : "./assets/images/tutorials/guard_wrong.png",
    };
  }

  if (lessonKey === "jab" && variant === "good") {
    return {
      type: "video",
      src: "./assets/images/tutorials/jab_right.mp4",
    };
  }

  if (lessonKey === "jab" && variant === "bad") {
    return {
      type: "hover-video",
      src: "./assets/images/tutorials/jab_wrong..mp4",
    };
  }

  if (lessonKey === "cross" && variant === "good") {
    return {
      type: "sequence-video",
      srcs: [
        "./assets/images/tutorials/cross_right.mp4",
        "./assets/images/tutorials/cross_right_1.mp4",
      ],
    };
  }

  if (lessonKey === "cross" && variant === "bad") {
    return {
      type: "hover-video",
      src: "./assets/images/tutorials/cross_wrong.mp4",
    };
  }

  if (lessonKey === "left-hook" && variant === "good") {
    return {
      type: "sequence-video",
      srcs: [
        "./assets/images/tutorials/left_hook_right_1.mp4",
        "./assets/images/tutorials/left_hook_right_2.mp4",
        "./assets/images/tutorials/left_hook_right_3.mp4",
      ],
    };
  }

  if (lessonKey === "left-hook" && variant === "bad") {
    return {
      type: "hover-video",
      src: "./assets/images/tutorials/left_hook_wrong.mp4",
    };
  }

  if (lessonKey === "slip" && variant === "good") {
    return {
      type: "video",
      src: "./assets/images/tutorials/slip_right.mp4",
    };
  }

  if (lessonKey === "slip" && variant === "bad") {
    return {
      type: "hover-video",
      src: "./assets/images/tutorials/slip_wrong.mp4",
    };
  }

  if (lessonKey === "uppercut" && variant === "good") {
    return {
      type: "sequence-video",
      srcs: [
        "./assets/images/tutorials/uppercut_right_1.mp4",
        "./assets/images/tutorials/uppercut_right_2.mp4",
        "./assets/images/tutorials/uppercut_right_3.mp4",
      ],
    };
  }

  if (lessonKey === "uppercut" && variant === "bad") {
    return {
      type: "hover-video",
      src: "./assets/images/tutorials/uppercut_wrong.mp4",
    };
  }

  return {
    type: "img",
    src: `./assets/poses/${encodeURIComponent(lessonKey)}-${variant}.svg`,
  };
}

async function buildVideoPosterFromFirstFrame(src) {
  return await new Promise((resolve) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.crossOrigin = "anonymous";
    video.src = src;

    const cleanup = () => {
      video.removeAttribute("src");
      video.load();
    };

    video.addEventListener("error", () => {
      cleanup();
      resolve(null);
    }, { once: true });

    video.addEventListener("loadeddata", () => {
      const capture = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, video.videoWidth || 1);
          canvas.height = Math.max(1, video.videoHeight || 1);
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            cleanup();
            resolve(null);
            return;
          }
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/png");
          cleanup();
          resolve(dataUrl);
        } catch {
          cleanup();
          resolve(null);
        }
      };

      try {
        video.currentTime = 0;
      } catch {
        capture();
      }
    }, { once: true });

    video.addEventListener("seeked", () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, video.videoWidth || 1);
        canvas.height = Math.max(1, video.videoHeight || 1);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          cleanup();
          resolve(null);
          return;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/png");
        cleanup();
        resolve(dataUrl);
      } catch {
        cleanup();
        resolve(null);
      }
    }, { once: true });

    video.load();
  });
}

function renderPoseMedia(container, lessonKey, variant, altText) {
  if (!container) return;

  const media = getPoseMediaConfig(lessonKey, variant);

  if (media.type === "video") {
    container.innerHTML = `
      <video class="tl-pose-img" autoplay muted loop playsinline preload="metadata">
        <source src="${media.src}" type="video/mp4">
      </video>
    `;
  } else if (media.type === "hover-video") {
    container.innerHTML = `
      <div class="tl-pose-hover-shell">
        <img class="tl-pose-img" alt="${altText}">
        <video class="tl-pose-img" muted playsinline preload="metadata">
          <source src="${media.src}" type="video/mp4">
        </video>
      </div>
    `;

    const shell = container.querySelector(".tl-pose-hover-shell");
    const posterImg = container.querySelector("img");
    const video = container.querySelector("video");
    if (posterImg && media.src) {
      void buildVideoPosterFromFirstFrame(media.src).then((poster) => {
        if (poster) posterImg.src = poster;
      });
    }

    if (shell && video) {
      const playVideo = () => {
        posterImg && (posterImg.style.opacity = "0");
        video.style.opacity = "1";
        void video.play().catch(() => {});
      };
      const pauseVideo = () => {
        video.pause();
        try {
          video.currentTime = 0;
        } catch {
          // ignore
        }
        video.style.opacity = "0";
        posterImg && (posterImg.style.opacity = "1");
      };

      video.style.opacity = "0";
      video.style.transition = "opacity .18s ease";
      posterImg && (posterImg.style.transition = "opacity .18s ease");

      shell.addEventListener("mouseenter", playVideo);
      shell.addEventListener("mouseleave", pauseVideo);
      shell.addEventListener("focusin", playVideo);
      shell.addEventListener("focusout", pauseVideo);
    }
  } else if (media.type === "sequence-video") {
    const [firstSrc, secondSrc] = media.srcs || [];
    container.innerHTML = `
      <video class="tl-pose-img" autoplay muted playsinline preload="metadata"></video>
    `;

    const video = container.querySelector("video");
    if (video && firstSrc) {
      const sources = [firstSrc, secondSrc].filter(Boolean);
      let sourceIndex = 0;

      const loadCurrent = () => {
        video.src = sources[sourceIndex];
        video.load();
      };

      video.addEventListener("ended", () => {
        if (sourceIndex < sources.length - 1) {
          sourceIndex += 1;
          loadCurrent();
          void video.play().catch(() => {});
        } else {
          sourceIndex = 0;
          loadCurrent();
          void video.play().catch(() => {});
        }
      });

      loadCurrent();
      void video.play().catch(() => {});
    }
  } else {
    container.innerHTML = `
      <img class="tl-pose-img" src="${media.src}" alt="${altText}">
    `;
  }
}

/* ── UI helpers ─────────────────────────────────────────── */
function setText(el, text) {
  if (el) el.textContent = text;
}

function setHidden(el, hidden) {
  if (!el) return;
  el.hidden = hidden;
  el.style.display = hidden ? "none" : "";
}

/* ── Render study panel ─────────────────────────────────── */
function getGuideCoachScript(lessonKey = state.lessonKey) {
  const normalized = normalizeLessonKey(lessonKey);
  return GUIDE_COACH_SCRIPTS[normalized] || GUIDE_COACH_SCRIPTS["basic-guard"];
}

function ensureGuideVideoSource() {
  const video = state.ui.guideVideo;
  if (!video) return null;

  if (video.currentSrc !== GUIDE_VIDEO_ABSOLUTE_URL && video.src !== GUIDE_VIDEO_ABSOLUTE_URL) {
    video.src = GUIDE_VIDEO_ABSOLUTE_URL;
    video.load();
  }

  return video;
}

function waitForGuideVideoReady(video) {
  if (!video) return Promise.resolve();
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      video.removeEventListener("loadedmetadata", finish);
      video.removeEventListener("loadeddata", finish);
      video.removeEventListener("canplay", finish);
      video.removeEventListener("error", finish);
      resolve();
    };

    video.addEventListener("loadedmetadata", finish, { once: true });
    video.addEventListener("loadeddata", finish, { once: true });
    video.addEventListener("canplay", finish, { once: true });
    video.addEventListener("error", finish, { once: true });
    window.setTimeout(finish, 1200);
  });
}

async function playGuideVideo() {
  const video = ensureGuideVideoSource();
  if (!video) return;

  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  await waitForGuideVideoReady(video);

  try {
    video.currentTime = 0;
  } catch {
    // Metadata can still be unavailable in some browsers; playback can continue from the current frame.
  }

  await video.play().catch((error) => {
    console.warn("guide video playback failed", {
      src: video.currentSrc || video.src,
      networkState: video.networkState,
      readyState: video.readyState,
      error,
    });
  });
  window.setTimeout(() => {
    if (video.paused) {
      void video.play().catch(() => {});
    }
  }, 120);
}

function renderGuideCoachModal() {
  const script = getGuideCoachScript();
  setText(state.ui.guideModalTitle, script.title);
  if (state.ui.guideModalScript) {
    state.ui.guideModalScript.innerHTML = script.lines
      .map((line) => `<span class="tl-guide-script-line">${escapeHtml(line)}</span>`)
      .join("");
  }
  ensureGuideVideoSource();
}

function openGuideCoachModal() {
  renderGuideCoachModal();
  if (state.ui.guideModal) {
    state.ui.guideModal.dataset.open = "true";
    state.ui.guideModal.setAttribute("aria-hidden", "false");
  }
  void playGuideVideo();
}

function closeGuideCoachModal() {
  if (state.ui.guideModal) {
    delete state.ui.guideModal.dataset.open;
    state.ui.guideModal.setAttribute("aria-hidden", "true");
  }
  if (state.ui.guideVideo) {
    state.ui.guideVideo.pause();
    try {
      state.ui.guideVideo.currentTime = 0;
    } catch {
      // Ignore reset failures while the browser is still resolving the MP4 metadata.
    }
  }
}

function updateGuideAudioButton(isPlaying = false) {
  const sideText = isPlaying ? "■ 가이드 정지" : "▶ 가이드 재생";
  if (state.ui.guideAudioToggle) {
    state.ui.guideAudioToggle.dataset.playing = isPlaying ? "true" : "false";
    state.ui.guideAudioToggle.textContent = sideText;
  }
  if (state.ui.guideModalAudioToggle) {
    state.ui.guideModalAudioToggle.dataset.playing = isPlaying ? "true" : "false";
    state.ui.guideModalAudioToggle.textContent = isPlaying ? "음성 정지" : "음성 재생";
  }
}

function stopGuideAudio() {
  if (state.guideAudio) {
    state.guideAudio.pause();
    state.guideAudio.currentTime = 0;
  }
  updateGuideAudioButton(false);
}

function ensureGuideAudio() {
  const src = guideAudioUrl(state.lessonKey);
  if (!state.guideAudio) {
    state.guideAudio = new Audio(src);
    state.guideAudio.preload = "metadata";
    state.guideAudio.addEventListener("ended", () => updateGuideAudioButton(false));
  }

  const currentSrc = state.guideAudio.getAttribute("src") || "";
  if (!currentSrc.endsWith(src)) {
    state.guideAudio.pause();
    state.guideAudio.src = src;
    state.guideAudio.load();
  }
  return state.guideAudio;
}

async function toggleGuideAudio() {
  const audio = ensureGuideAudio();
  if (!audio.paused && !audio.ended) {
    stopGuideAudio();
    return;
  }

  try {
    openGuideCoachModal();
    audio.currentTime = 0;
    await audio.play();
    updateGuideAudioButton(true);
  } catch {
    updateGuideAudioButton(false);
  }
}

function renderStudy() {
  const { lesson, lessonIndex } = state;
  const total = LESSON_DATA.length;
  const stepText = `STEP ${String(lessonIndex + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
  const pct = ((lessonIndex + 1) / total) * 100;

  setText(state.ui.stepLabel,         stepText);
  setText(state.ui.lessonTitleStrip,  lesson.title);
  setText(state.ui.studyTitle,        lesson.title);
  setText(state.ui.studyTitleEn,      lesson.titleEn);
  setText(state.ui.studySummary,      lesson.summary);
  setText(state.ui.keyPoint,          lesson.keyPoint);
  setText(state.ui.scoreNote,         lesson.scoreNote);
  setText(state.ui.tipText,           lesson.tip);

  if (state.ui.lessonProgress) {
    state.ui.lessonProgress.style.width = `${pct}%`;
  }

  renderPoseMedia(state.ui.goodPoseMedia, lesson.lessonKey, "good", `${lesson.title} 올바른 자세`);
  renderPoseMedia(state.ui.badPoseMedia, lesson.lessonKey, "bad", `${lesson.title} 흔한 실수`);

  if (state.ui.goodPoints) {
    state.ui.goodPoints.innerHTML = lesson.goals
      .map((g) => `<li class="tl-pose-point"><span class="tl-pose-point-dot"></span>${escapeHtml(g)}</li>`)
      .join("");
  }
  if (state.ui.badPoints) {
    state.ui.badPoints.innerHTML = lesson.mistakes
      .map((m) => `<li class="tl-pose-point"><span class="tl-pose-point-dot"></span>${escapeHtml(m)}</li>`)
      .join("");
  }

  if (state.ui.checkList) {
    state.ui.checkList.innerHTML = lesson.checks
      .map((c) => `
        <div class="tl-check-item">
          <div class="tl-check-icon"></div>
          ${escapeHtml(c)}
        </div>
      `)
      .join("");
  }

  // Navigation links
  const prevLesson = lessonIndex > 0 ? LESSON_DATA[lessonIndex - 1] : null;
  const nextLesson = lessonIndex < LESSON_DATA.length - 1 ? LESSON_DATA[lessonIndex + 1] : null;

  if (state.ui.prevLink) {
    if (prevLesson) {
      state.ui.prevLink.href = lessonHubUrl(prevLesson.lessonKey);
      state.ui.prevLink.removeAttribute("hidden");
    } else {
      state.ui.prevLink.setAttribute("hidden", "");
    }
  }
  if (state.ui.nextLink) {
    if (nextLesson) {
      state.ui.nextLink.href = lessonHubUrl(nextLesson.lessonKey);
      state.ui.nextLink.removeAttribute("hidden");
    } else {
      state.ui.nextLink.setAttribute("hidden", "");
    }
  }

  // Train / calibration links
  if (state.ui.trainLink) {
    state.ui.trainLink.href = trainingUrl(lesson.lessonKey);
  }
  if (state.ui.guideAudioToggle) {
    updateGuideAudioButton(false);
  }
  renderGuideCoachModal();

  document.title = `IM_BOXER | ${lesson.title}`;
}

/* ── Render score donut ─────────────────────────────────── */
function renderScore() {
  const { score, practicing } = state;

  if (!practicing) {
    if (state.ui.scoreDonut) {
      state.ui.scoreDonut.style.setProperty("--donut-pct", "0%");
      state.ui.scoreDonut.style.setProperty("--donut-color", "rgba(255,255,255,0.08)");
    }
    setText(state.ui.scoreNumber, "—");
    if (state.ui.scoreGrade) {
      state.ui.scoreGrade.textContent = "대기 중";
      state.ui.scoreGrade.dataset.grade = "idle";
    }
    setText(state.ui.scoreMeta, "카메라 연결 후 분석이 시작됩니다");
    return;
  }

  const pct = clamp(Math.round(score), 0, 100);
  const grade = getGrade(pct);

  if (state.ui.scoreDonut) {
    state.ui.scoreDonut.style.setProperty("--donut-pct", `${pct * 3.6 / 360 * 100}%`);
    state.ui.scoreDonut.style.setProperty("--donut-color", grade.color);
  }
  setText(state.ui.scoreNumber, String(pct));
  if (state.ui.scoreGrade) {
    state.ui.scoreGrade.textContent = grade.label;
    state.ui.scoreGrade.dataset.grade = grade.key;
  }
  setText(state.ui.scoreMeta, `${state.lesson.title} 자세 분석 중`);

  if (pct > 0) {
    saveBestScore(state.lessonKey, pct);
  }
}

/* ── Render feedback list ───────────────────────────────── */
function renderFeedback() {
  if (!state.ui.feedbackList) return;

  if (state.feedback.length === 0) {
    state.ui.feedbackList.innerHTML = '<div class="tl-feedback-empty">자세가 감지되면 피드백이 여기에 표시됩니다.</div>';
    return;
  }

  state.ui.feedbackList.innerHTML = state.feedback
    .slice(0, 5)
    .map((item) => `
      <div class="tl-feedback-item" data-tone="${escapeHtml(item.tone || "info")}">
        <span class="tl-feedback-dot"></span>
        ${escapeHtml(item.message)}
      </div>
    `)
    .join("");
}

function pushFeedback(message, tone = "info") {
  if (!message) return;
  if (state.feedback[0]?.message === message) return;
  state.feedback.unshift({ message, tone, at: Date.now() });
  state.feedback = state.feedback.slice(0, 8);
  renderFeedback();
}

/* ── Webcam ─────────────────────────────────────────────── */
function setWebcamStatus(text) {
  setText(state.ui.webcamStatus, text);
}

function setFallbackVisible(visible) {
  setHidden(state.ui.webcamFallback, !visible);
}

function getCameraSupportNote() {
  const parts = [];
  parts.push(window.isSecureContext ? "보안 컨텍스트 OK" : "보안 컨텍스트 아님");
  parts.push(navigator.mediaDevices?.getUserMedia ? "카메라 API 지원" : "카메라 API 미지원");
  return parts.join(" / ");
}

async function getCameraPermissionState() {
  try {
    if (!navigator.permissions?.query) {
      return null;
    }
    const status = await navigator.permissions.query({ name: "camera" });
    return status?.state || null;
  } catch {
    return null;
  }
}

function describeCameraError(error) {
  const name = error?.name || "";
  const message = error?.message || "";

  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "카메라 권한이 거부되었습니다. 주소창 왼쪽 카메라 아이콘에서 허용으로 바꿔주세요.";
  }
  if (name === "NotFoundError") {
    return "카메라 장치를 찾지 못했습니다. 웹캠이 연결되어 있는지 확인해 주세요.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "카메라가 다른 앱에서 사용 중이거나 잠겨 있습니다.";
  }
  if (name === "OverconstrainedError") {
    return "카메라 해상도 조건이 맞지 않습니다. 더 낮은 해상도로 다시 시도합니다.";
  }
  if (name === "SecurityError") {
    return "보안 설정 때문에 카메라에 접근할 수 없습니다.";
  }
  if (message) {
    return `카메라 접근 실패: ${message}`;
  }
  return "카메라 접근에 실패했습니다.";
}

function waitForVideoReady(videoElement, timeoutMs = 3000) {
  if (!videoElement) {
    return Promise.resolve(false);
  }

  if (videoElement.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && videoElement.videoWidth > 0) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      videoElement.removeEventListener("loadedmetadata", onReady);
      videoElement.removeEventListener("loadeddata", onReady);
      videoElement.removeEventListener("canplay", onReady);
      clearTimeout(timer);
      resolve(value);
    };

    const onReady = () => {
      if (videoElement.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && videoElement.videoWidth > 0) {
        finish(true);
      }
    };

    const timer = window.setTimeout(() => finish(false), timeoutMs);

    videoElement.addEventListener("loadedmetadata", onReady, { once: true });
    videoElement.addEventListener("loadeddata", onReady, { once: true });
    videoElement.addEventListener("canplay", onReady, { once: true });

    onReady();
  });
}

function stopWebcam() {
  if (state.webcamStream) {
    state.webcamStream.getTracks().forEach((t) => t.stop());
    state.webcamStream = null;
  }
  state.webcamReady = false;
  if (state.ui.webcamVideo) state.ui.webcamVideo.srcObject = null;
  stopPoseTracker();
}

function stopPoseTracker() {
  state.poseTracker?.stop?.();
  state.poseLandmarks = null;
  const overlay = window.IM_BOXER_POSE_OVERLAY;
  if (overlay && state.ui.overlayCanvas) overlay.clear(state.ui.overlayCanvas);
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
  if (!state.ui.webcamVideo) return null;
  state.poseTracker = window.IM_BOXER_POSE_TRACKER || state.poseTracker || null;
  if (!state.poseTracker?.start) return null;

  try {
    await state.poseTracker.start(state.ui.webcamVideo, {
      lessonKey: state.lessonKey,
      onStatus(msg) { if (msg) setWebcamStatus(msg); },
      onResult(landmarks) {
        const overlay = window.IM_BOXER_POSE_OVERLAY;
        if (overlay && state.ui.overlayCanvas) {
          if (getCameraSettings().overlay) {
            overlay.draw(state.ui.overlayCanvas, landmarks, state.ui.webcamVideo);
          } else {
            overlay.hide?.(state.ui.overlayCanvas);
          }
        }
      },
      onError(err) { console.warn("pose tracker:", err); },
    });
    return state.poseTracker;
  } catch (err) {
    console.warn("pose tracker init failed:", err);
    return null;
  }
}

async function startWebcam() {
  if (state.webcamReady) return true;
  if (!navigator.mediaDevices?.getUserMedia) {
    setWebcamStatus("이 브라우저는 카메라를 지원하지 않습니다.");
    return false;
  }

  const permissionState = await getCameraPermissionState();
  const supportNote = getCameraSupportNote();
  setWebcamStatus(permissionState ? `카메라 상태: ${permissionState}` : "카메라 연결 중...");
  try {
    const cameraSettings = applyCameraVisualSettings();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: cameraSettings.mode }, width: { ideal: 1280 }, height: { ideal: 720 } },
    });
    state.webcamStream = stream;
    state.webcamReady = true;
    if (state.ui.webcamVideo) {
      applyCameraVisualSettings();
      state.ui.webcamVideo.srcObject = stream;
      state.ui.webcamVideo.playsInline = true;
      state.ui.webcamVideo.muted = true;
      try { await state.ui.webcamVideo.play(); } catch { /* ok */ }
      await waitForVideoReady(state.ui.webcamVideo);
    }
    setFallbackVisible(false);
    setWebcamStatus("자세 감지 중");
    pushFeedback("카메라 연결 완료. 자세를 맞춰보세요.", "success");
    pushFeedback(supportNote, "info");
    const tracker = await ensurePoseTracker();
    if (!tracker) {
      const trackerError = window.IM_BOXER_POSE_TRACKER_ERROR;
      if (trackerError) {
        setWebcamStatus(`자세 분석 실패: ${trackerError}`);
        pushFeedback(`MediaPipe 로딩 실패: ${trackerError}`, "danger");
        console.error("MediaPipe tracker error:", trackerError);
      } else {
        setWebcamStatus("기본 분석 중");
        pushFeedback("자세 추적 모델은 준비 중입니다. 기본 분석으로 진행합니다.", "warning");
      }
    }
    return true;
  } catch (error) {
    state.webcamReady = false;
    setFallbackVisible(true);
    const cameraErrorText = describeCameraError(error);
    setWebcamStatus(cameraErrorText);
    pushFeedback(cameraErrorText, "danger");
    if (permissionState === "prompt") {
      pushFeedback("브라우저가 권한 창을 띄우지 않았다면 주소창의 카메라 아이콘을 확인해 주세요.", "warning");
    }
    return false;
  }
}

/* ── Practice tick loop ─────────────────────────────────── */
function applySnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return false;

  if (snapshot.accuracy !== undefined) {
    state.accuracy = clamp(Number(snapshot.accuracy) || 0, 0, 100);
    state.score = state.accuracy;
  } else if (snapshot.score !== undefined) {
    state.score = clamp(Number(snapshot.score) || 0, 0, 100);
    state.accuracy = state.score;
  }

  const msgs = Array.isArray(snapshot.feedback)
    ? snapshot.feedback
    : Array.isArray(snapshot.issues)
      ? snapshot.issues
      : [];

  msgs.forEach((m) => {
    if (typeof m === "string") pushFeedback(m, snapshot.feedbackTone || "info");
    else if (m?.message) pushFeedback(m.message, m.tone || "info");
  });

  if (snapshot.coachMessage || snapshot.message) {
    pushFeedback(String(snapshot.coachMessage || snapshot.message), "info");
  }

  state.lastSnapshot = { ...snapshot };
  return true;
}

function tick() {
  if (!state.practicing || !state.webcamReady) return;

  state.poseLandmarks = state.poseTracker?.getLatestLandmarks?.() || null;

  const analyzer = state.poseAnalyzer || window.IM_BOXER_POSE_ANALYZER;
  if (typeof analyzer === "function") {
    try {
      const snapshot = analyzer({
        now: performance.now(),
        video: state.ui.webcamVideo,
        poseLandmarks: state.poseLandmarks,
        round: 1,
        totalRounds: 1,
        lessonKey: state.lessonKey,
        state: {
          trainingState: "active",
          score: state.score,
          accuracy: state.accuracy,
          hp: 100,
          combo: 0,
          currentRound: 1,
          elapsedMs: 0,
        },
        user: null,
      });
      applySnapshot(snapshot);
    } catch (err) {
      console.warn("pose analyzer error:", err);
    }
  }

  renderScore();
}

function startPracticeLoop() {
  if (state.tickId) return;
  state.tickId = window.setInterval(tick, TICK_INTERVAL_MS);

  function frame() {
    if (!state.practicing) { state.frameId = 0; return; }
    tick();
    state.frameId = window.requestAnimationFrame(frame);
  }
  state.frameId = window.requestAnimationFrame(frame);
}

function stopPracticeLoop() {
  if (state.tickId) { clearInterval(state.tickId); state.tickId = 0; }
  if (state.frameId) { cancelAnimationFrame(state.frameId); state.frameId = 0; }
}

/* ── Camera toggle button ───────────────────────────────── */
async function toggleCamera() {
  if (state.practicing) {
    state.practicing = false;
    stopPracticeLoop();
    stopWebcam();
    state.score = 0;
    state.accuracy = 0;
    state.feedback = [];
    renderFeedback();
    renderScore();
    setFallbackVisible(true);
    setWebcamStatus("카메라 연결 대기");
    if (state.ui.camToggle) {
      state.ui.camToggle.textContent = "📷 카메라 연결";
      state.ui.camToggle.dataset.active = "false";
    }
    return;
  }

  const ok = await startWebcam();
  if (!ok) return;

  state.practicing = true;
  state.score = 0;
  state.accuracy = 0;
  state.feedback = [];
  renderFeedback();
  renderScore();
  startPracticeLoop();

  if (state.ui.camToggle) {
    state.ui.camToggle.textContent = "⏹ 분석 중지";
    state.ui.camToggle.dataset.active = "true";
  }
}

/* ── Collect DOM elements ───────────────────────────────── */
function collectElements() {
  const $ = (sel) => document.querySelector(sel);
  state.ui = {
    stepLabel:         $("[data-step-label]"),
    lessonTitleStrip:  $("[data-lesson-title-strip]"),
    lessonProgress:    $("[data-lesson-progress]"),
    studyTitle:        $("[data-study-title]"),
    studyTitleEn:      $("[data-study-title-en]"),
    studySummary:      $("[data-study-summary]"),
    keyPoint:          $("[data-key-point]"),
    goodPoseMedia:     $("[data-good-pose-media]"),
    badPoseMedia:      $("[data-bad-pose-media]"),
    goodPoints:        $("[data-good-points]"),
    badPoints:         $("[data-bad-points]"),
    checkList:         $("[data-check-list]"),
    scoreNote:         $("[data-score-note]"),
    tipText:           $("[data-tip-text]"),
    prevLink:          $("[data-prev-link]"),
    nextLink:          $("[data-next-link]"),
    trainLink:         $("[data-train-link]"),
    webcamVideo:       $("[data-webcam-video]"),
    overlayCanvas:     $("[data-pose-overlay]"),
    webcamFallback:    $("[data-webcam-fallback]"),
    webcamStatus:      $("[data-webcam-status]"),
    scoreDonut:        $("[data-score-donut]"),
    scoreNumber:       $("[data-score-number]"),
    scoreGrade:        $("[data-score-grade]"),
    scoreMeta:         $("[data-score-meta]"),
    feedbackList:      $("[data-feedback-list]"),
    camToggle:         $("[data-cam-toggle]"),
    guideAudioToggle:  $("[data-guide-audio-toggle]"),
    guideModal:        $("[data-guide-modal]"),
    guideModalClose:   $("[data-guide-modal-close]"),
    guideModalTitle:   $("[data-guide-modal-title]"),
    guideModalScript:  $("[data-guide-modal-script]"),
    guideVideo:        $("[data-guide-video]"),
    guideModalAudioToggle: $("[data-guide-modal-audio-toggle]"),
  };
}

/* ── Bootstrap ──────────────────────────────────────────── */
async function init() {
  // Read lesson from URL
  const params = new URLSearchParams(window.location.search);
  const rawKey = params.get("lesson") || params.get("lessonKey") || params.get("lesson_key") || "basic-guard";
  state.lessonKey   = normalizeLessonKey(rawKey);
  state.lessonIndex = LESSON_KEYS.indexOf(state.lessonKey);
  if (state.lessonIndex < 0) state.lessonIndex = 0;
  state.lesson = LESSON_DATA[state.lessonIndex];

  collectElements();
  bindLogoutButton();
  renderStudy();
  renderScore();
  renderFeedback();

  // Attach PoseAnalyzer reference
  state.poseAnalyzer = window.IM_BOXER_POSE_ANALYZER || null;

  // In the woosunshin integration, tutorial lessons must be available before login.
  const storedUser = getStoredUser();
  const refreshedUser = await refreshCurrentUser().catch(() => null);
  state.user = refreshedUser || storedUser || null;

  // Camera toggle button
  state.ui.camToggle?.addEventListener("click", () => { void toggleCamera(); });
  state.ui.guideAudioToggle?.addEventListener("click", () => { void toggleGuideAudio(); });
  state.ui.guideModalAudioToggle?.addEventListener("click", () => { void toggleGuideAudio(); });
  state.ui.guideModalClose?.addEventListener("click", () => closeGuideCoachModal());
  state.ui.guideModal?.addEventListener("click", (event) => {
    if (event.target === state.ui.guideModal) {
      closeGuideCoachModal();
    }
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeGuideCoachModal();
    }
  });
  state.ui.trainLink?.addEventListener("click", (event) => {
    event.preventDefault();
    stopGuideAudio();
    window.location.href = trainingUrl(state.lessonKey);
  });

  // Cleanup on unload
  window.addEventListener("beforeunload", () => {
    stopGuideAudio();
    stopPracticeLoop();
    stopWebcam();
  });

  // If PoseAnalyzer loads after init (async engine scripts), pick it up
  const checkAnalyzer = window.setInterval(() => {
    if (!state.poseAnalyzer && window.IM_BOXER_POSE_ANALYZER) {
      state.poseAnalyzer = window.IM_BOXER_POSE_ANALYZER;
    }
    if (state.poseAnalyzer) clearInterval(checkAnalyzer);
  }, 500);
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch((err) => {
    console.error("tutorial-lesson init failed:", err);
    continueAsGuest();
  });
});

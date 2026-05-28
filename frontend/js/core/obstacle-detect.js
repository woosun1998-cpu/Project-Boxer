/**
 * 웹캠 장애물 감지 공통 모듈.
 * 무엇: 웹캠 비디오 프레임을 백엔드 YOLO API로 보내 위험 물체를 표시합니다.
 * 왜: 스트레칭/스파링/튜토리얼 등 카메라 화면마다 같은 안전 안내를 재사용하기 위함입니다.
 */
(function () {
  "use strict";

  const API_PATH_SCRIPT_SRC = "/js/core/api-path.js";
  const API_SCRIPT_SRC = "/js/core/api.js?v=rel-api";
  const VIDEO_SELECTORS = [
    "video[data-obstacle-detect]",
    "[data-webcam-video]",
    "#webcamFeed",
    "#webcamVideo",
    "#webcam-video",
    "#coach-video",
    "[data-sparring-webcam]",
  ];
  const EXERCISE_MEDIA_SELECTORS = [
    "[data-ai-video]",
    ".ss-ai-video",
    "#trainer-video",
    "[data-training-reference-video]",
  ];
  const DETECT_INTERVAL_MS = 900;
  const DETECT_CONF = 0.25;
  const DETECT_IMGSZ = 640;
  const JPEG_QUALITY = 0.72;
  const DANGER_CLASSES = new Set([
    "chair",
    "desk",
    "dining table",
    "couch",
    "bottle",
    "cup",
    "laptop",
    "keyboard",
    "mouse",
    "tv",
    "book",
  ]);
  const LABEL_KO = {
    chair: "의자",
    desk: "책상",
    "dining table": "책상",
    couch: "소파",
    bottle: "병",
    cup: "컵",
    laptop: "노트북",
    keyboard: "키보드",
    mouse: "마우스",
    tv: "TV",
    book: "책",
  };

  let apiLoadPromise = null;
  const pausedMediaByObstacle = new Set();
  let obstacleDangerActive = false;
  let dispatchedObstacleDangerActive = false;

  function ensureStyle() {
    if (document.getElementById("boxer-obstacle-detect-style")) return;
    const style = document.createElement("style");
    style.id = "boxer-obstacle-detect-style";
    style.textContent = `
      .boxer-obstacle-status {
        position: absolute;
        left: 12px;
        top: 12px;
        z-index: 9999;
        width: fit-content;
        max-width: calc(100% - 24px);
        padding: 8px 12px;
        border-radius: 999px;
        background: rgba(0, 0, 0, 0.72);
        color: #fff;
        font: 700 14px/1.25 -apple-system, BlinkMacSystemFont, "Malgun Gothic", sans-serif;
        letter-spacing: -0.2px;
        pointer-events: none;
        transform: none;
      }
      .boxer-obstacle-status.is-danger {
        background: rgba(237, 29, 50, 0.94);
        box-shadow: 0 0 22px rgba(237, 29, 50, 0.45);
      }
      .boxer-obstacle-status.is-safe {
        background: rgba(0, 150, 80, 0.84);
      }
      .boxer-obstacle-remove-message {
        position: absolute;
        left: 50%;
        top: 50%;
        z-index: 10000;
        width: fit-content;
        max-width: calc(100% - 40px);
        padding: 14px 18px;
        border: 2px solid rgba(255, 255, 255, 0.88);
        border-radius: 14px;
        background: rgba(237, 29, 50, 0.94);
        color: #fff;
        font: 900 22px/1.25 -apple-system, BlinkMacSystemFont, "Malgun Gothic", sans-serif;
        text-align: center;
        letter-spacing: -0.4px;
        pointer-events: none;
        transform: translate(-50%, -50%);
        box-shadow: 0 10px 34px rgba(0, 0, 0, 0.42), 0 0 28px rgba(237, 29, 50, 0.46);
      }
      .boxer-obstacle-remove-message[hidden] {
        display: none;
      }
      .boxer-obstacle-paused [data-ai-video],
      .boxer-obstacle-paused .ss-ai-video,
      .boxer-obstacle-paused #trainer-video,
      .boxer-obstacle-paused [data-training-reference-video],
      .boxer-obstacle-media-paused {
        filter: grayscale(1) brightness(0.72) contrast(1.04) !important;
      }
    `;
    document.head.appendChild(style);
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src^="${src.split("?")[0]}"]`);
      if (existing) {
        if (window.api?.postForm) {
          resolve();
          return;
        }
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.addEventListener("load", () => resolve(), { once: true });
      script.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
      document.head.appendChild(script);
    });
  }

  async function ensureApi() {
    if (window.api?.postForm) return window.api;
    if (!apiLoadPromise) {
      apiLoadPromise = loadScript(API_PATH_SCRIPT_SRC)
        .then(() => loadScript(API_SCRIPT_SRC))
        .then(() => (window.api?.postForm ? window.api : null))
        .catch(() => null);
    }
    return apiLoadPromise;
  }

  function apiHost() {
    if (window.location.protocol === "file:") return "localhost";
    return window.location.hostname || "localhost";
  }

  function resolveObstacleApiPath(path) {
    if (window.BoxerApiPath && window.BoxerApiPath.resolveApiPath) {
      return window.BoxerApiPath.resolveApiPath(path);
    }
    const p = String(path || "").trim();
    if (!p.startsWith("/")) return "/" + p;
    return p;
  }

  async function parseApiResponse(response) {
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = data?.detail || data?.message || `요청 실패 (${response.status})`;
      throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
    }
    return data;
  }

  async function postObstacleForm(path, formData) {
    const api = await ensureApi();
    if (api?.postForm) {
      return api.postForm(path, formData);
    }

    const response = await fetch(resolveObstacleApiPath(path), {
      method: "POST",
      body: formData,
    });
    return await parseApiResponse(response);
  }

  function ensurePositioned(element) {
    const computed = window.getComputedStyle(element);
    if (computed.position === "static") {
      element.style.position = "relative";
    }
  }

  function getOverlayHost(videoEl) {
    return (
      document.querySelector(".ss-ring-view") ||
      videoEl.closest(".arena-cam-wrap") ||
      videoEl.closest("#user-cam-box") ||
      videoEl.closest(".webcam-wrap") ||
      videoEl.closest(".stage-container") ||
      videoEl.parentElement ||
      document.body
    );
  }

  function getOrCreateStatus(videoEl) {
    ensureStyle();
    const parent = getOverlayHost(videoEl);
    ensurePositioned(parent);

    let statusEl = parent.querySelector(":scope > .boxer-obstacle-status");
    if (!statusEl) {
      statusEl = document.createElement("div");
      statusEl.className = "boxer-obstacle-status";
      statusEl.textContent = "장애물 감지 준비 중...";
      parent.appendChild(statusEl);
    }
    return statusEl;
  }

  function getOrCreateRemoveMessage(videoEl) {
    const parent = getOverlayHost(videoEl);
    ensurePositioned(parent);
    let messageEl = parent.querySelector(":scope > .boxer-obstacle-remove-message");
    if (!messageEl) {
      messageEl = document.createElement("div");
      messageEl.className = "boxer-obstacle-remove-message";
      messageEl.hidden = true;
      parent.appendChild(messageEl);
    }
    return messageEl;
  }

  function setStatus(statusEl, message, mode = "") {
    statusEl.textContent = message;
    statusEl.classList.toggle("is-danger", mode === "danger");
    statusEl.classList.toggle("is-safe", mode === "safe");
  }

  function setRemoveMessage(videoEl, message = "") {
    const messageEl = getOrCreateRemoveMessage(videoEl);
    messageEl.textContent = message;
    messageEl.hidden = !message;
  }

  function dispatchObstacleState(active, labels, message, videoEl) {
    if (dispatchedObstacleDangerActive === active) {
      return;
    }
    dispatchedObstacleDangerActive = active;
    window.dispatchEvent(new CustomEvent("boxer:obstacle-danger-change", {
      detail: {
        active,
        labels: Array.isArray(labels) ? labels : [],
        message: message || "",
        source: videoEl || null,
      },
    }));
  }

  function getFeedbackTargets() {
    return [
      document.getElementById("feedback-msg"),
      document.getElementById("feedbackText"),
      document.querySelector("[data-coach-tip]"),
    ].filter(Boolean);
  }

  function pushFeedback(message) {
    getFeedbackTargets().forEach((target) => {
      target.textContent = message;
    });
  }

  function hasFinalConsonant(text) {
    const char = String(text || "").trim().slice(-1);
    const code = char.charCodeAt(0);
    if (code < 0xac00 || code > 0xd7a3) return false;
    return (code - 0xac00) % 28 !== 0;
  }

  function withObjectParticle(label) {
    return `${label}${hasFinalConsonant(label) ? "을" : "를"}`;
  }

  function buildRemoveMessage(labels) {
    if (!labels.length) return "";
    if (labels.length === 1) return `${withObjectParticle(labels[0])} 치워주세요`;
    return `${labels.join(", ")}을/를 치워주세요`;
  }

  function isCameraVideo(videoEl) {
    return Boolean(
      videoEl?.srcObject ||
        videoEl?.matches?.(
          "video[data-obstacle-detect], [data-webcam-video], #webcamFeed, #webcamVideo, #webcam-video, #coach-video, [data-sparring-webcam]",
        )
    );
  }

  function getExerciseMedia(cameraVideoEl) {
    const media = new Set();
    EXERCISE_MEDIA_SELECTORS.forEach((selector) => {
      document.querySelectorAll(selector).forEach((mediaEl) => {
        if (mediaEl instanceof HTMLVideoElement) media.add(mediaEl);
      });
    });
    document.querySelectorAll("video").forEach((mediaEl) => {
      if (mediaEl instanceof HTMLVideoElement) media.add(mediaEl);
    });
    return [...media].filter((mediaEl) => {
      if (!(mediaEl instanceof HTMLVideoElement)) return;
      if (mediaEl === cameraVideoEl || isCameraVideo(mediaEl)) return false;
      return true;
    });
  }

  function pauseExerciseMedia(cameraVideoEl) {
    obstacleDangerActive = true;
    getOverlayHost(cameraVideoEl).classList.add("boxer-obstacle-paused");
    getExerciseMedia(cameraVideoEl).forEach((mediaEl) => {
      mediaEl.classList.add("boxer-obstacle-media-paused");
      if (mediaEl.paused || mediaEl.ended) return;
      try {
        mediaEl.pause();
        pausedMediaByObstacle.add(mediaEl);
      } catch (error) {
        console.warn("[BoxerObstacleDetection] pause failed:", error);
      }
    });
  }

  function resumeExerciseMedia() {
    obstacleDangerActive = false;
    document.querySelectorAll(".boxer-obstacle-paused").forEach((el) => {
      el.classList.remove("boxer-obstacle-paused");
    });
    document.querySelectorAll(".boxer-obstacle-media-paused").forEach((el) => {
      el.classList.remove("boxer-obstacle-media-paused");
    });
    pausedMediaByObstacle.forEach((mediaEl) => {
      if (!mediaEl.isConnected) {
        pausedMediaByObstacle.delete(mediaEl);
        return;
      }
      try {
        const playResult = mediaEl.play();
        if (playResult && typeof playResult.catch === "function") {
          playResult.catch(() => {});
        }
      } catch {
        // 자동 재생 정책으로 막히면 기존 UI 조작으로 재개 가능
      }
      pausedMediaByObstacle.delete(mediaEl);
    });
  }

  document.addEventListener(
    "play",
    (event) => {
      if (!obstacleDangerActive) return;
      const mediaEl = event.target;
      if (!(mediaEl instanceof HTMLVideoElement)) return;
      if (isCameraVideo(mediaEl)) return;
      window.setTimeout(() => {
        if (obstacleDangerActive && !mediaEl.paused) {
          mediaEl.pause();
          pausedMediaByObstacle.add(mediaEl);
        }
      }, 0);
    },
    true,
  );

  function getCaptureCanvas(videoEl) {
    if (!videoEl.__boxerObstacleCanvas) {
      videoEl.__boxerObstacleCanvas = document.createElement("canvas");
    }
    const canvas = videoEl.__boxerObstacleCanvas;
    const vw = Math.max(1, videoEl.videoWidth || 640);
    const vh = Math.max(1, videoEl.videoHeight || 480);
    const targetW = 640;
    canvas.width = targetW;
    canvas.height = Math.max(360, Math.round((vh / vw) * targetW));
    return canvas;
  }

  async function detectOnce(videoEl, statusEl) {
    if (videoEl.__boxerObstacleBusy || videoEl.readyState < 2 || !videoEl.videoWidth) return;
    videoEl.__boxerObstacleBusy = true;

    try {
      const canvas = getCaptureCanvas(videoEl);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
      if (!blob) return;

      const formData = new FormData();
      formData.append("frame", blob, "webcam-frame.jpg");
      const result = await postObstacleForm(
        `/api/detect/obstacles?conf=${DETECT_CONF}&imgsz=${DETECT_IMGSZ}`,
        formData,
      );
      const detections = Array.isArray(result?.detections) ? result.detections : [];
      const dangerList = [
        ...new Set(
          detections
            .map((item) => String(item.class_name || ""))
            .filter((name) => DANGER_CLASSES.has(name))
            .map((name) => LABEL_KO[name] || name),
        ),
      ];

      if (dangerList.length > 0) {
        const labelText = dangerList.join(", ");
        const message = `위험물체 감지: ${labelText}`;
        const removeMessage = buildRemoveMessage(dangerList);
        setStatus(statusEl, removeMessage, "danger");
        setRemoveMessage(videoEl, removeMessage);
        pauseExerciseMedia(videoEl);
        dispatchObstacleState(true, dangerList, removeMessage, videoEl);
        pushFeedback(`${message}. 주변을 정리해 주세요.`);
        return;
      }
      setRemoveMessage(videoEl, "");
      resumeExerciseMedia();
      dispatchObstacleState(false, [], "", videoEl);
      setStatus(statusEl, "장애물 감지 중: 안전", "safe");
    } catch (error) {
      if (!videoEl.__boxerObstacleWarned) {
        console.warn("[BoxerObstacleDetection] unavailable:", error);
        videoEl.__boxerObstacleWarned = true;
      }
      setRemoveMessage(videoEl, "");
      resumeExerciseMedia();
      dispatchObstacleState(false, [], "", videoEl);
      setStatus(statusEl, "장애물 감지 서버 확인 필요");
    } finally {
      videoEl.__boxerObstacleBusy = false;
    }
  }

  function attach(videoEl) {
    if (!videoEl || videoEl.__boxerObstacleAttached) return;
    videoEl.__boxerObstacleAttached = true;

    const statusEl = getOrCreateStatus(videoEl);
    setStatus(statusEl, "장애물 감지 중...");
    window.setInterval(() => detectOnce(videoEl, statusEl), DETECT_INTERVAL_MS);
  }

  function findVideos() {
    const videos = new Set();
    VIDEO_SELECTORS.forEach((selector) => {
      document.querySelectorAll(selector).forEach((videoEl) => {
        if (videoEl instanceof HTMLVideoElement) videos.add(videoEl);
      });
    });
    return [...videos];
  }

  function autoStart() {
    findVideos().forEach(attach);
  }

  window.BoxerObstacleDetection = {
    attach,
    autoStart,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoStart, { once: true });
  } else {
    window.setTimeout(autoStart, 0);
  }
})();

const globalScope = typeof window !== "undefined" ? window : globalThis;
const MODULE_BASE_URL = import.meta.url;

const DEFAULT_MODEL_ASSET_URL =
  "../../vendor/mediapipe/pose_landmarker_lite.task";
const DEFAULT_WASM_BASE_URL = "../../vendor/tasks-vision/wasm";
const DEFAULT_IMPORT_CANDIDATES = [
  "../../vendor/tasks-vision/vision_bundle.mjs",
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/+esm",
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/+esm",
];

const state = {
  running: false,
  loadingPromise: null,
  landmarker: null,
  videoElement: null,
  frameId: 0,
  latestLandmarks: null,
  latestResults: null,
  status: "idle",
  onStatus: null,
  onResult: null,
  consecutiveErrors: 0,
};

function getNow() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

function getModelAssetUrl() {
  if (globalScope.IM_BOXER_MEDIA_PIPE_MODEL_URL) {
    return resolveDocumentUrl(globalScope.IM_BOXER_MEDIA_PIPE_MODEL_URL);
  }
  return resolveModuleUrl(DEFAULT_MODEL_ASSET_URL);
}

function getWasmBaseUrl() {
  const value = globalScope.IM_BOXER_MEDIA_PIPE_WASM_URL || DEFAULT_WASM_BASE_URL;
  const normalized = value.endsWith("/") ? value : `${value}/`;
  return globalScope.IM_BOXER_MEDIA_PIPE_WASM_URL
    ? resolveDocumentUrl(normalized)
    : resolveModuleUrl(normalized);
}

function getImportCandidates() {
  const override = globalScope.IM_BOXER_MEDIA_PIPE_IMPORT_CANDIDATES;
  if (Array.isArray(override) && override.length > 0) {
    return override.map(resolveDocumentUrl);
  }
  return DEFAULT_IMPORT_CANDIDATES.map(resolveImportUrl);
}

function resolveImportUrl(url) {
  if (/^(https?:)?\/\//i.test(url)) {
    return url;
  }
  return resolveModuleUrl(url);
}

function resolveModuleUrl(url) {
  try {
    return new URL(url, MODULE_BASE_URL).href;
  } catch {
    return url;
  }
}

function resolveDocumentUrl(url) {
  try {
    const base = globalScope.document?.baseURI || globalScope.location?.href || "";
    return new URL(url, base).href;
  } catch {
    return url;
  }
}

function setStatus(status, message) {
  state.status = status;
  if (typeof state.onStatus === "function") {
    try {
      state.onStatus(message, status);
    } catch {
      // status callback failures should not break tracking
    }
  }
}

function extractLandmarks(result) {
  const candidates = [
    result?.landmarks?.[0],
    result?.poseLandmarks?.[0],
    result?.landmarks,
    result?.poseLandmarks,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length > 0) {
      return candidate;
    }
  }

  return null;
}

function hasWebGLSupport() {
  if (typeof document === "undefined") {
    return false;
  }

  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl"),
    );
  } catch {
    return false;
  }
}

async function loadTasksVision() {
  if (globalScope.PoseLandmarker && globalScope.FilesetResolver) {
    return {
      PoseLandmarker: globalScope.PoseLandmarker,
      FilesetResolver: globalScope.FilesetResolver,
    };
  }

  let lastError = null;
  for (const url of getImportCandidates()) {
    try {
      const mod = await import(url);
      if (mod?.PoseLandmarker && mod?.FilesetResolver) {
        return mod;
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error("MediaPipe tasks-vision module not available.");
}

async function ensureLandmarker() {
  if (state.landmarker) {
    return state.landmarker;
  }

  if (state.loadingPromise) {
    return state.loadingPromise;
  }

  state.loadingPromise = (async () => {
    const { PoseLandmarker, FilesetResolver } = await loadTasksVision();
    setStatus("loading", "자세 분석 모델을 불러오는 중입니다.");

    const vision = await FilesetResolver.forVisionTasks(getWasmBaseUrl());
    state.landmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: getModelAssetUrl(),
        delegate: "CPU",
      },
      runningMode: "VIDEO",
      numPoses: 1,
    });

    state.consecutiveErrors = 0;
    setStatus("ready", "자세 분석 준비가 완료되었습니다.");
    return state.landmarker;
  })().finally(() => {
    state.loadingPromise = null;
  });

  return state.loadingPromise;
}

function stopLoop() {
  if (state.frameId) {
    cancelAnimationFrame(state.frameId);
    state.frameId = 0;
  }
}

function pushLandmarks(result) {
  state.latestResults = result || null;
  state.latestLandmarks = extractLandmarks(result);
  globalScope.IM_BOXER_POSE_LANDMARKS = state.latestLandmarks;
  globalScope.IM_BOXER_POSE_RESULTS = state.latestResults;

  if (typeof state.onResult === "function") {
    try {
      state.onResult(state.latestLandmarks, state.latestResults);
    } catch {
      // ignore result callback failures
    }
  }
}

async function tick() {
  if (!state.running || !state.landmarker || !state.videoElement) {
    return;
  }

  try {
    if (state.videoElement.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      const result = state.landmarker.detectForVideo(state.videoElement, getNow());
      pushLandmarks(result);
      state.consecutiveErrors = 0;
    }
  } catch (error) {
    state.consecutiveErrors += 1;
    console.warn("PoseTracker detectForVideo failed:", error);

    if (state.consecutiveErrors >= 8) {
      setStatus("fallback", "자세 분석을 잠시 사용할 수 없습니다.");
      state.latestLandmarks = null;
      globalScope.IM_BOXER_POSE_LANDMARKS = null;
      if (typeof state.onResult === "function") {
        try {
          state.onResult(null, null, error);
        } catch {
          // ignore callback failures
        }
      }
    } else if (state.status !== "running") {
      setStatus("running", "자세 분석 중입니다.");
    }
  }

  if (state.running) {
    state.frameId = requestAnimationFrame(tick);
  }
}

async function start(videoElement, options = {}) {
  state.videoElement = videoElement || state.videoElement;
  state.onStatus = typeof options.onStatus === "function" ? options.onStatus : state.onStatus;
  state.onResult = typeof options.onResult === "function" ? options.onResult : state.onResult;

  if (!state.videoElement) {
    setStatus("idle", "웹캠이 준비되지 않아 자세 분석을 시작할 수 없습니다.");
    return null;
  }

  if (false && !hasWebGLSupport()) {
    const message = "이 브라우저는 WebGL을 사용할 수 없어 MediaPipe 자세 분석을 시작할 수 없습니다.";
    globalScope.IM_BOXER_POSE_TRACKER_ERROR = message;
    setStatus("fallback", message);
    state.running = false;
    stopLoop();
    return null;
  }

  try {
    await ensureLandmarker();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error || "");
    globalScope.IM_BOXER_POSE_TRACKER_ERROR = detail;
    setStatus("fallback", detail ? `자세 분석 로딩 실패: ${detail}` : "자세 분석 로딩 실패");
    globalScope.IM_BOXER_POSE_LANDMARKS = null;
    state.running = false;
    stopLoop();
    return null;
  }

  if (state.running) {
    return state.landmarker;
  }

  state.running = true;
  setStatus("running", "자세 분석을 시작했습니다.");
  stopLoop();
  state.frameId = requestAnimationFrame(tick);
  return state.landmarker;
}

function stop() {
  state.running = false;
  stopLoop();
  state.latestLandmarks = null;
  state.latestResults = null;
  state.consecutiveErrors = 0;
  globalScope.IM_BOXER_POSE_LANDMARKS = null;
  globalScope.IM_BOXER_POSE_RESULTS = null;
  setStatus("idle", "자세 분석이 중단되었습니다.");
  return null;
}

function reset() {
  stopLoop();
  state.running = false;
  state.loadingPromise = null;
  state.landmarker = null;
  state.videoElement = null;
  state.latestLandmarks = null;
  state.latestResults = null;
  state.consecutiveErrors = 0;
  state.status = "idle";
  globalScope.IM_BOXER_POSE_LANDMARKS = null;
  globalScope.IM_BOXER_POSE_RESULTS = null;
}

function getLatestLandmarks() {
  return state.latestLandmarks;
}

function getStatus() {
  return state.status;
}

function isReady() {
  return Boolean(state.landmarker);
}

const tracker = {
  start,
  stop,
  reset,
  getLatestLandmarks,
  getStatus,
  isReady,
};

globalScope.IM_BOXER_POSE_TRACKER = tracker;

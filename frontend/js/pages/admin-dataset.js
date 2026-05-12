import { apiUrl } from "../core/api.js";
import { authFetch, authHeaders, clearSession, getStoredUser, refreshCurrentUser } from "../core/auth.js";

const LABELS_BY_PROJECT = {
  user_action: ["user_jab", "user_cross", "user_hook", "user_uppercut", "no_punch"],
  posture_state: ["guard", "slip_left", "slip_right", "duck", "hands_down", "neutral"],
};

const state = {
  file: null,
  objectUrl: "",
  savedVideo: null,
  frames: [],
  manifest: null,
};

const $ = (selector) => document.querySelector(selector);

function setStatus(message) {
  const node = $("[data-status]");
  if (node) node.textContent = message;
}

function getProject() {
  return $("[data-dataset-project]")?.value || "user_action";
}

function getLabel() {
  return $("[data-dataset-label]")?.value || "user_hook";
}

function getSourceName() {
  const raw = $("[data-source-name]")?.value || "dataset";
  return raw.trim().replace(/\s+/g, "_") || "dataset";
}

function getNumber(selector, fallback) {
  const value = Number($(selector)?.value);
  return Number.isFinite(value) ? value : fallback;
}

function populateLabels() {
  const project = getProject();
  const select = $("[data-dataset-label]");
  if (!select) return;
  select.innerHTML = "";
  (LABELS_BY_PROJECT[project] || LABELS_BY_PROJECT.user_action).forEach((label) => {
    const option = document.createElement("option");
    option.value = label;
    option.textContent = label;
    select.appendChild(option);
  });
}

function redirectToLogin() {
  window.location.href = "./login.html";
}

function bindLogout() {
  document.querySelectorAll("[data-logout-button]").forEach((button) => {
    button.addEventListener("click", () => {
      clearSession();
      redirectToLogin();
    });
  });
}

function renderUser(user) {
  const username = user?.username || "관리자";
  const summary = $("[data-user-summary]");
  if (summary) summary.textContent = `${username}님의 데이터셋 도구`;
}

async function ensureAdmin() {
  bindLogout();
  const storedUser = getStoredUser();
  if (storedUser) renderUser(storedUser);
  const user = await refreshCurrentUser();
  if (user) {
    if (user.tier !== "admin") redirectToLogin();
    renderUser(user);
    return;
  }
  if (!storedUser || storedUser.tier !== "admin") redirectToLogin();
}

function clearObjectUrl() {
  if (!state.objectUrl) return;
  try {
    URL.revokeObjectURL(state.objectUrl);
  } catch {
    // Ignore browser cleanup failures.
  }
  state.objectUrl = "";
}

async function waitForVideoMetadata(video) {
  if (Number.isFinite(video.duration) && video.duration > 0) return;
  await new Promise((resolve) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => resolve();
  });
}

async function loadVideoFromFile() {
  const file = $("[data-video-file]")?.files?.[0] || null;
  if (!file) {
    setStatus("먼저 동영상 파일을 선택하세요.");
    return;
  }

  state.file = file;
  const sourceInput = $("[data-source-name]");
  if (sourceInput && !sourceInput.value.trim()) {
    sourceInput.value = file.name.replace(/\.[^.]+$/, "").replace(/\s+/g, "_");
  }

  clearObjectUrl();
  const video = $("[data-video]");
  state.objectUrl = URL.createObjectURL(file);
  video.src = state.objectUrl;
  video.load();

  await waitForVideoMetadata(video);

  const duration = Number(video.duration || 0);
  if (duration > 0) {
    $("[data-start-sec]").value = "0";
    $("[data-end-sec]").value = duration.toFixed(2);
  }
  state.frames = [];
  state.manifest = null;
  renderFrames();
  updateManifestPreview();
  setStatus(`영상 불러오기 완료: ${file.name}\n길이: ${duration.toFixed(2)}초`);
}

function useFullRange() {
  const duration = Number($("[data-video]")?.duration || 0);
  $("[data-start-sec]").value = "0";
  $("[data-end-sec]").value = duration > 0 ? duration.toFixed(2) : "0";
  setStatus("전체 구간을 시작/끝 시간에 넣었습니다.");
}

async function uploadVideoToBackend() {
  if (!state.file) {
    setStatus("먼저 영상을 불러오세요.");
    return;
  }
  const form = new FormData();
  form.append("project", getProject());
  form.append("source_name", getSourceName());
  form.append("file", state.file);
  setStatus("원본 영상을 백엔드에 저장 중입니다...");

  const response = await fetch(apiUrl("/api/admin/datasets/upload-video"), {
    method: "POST",
    headers: authHeaders(),
    body: form,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.detail || "원본 영상 저장에 실패했습니다.");
  }
  state.savedVideo = data.data;
  setStatus(`원본 영상 저장 완료\n${data.data.raw_video_path}`);
}

async function createClip() {
  if (!state.savedVideo?.filename) {
    setStatus("구간 MP4를 만들려면 먼저 '원본 영상 저장'을 실행하세요.");
    return;
  }
  const startSec = getNumber("[data-start-sec]", 0);
  const endSec = getNumber("[data-end-sec]", 0);
  setStatus("구간 MP4를 생성 중입니다. 영상 길이에 따라 시간이 걸릴 수 있습니다.");

  const response = await authFetch("/api/admin/datasets/create-clip", {
    method: "POST",
    body: JSON.stringify({
      project: getProject(),
      source_name: getSourceName(),
      source_video_filename: state.savedVideo.filename,
      start_sec: startSec,
      end_sec: endSec,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.detail || "구간 MP4 생성에 실패했습니다.");
  }
  setStatus(`구간 MP4 생성 완료\n${data.data.clip_path}\n브라우저 URL: ${data.data.clip_url}`);
}

function seekVideo(video, timeSec) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
    };
    const onSeeked = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("영상 seek 중 오류가 발생했습니다."));
    };
    video.addEventListener("seeked", onSeeked, { once: true });
    video.addEventListener("error", onError, { once: true });
    video.currentTime = timeSec;
  });
}

async function captureFrames() {
  const video = $("[data-video]");
  if (!video?.src) {
    setStatus("먼저 영상을 불러오세요.");
    return;
  }

  const startSec = Math.max(0, getNumber("[data-start-sec]", 0));
  const endSec = getNumber("[data-end-sec]", Number(video.duration || 0));
  const intervalMs = Math.max(50, getNumber("[data-interval-ms]", 240));
  const width = Math.max(96, getNumber("[data-export-width]", 320));
  const height = Math.max(96, getNumber("[data-export-height]", 320));
  const prefix = ($("[data-file-prefix]")?.value || "frame").trim().replace(/\s+/g, "_") || "frame";
  const label = getLabel();

  if (endSec <= startSec) {
    setStatus("끝 시간은 시작 시간보다 커야 합니다.");
    return;
  }

  const canvas = $("[data-export-canvas]");
  const ctx = canvas.getContext("2d");
  canvas.width = width;
  canvas.height = height;
  const frames = [];
  const step = intervalMs / 1000;
  const total = Math.floor((endSec - startSec) / step) + 1;
  setStatus(`프레임 추출 중... 예상 ${total}장`);

  video.pause();
  for (let index = 0, time = startSec; time <= endSec + 0.0001; index += 1, time += step) {
    await seekVideo(video, Math.min(time, endSec));
    ctx.drawImage(video, 0, 0, width, height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    frames.push({
      filename: `${prefix}_${String(index + 1).padStart(4, "0")}.jpg`,
      label,
      timeSec: Number(Math.min(time, endSec).toFixed(3)),
      dataUrl,
      datasetProject: getProject(),
    });
  }

  state.frames = frames;
  buildManifest();
  renderFrames();
  updateManifestPreview();
  setStatus(`프레임 추출 완료: ${frames.length}장\n라벨: ${label}`);
}

function buildManifest() {
  state.manifest = {
    project: getProject(),
    source_name: getSourceName(),
    source_type: state.savedVideo ? "backend_raw_video" : "local_browser_file",
    source_video_filename: state.savedVideo?.filename || state.file?.name || null,
    exported_width: getNumber("[data-export-width]", 320),
    exported_height: getNumber("[data-export-height]", 320),
    interval_ms: getNumber("[data-interval-ms]", 240),
    frame_count: state.frames.length,
    frames: state.frames.map(({ dataUrl, datasetProject, timeSec, ...rest }) => ({
      ...rest,
      dataset_project: datasetProject,
      time_sec: timeSec,
    })),
  };
}

function renderFrames() {
  const grid = $("[data-frame-grid]");
  if (!grid) return;
  grid.innerHTML = "";
  if (!state.frames.length) {
    const empty = document.createElement("div");
    empty.className = "api-slot";
    empty.textContent = "아직 추출된 프레임이 없습니다.";
    grid.appendChild(empty);
    return;
  }
  state.frames.forEach((frame) => {
    const card = document.createElement("div");
    card.className = "frame-card";
    const img = document.createElement("img");
    img.src = frame.dataUrl;
    img.alt = frame.filename;
    const meta = document.createElement("span");
    meta.textContent = `${frame.filename}\n${frame.timeSec.toFixed(3)}s / ${frame.label}`;
    card.append(img, meta);
    grid.appendChild(card);
  });
}

function updateManifestPreview(savedData = null) {
  const preview = $("[data-manifest-preview]");
  if (!preview) return;
  const payload = savedData || state.manifest || {};
  preview.value = Object.keys(payload).length ? JSON.stringify(payload, null, 2) : "";
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadManifest() {
  if (!state.manifest) {
    setStatus("먼저 프레임을 추출하세요.");
    return;
  }
  downloadBlob(
    new Blob([JSON.stringify(state.manifest, null, 2)], { type: "application/json;charset=utf-8" }),
    `${getSourceName()}_${getProject()}_manifest.json`,
  );
}

function dataUrlToBlob(dataUrl) {
  const [header, encoded] = dataUrl.split(",");
  const mime = header.match(/data:([^;]+)/)?.[1] || "image/jpeg";
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

function downloadFrames() {
  if (!state.frames.length) {
    setStatus("먼저 프레임을 추출하세요.");
    return;
  }
  state.frames.forEach((frame) => {
    downloadBlob(dataUrlToBlob(frame.dataUrl), frame.filename);
  });
  setStatus(`${state.frames.length}개 프레임 다운로드를 시작했습니다.`);
}

async function saveFramesToBackend() {
  if (!state.frames.length) {
    setStatus("먼저 프레임을 추출하세요.");
    return;
  }
  buildManifest();
  setStatus("프레임 이미지를 백엔드에 저장 중입니다...");
  const response = await authFetch("/api/admin/datasets/export", {
    method: "POST",
    body: JSON.stringify({
      project: getProject(),
      source_name: getSourceName(),
      source_type: state.savedVideo ? "backend_raw_video" : "local_browser_file",
      source_video_filename: state.savedVideo?.filename || state.file?.name || null,
      exported_width: state.manifest.exported_width,
      exported_height: state.manifest.exported_height,
      interval_ms: state.manifest.interval_ms,
      frames: state.frames.map((frame) => ({
        filename: frame.filename,
        label: frame.label,
        time_sec: frame.timeSec,
        data_url: frame.dataUrl,
        dataset_project: frame.datasetProject,
      })),
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.detail || "프레임 저장에 실패했습니다.");
  }
  updateManifestPreview(data.data);
  const firstUrl = data.data?.saved_items?.[0]?.url || "";
  updateCalibrationLink(firstUrl);
  setStatus(`백엔드 저장 완료: ${data.data.saved_count}장\nmanifest: ${data.data.manifest_path}`);
}

function updateCalibrationLink(imageUrl) {
  const link = $("[data-calibration-link]");
  if (!link) return;
  if (!imageUrl) {
    link.href = "./calibration.html";
    return;
  }
  const params = new URLSearchParams({
    imageUrl,
    source: "dataset",
  });
  link.href = `./calibration.html?${params.toString()}`;
  link.textContent = "첫 프레임으로 Calibration 열기";
}

async function runAction(action) {
  try {
    if (action === "load-video") await loadVideoFromFile();
    if (action === "upload-video") await uploadVideoToBackend();
    if (action === "use-full-range") useFullRange();
    if (action === "capture-frames") await captureFrames();
    if (action === "create-clip") await createClip();
    if (action === "save-backend") await saveFramesToBackend();
    if (action === "download-manifest") downloadManifest();
    if (action === "download-frames") downloadFrames();
  } catch (error) {
    setStatus(error?.message || "작업 중 오류가 발생했습니다.");
  }
}

function bindEvents() {
  $("[data-dataset-project]")?.addEventListener("change", populateLabels);
  $("[data-video-file]")?.addEventListener("change", () => {
    const file = $("[data-video-file]")?.files?.[0] || null;
    const sourceInput = $("[data-source-name]");
    if (file && sourceInput) {
      sourceInput.value = file.name.replace(/\.[^.]+$/, "").replace(/\s+/g, "_");
    }
  });
  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => runAction(button.dataset.action));
  });
}

async function init() {
  await ensureAdmin();
  populateLabels();
  bindEvents();
  const response = await authFetch("/api/admin/datasets/bootstrap");
  const data = await response.json().catch(() => ({}));
  const ffmpeg = data?.data?.ffmpeg_available ? "사용 가능" : "없음";
  setStatus(`데이터셋 도구 준비 완료\nffmpeg: ${ffmpeg}\n구간 MP4 생성은 ffmpeg가 필요합니다.`);
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch((error) => {
    setStatus(error?.message || "데이터셋 도구 초기화에 실패했습니다.");
  });
});

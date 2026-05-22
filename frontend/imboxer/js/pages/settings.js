import { clearSession, getStoredUser, refreshCurrentUser, setStoredUser } from "../core/auth.js";

const PROFILE_OVERRIDES_KEY = "im_boxer_profile_overrides";
const CAMERA_SETTINGS_KEY = "im_boxer_camera_settings";
const NOTIFICATION_SETTINGS_KEY = "im_boxer_notification_settings";

const $ = (selector) => document.querySelector(selector);

function readJson(key, fallback = {}) {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : fallback;
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function pickFirst(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return "";
}

function setText(selector, value) {
  const el = $(selector);
  if (el) el.textContent = String(value ?? "");
}

function renderAvatar(src, name) {
  const avatar = $("[data-avatar-preview]");
  if (!avatar) return;
  const initial = String(name || "B").trim().charAt(0).toUpperCase() || "B";
  avatar.innerHTML = src
    ? `<img src="${src}" alt="${initial} 프로필" onerror="this.remove();this.parentElement.textContent='${initial}'">`
    : initial;
}

function renderUser(user) {
  const overrides = readJson(PROFILE_OVERRIDES_KEY);
  const merged = { ...user, ...overrides };
  const name = pickFirst(merged.nickname, merged.username, merged.email, "BOXER");
  const email = pickFirst(merged.email, "");
  const avatarUrl = pickFirst(merged.avatarUrl, "");

  setText("[data-user-summary]", `${name}님의 설정`);
  setText("[data-user-tier-badge]", String(user?.tier || "free").toUpperCase());
  setText("[data-user-tier-text]", `${user?.tier || "free"} 사용자`);
  setText("[data-account-email]", email || "-");

  const nameInput = $("[data-profile-name]");
  const emailInput = $("[data-profile-email]");
  const avatarInput = $("[data-profile-avatar-url]");
  if (nameInput) nameInput.value = name;
  if (emailInput) emailInput.value = email;
  if (avatarInput) avatarInput.value = avatarUrl;
  renderAvatar(avatarUrl, name);
}

function saveProfile(user) {
  const name = $("[data-profile-name]")?.value.trim() || "BOXER";
  const email = $("[data-profile-email]")?.value.trim() || "";
  const avatarUrl = $("[data-profile-avatar-url]")?.value.trim() || "";
  const overrides = { nickname: name, username: name, email, avatarUrl };
  writeJson(PROFILE_OVERRIDES_KEY, overrides);
  setStoredUser({ ...(user || {}), ...overrides });
  renderUser({ ...(user || {}), ...overrides });
  setText("[data-profile-toast]", "프로필이 저장되었습니다.");
}

function bindProfile(user) {
  $("[data-profile-form]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    saveProfile(user);
  });
  $("[data-profile-reset]")?.addEventListener("click", () => {
    window.localStorage.removeItem(PROFILE_OVERRIDES_KEY);
    renderUser(user);
    setText("[data-profile-toast]", "브라우저 프로필 수정값을 초기화했습니다.");
  });
  $("[data-avatar-file]")?.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || "");
      const input = $("[data-profile-avatar-url]");
      if (input) input.value = value;
      renderAvatar(value, $("[data-profile-name]")?.value || "BOXER");
    };
    reader.readAsDataURL(file);
  });
  $("[data-profile-avatar-url]")?.addEventListener("input", (event) => {
    renderAvatar(event.target.value, $("[data-profile-name]")?.value || "BOXER");
  });
}

function renderCameraSettings() {
  const settings = readJson(CAMERA_SETTINGS_KEY, {
    mode: "user",
    mirror: true,
    overlay: true,
  });
  const mode = $("[data-camera-mode]");
  const mirror = $("[data-camera-mirror]");
  const overlay = $("[data-camera-overlay]");
  if (mode) mode.value = settings.mode || "user";
  if (mirror) mirror.checked = settings.mirror !== false;
  if (overlay) overlay.checked = settings.overlay !== false;
}

function saveCameraSettings() {
  const settings = {
    mode: $("[data-camera-mode]")?.value || "user",
    mirror: Boolean($("[data-camera-mirror]")?.checked),
    overlay: Boolean($("[data-camera-overlay]")?.checked),
  };
  writeJson(CAMERA_SETTINGS_KEY, settings);
  applyCameraPreviewSettings();
  setText("[data-camera-toast]", "카메라 설정이 저장되었습니다.");
}

function applyCameraPreviewSettings() {
  const video = $("[data-camera-preview] video");
  if (!video) return;
  const mirror = $("[data-camera-mirror]")?.checked !== false;
  video.style.transform = mirror ? "scaleX(-1)" : "scaleX(1)";
  video.style.transformOrigin = "center";
}

async function testCamera() {
  const preview = $("[data-camera-preview]");
  if (!preview || !navigator.mediaDevices?.getUserMedia) {
    setText("[data-camera-toast]", "이 브라우저에서는 카메라 테스트를 사용할 수 없습니다.");
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: $("[data-camera-mode]")?.value || "user" },
      audio: false,
    });
    preview.innerHTML = '<video autoplay playsinline muted></video>';
    const video = preview.querySelector("video");
    video.srcObject = stream;
    applyCameraPreviewSettings();
    setText("[data-camera-toast]", "카메라가 정상적으로 연결되었습니다.");
    window.setTimeout(() => {
      stream.getTracks().forEach((track) => track.stop());
    }, 8000);
  } catch {
    setText("[data-camera-toast]", "카메라 권한 또는 장치를 확인해주세요.");
  }
}

function bindCamera() {
  renderCameraSettings();
  $("[data-camera-save]")?.addEventListener("click", saveCameraSettings);
  $("[data-camera-test]")?.addEventListener("click", () => { void testCamera(); });
}

function renderNotificationSettings() {
  const settings = readJson(NOTIFICATION_SETTINGS_KEY, {
    reminder: true,
    achievement: true,
    time: "20:00",
  });
  const reminder = $("[data-notify-reminder]");
  const achievement = $("[data-notify-achievement]");
  const time = $("[data-notify-time]");
  if (reminder) reminder.checked = settings.reminder !== false;
  if (achievement) achievement.checked = settings.achievement !== false;
  if (time) time.value = settings.time || "20:00";
}

function saveNotificationSettings() {
  const settings = {
    reminder: Boolean($("[data-notify-reminder]")?.checked),
    achievement: Boolean($("[data-notify-achievement]")?.checked),
    time: $("[data-notify-time]")?.value || "20:00",
  };
  writeJson(NOTIFICATION_SETTINGS_KEY, settings);
  setText("[data-notify-toast]", "알림 설정이 저장되었습니다.");
}

async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    setText("[data-notify-toast]", "이 브라우저에서는 알림 권한을 지원하지 않습니다.");
    return;
  }
  const result = await Notification.requestPermission();
  setText(
    "[data-notify-toast]",
    result === "granted" ? "알림 권한을 허용했습니다." : "알림 권한이 허용되지 않았습니다.",
  );
}

function bindNotifications() {
  renderNotificationSettings();
  $("[data-notify-save]")?.addEventListener("click", saveNotificationSettings);
  $("[data-notify-permission]")?.addEventListener("click", () => { void requestNotificationPermission(); });
}

function bindLogout() {
  document.querySelectorAll("[data-logout-button]").forEach((button) => {
    button.addEventListener("click", () => {
      clearSession();
      window.location.href = "/index.html";
    });
  });
}

async function init() {
  bindLogout();
  const stored = getStoredUser();
  const refreshed = await refreshCurrentUser().catch(() => null);
  const user = refreshed || stored;
  if (!user) {
    window.location.href = "/index.html";
    return;
  }
  renderUser(user);
  bindProfile(user);
  bindCamera();
  bindNotifications();
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch(() => {
    window.location.href = "/index.html";
  });
});

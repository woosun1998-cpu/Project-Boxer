import { apiFetch, apiUrl } from "./api.js";

const ACCESS_TOKEN_KEY = "im_boxer_access_token";
const USER_PROFILE_KEY = "im_boxer_user_profile";
const USER_SCOPED_CACHE_KEYS = [
  "im_boxer_training_last_result",
  "im_boxer_training_draft",
  "im_boxer_sparring_last_result",
  "im_boxer_sparring_draft",
  "im_boxer_sparring_pending_save",
  "im_boxer_profile_overrides",
];

const WOOSUNSHIN_AUTH_KEYS = [
  "boxer_token",
  "boxer_user",
  "boxer_logged_in",
  "boxer_last_activity",
];

function removeStorageKeys(storage, keys) {
  if (!storage) return;
  keys.forEach((key) => {
    try {
      storage.removeItem(key);
    } catch {
      // ignore storage access errors
    }
  });
}

function broadcastWoosunshinLogout() {
  try {
    window.localStorage.setItem("boxer_auth_event", JSON.stringify({ type: "logout", at: Date.now() }));
  } catch {
    // ignore storage access errors
  }
}
export function getAccessToken() {
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token) {
  if (!token) {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    return;
  }
  window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function hasAccessToken() {
  return Boolean(getAccessToken());
}

export function getStoredUser() {
  const raw = window.localStorage.getItem(USER_PROFILE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setStoredUser(user) {
  const previous = getStoredUser();
  const previousId = previous?.id ?? previous?.userId ?? null;
  const nextId = user?.id ?? user?.userId ?? null;
  if (previousId !== null && nextId !== null && String(previousId) !== String(nextId)) {
    USER_SCOPED_CACHE_KEYS.forEach((key) => window.localStorage.removeItem(key));
  }
  window.localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(user));
}

export function clearSession() {
  removeStorageKeys(window.localStorage, [ACCESS_TOKEN_KEY, USER_PROFILE_KEY, ...WOOSUNSHIN_AUTH_KEYS]);
  removeStorageKeys(window.sessionStorage, [ACCESS_TOKEN_KEY, USER_PROFILE_KEY, ...WOOSUNSHIN_AUTH_KEYS]);
  broadcastWoosunshinLogout();
}

export const expireSession = clearSession;

export function authHeaders() {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function authFetch(path, options = {}) {
  return apiFetch(path, {
    ...options,
    headers: {
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });
}

export async function refreshCurrentUser() {
  const token = getAccessToken();
  if (!token) {
    return null;
  }

  const response = await authFetch("/api/users/me");
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      clearSession();
    }
    return null;
  }

  const user = await response.json();
  setStoredUser(user);
  return user;
}

export const refreshProfile = refreshCurrentUser;
export const getStoredProfile = getStoredUser;

export function getLoginRedirectPath(user) {
  if (user && user.tier === "admin") {
    return "./admin.html";
  }
  return "./dashboard.html";
}

export async function loginAndStore(payload) {
  const response = await apiFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.detail || "로그인에 실패했습니다.");
  }

  setAccessToken(data.access_token);
  if (data.user) {
    setStoredUser(data.user);
  } else {
    await refreshCurrentUser();
  }

  return data;
}

export async function signupAndStore(payload) {
  const response = await apiFetch("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.detail || "회원가입에 실패했습니다.");
  }

  setAccessToken(data.access_token);
  if (data.user) {
    setStoredUser(data.user);
  }

  return data;
}

window.IMBOXER_AUTH = {
  getAccessToken,
  setAccessToken,
  hasAccessToken,
  getStoredUser,
  getStoredProfile,
  setStoredUser,
  clearSession,
  expireSession,
  authHeaders,
  authFetch,
  refreshCurrentUser,
  refreshProfile,
  getLoginRedirectPath,
  loginAndStore,
  signupAndStore,
};

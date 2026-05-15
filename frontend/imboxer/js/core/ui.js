import { clearSession, getStoredUser, refreshCurrentUser } from "./auth.js";

export function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) {
    element.textContent = value;
  }
}

export function setTextAll(selector, value) {
  document.querySelectorAll(selector).forEach((element) => {
    element.textContent = value;
  });
}

export function bindLogoutButtons() {
  document.querySelectorAll("[data-logout-button]").forEach((button) => {
    button.addEventListener("click", () => {
      clearSession();
      window.location.href = "/index.html";
    });
  });
}

export function renderUserFrame(user, overrides = {}) {
  const username = user?.username || overrides.username || "사용자";
  const tier = user?.tier || overrides.tier || "free";
  const summary = overrides.summary || `${username}님의 IM_BOXER 화면`;
  const tierText =
    overrides.tierText || `${tier} 사용자도 이 화면을 이용할 수 있습니다.`;
  const message =
    overrides.message ||
    "로그인 상태를 바탕으로 페이지 정보를 불러오고 있습니다.";
  const badge = overrides.badge || tier;

  setTextAll("[data-user-name]", username);
  setTextAll("[data-user-summary]", summary);
  setTextAll("[data-user-tier-badge]", badge);
  setTextAll("[data-user-tier-text]", tierText);
  setTextAll("[data-page-message]", message);
}

export async function hydratePage({
  requiresAuth = true,
  redirectPath = "./login.html",
  onUser,
  overrides = {},
} = {}) {
  bindLogoutButtons();

  const storedUser = getStoredUser();
  if (storedUser) {
    renderUserFrame(storedUser, overrides);
    if (typeof onUser === "function") {
      onUser(storedUser);
    }
  }

  const refreshedUser = await refreshCurrentUser();
  if (refreshedUser) {
    renderUserFrame(refreshedUser, overrides);
    if (typeof onUser === "function") {
      onUser(refreshedUser);
    }
    return refreshedUser;
  }

  if (requiresAuth && !storedUser) {
    window.location.href = redirectPath;
    return null;
  }

  return storedUser;
}

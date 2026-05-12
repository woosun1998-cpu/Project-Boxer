const ALT_FRONTEND_PORTS = new Set(["5001", "5501"]);
const DEFAULT_API_PORT = ALT_FRONTEND_PORTS.has(window.location.port) ? "8001" : "8000";

export const API_BASE_URL =
  window.IM_BOXER_API_BASE_URL ||
  window.localStorage?.getItem("IM_BOXER_API_BASE_URL") ||
  `http://127.0.0.1:${DEFAULT_API_PORT}`;
export const ACCESS_TOKEN_KEY = "im_boxer_access_token";
export const USER_PROFILE_KEY = "im_boxer_user_profile";

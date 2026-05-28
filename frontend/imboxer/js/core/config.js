const ALT_FRONTEND_PORTS = new Set(["5001", "5501"]);
const DEFAULT_API_PORT = ALT_FRONTEND_PORTS.has(window.location.port) ? "8001" : "8000";

function resolveImboxerApiBase() {
  const fromBuild =
    typeof window.__BOXER_API_URL__ === "string" ? window.__BOXER_API_URL__.trim() : "";
  if (fromBuild) return fromBuild.replace(/\/$/, "");
  if (window.IM_BOXER_API_BASE_URL) return String(window.IM_BOXER_API_BASE_URL).replace(/\/$/, "");
  const stored = window.localStorage?.getItem("IM_BOXER_API_BASE_URL");
  if (stored) return stored.replace(/\/$/, "");
  if (window.location.protocol === "https:") {
    return window.location.origin.replace(/\/$/, "");
  }
  return `http://127.0.0.1:${DEFAULT_API_PORT}`;
}

export const API_BASE_URL = resolveImboxerApiBase();
export const ACCESS_TOKEN_KEY = "im_boxer_access_token";
export const USER_PROFILE_KEY = "im_boxer_user_profile";

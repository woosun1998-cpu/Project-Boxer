const DEFAULT_API_BASE_URL = "http://localhost:8000";

export const API_BASE_URL = (() => {
  const fromWindow = window.BOXER_API_BASE_URL || window.API_BASE_URL;
  if (fromWindow) return String(fromWindow).replace(/\/$/, "");
  const saved = localStorage.getItem("boxer_api_base_url");
  if (saved) return String(saved).replace(/\/$/, "");
  return DEFAULT_API_BASE_URL;
})();
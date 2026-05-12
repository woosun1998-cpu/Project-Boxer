const ALT_FRONTEND_PORTS = new Set(["5001", "5501"]);
const DEFAULT_API_PORT = ALT_FRONTEND_PORTS.has(window.location.port) ? "8001" : "8000";
const DEFAULT_API_BASE_URL = `http://127.0.0.1:${DEFAULT_API_PORT}`;

export const API_BASE_URL =
  window.IM_BOXER_API_BASE_URL ||
  window.localStorage?.getItem("IM_BOXER_API_BASE_URL") ||
  DEFAULT_API_BASE_URL;

export function apiUrl(path) {
  if (!path) {
    return API_BASE_URL;
  }

  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  if (path.startsWith("/")) {
    return `${API_BASE_URL}${path}`;
  }

  return `${API_BASE_URL}/${path}`;
}

export async function apiFetch(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers || {}),
  };

  const request = (requestPath) =>
    fetch(apiUrl(requestPath), {
      ...options,
      headers,
    });

  const response = await request(path);
  if (response.status !== 404 || !path.startsWith("/api/")) {
    return response;
  }

  const fallbackPath = path.slice(4);
  return request(fallbackPath);
}

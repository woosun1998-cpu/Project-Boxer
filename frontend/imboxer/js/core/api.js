import { apiUrl, resolveApiPath } from "./config.js";

export { apiUrl, resolveApiPath };

export async function apiFetch(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers || {}),
  };

  const url = apiUrl(path);
  const response = await fetch(url, { ...options, headers });

  if (response.status !== 404 || !String(path).startsWith("/api/")) {
    return response;
  }

  const fallbackPath = String(path).slice(4);
  return fetch(apiUrl(fallbackPath), { ...options, headers });
}

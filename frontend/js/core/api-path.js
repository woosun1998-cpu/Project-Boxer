/**
 * API 경로 유틸
 * - API_URL(=window.__BOXER_API_URL__)가 있으면 해당 백엔드 절대 URL로 요청
 * - 없으면 같은 출처 상대 경로(/api/...)
 */
(function (global) {
  const DEFAULT_API_BASE = "https://my-backend.onrender.com";

  function getApiBase() {
    const raw =
      typeof global.__BOXER_API_URL__ === "string" ? global.__BOXER_API_URL__.trim() : "";
    return raw ? raw.replace(/\/$/, "") : DEFAULT_API_BASE;
  }

  function normalizePath(path) {
    if (path == null || path === "") return "/api";
    let p = String(path).trim();
    if (/^https?:\/\//i.test(p)) {
      try {
        const u = new URL(p, global.location?.href || "http://localhost");
        return u.pathname + u.search;
      } catch {
        return p;
      }
    }
    if (!p.startsWith("/")) p = "/" + p;
    return p;
  }

  function resolveApiPath(path) {
    const p = normalizePath(path);
    const base = getApiBase();
    if (!base) return p;
    if (/^https?:\/\//i.test(p)) return p;
    return base + p;
  }

  global.BoxerApiPath = { resolveApiPath, getApiBase };
})(typeof window !== "undefined" ? window : globalThis);

export function getApiBase() {
  if (typeof window !== "undefined" && window.BoxerApiPath) {
    return window.BoxerApiPath.getApiBase();
  }
  return "";
}

export function resolveApiPath(path) {
  if (typeof window !== "undefined" && window.BoxerApiPath) {
    return window.BoxerApiPath.resolveApiPath(path);
  }
  if (path == null || path === "") return "/api";
  let p = String(path).trim();
  if (!p.startsWith("/")) p = "/" + p;
  return p;
}

export const API_BASE_URL = getApiBase();

export function apiUrl(path) {
  return resolveApiPath(path);
}

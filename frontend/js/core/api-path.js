/**
 * API 요청 경로 — 항상 같은 출처 상대 경로 (/api/...)
 * localhost:8000 등 절대 URL을 쓰지 않습니다.
 */
(function (global) {
  function resolveApiPath(path) {
    if (path == null || path === "") return "/api";
    let p = String(path).trim();
    if (/^https?:\/\//i.test(p)) {
      try {
        const base = global.location?.href || "http://localhost";
        const u = new URL(p, base);
        return u.pathname + u.search;
      } catch {
        return p;
      }
    }
    if (!p.startsWith("/")) p = "/" + p;
    return p;
  }

  global.BoxerApiPath = { resolveApiPath };
})(typeof window !== "undefined" ? window : globalThis);

export function resolveApiPath(path) {
  if (typeof window !== "undefined" && window.BoxerApiPath) {
    return window.BoxerApiPath.resolveApiPath(path);
  }
  if (path == null || path === "") return "/api";
  let p = String(path).trim();
  if (/^https?:\/\//i.test(p)) {
    try {
      const u = new URL(p, window.location.href);
      return u.pathname + u.search;
    } catch {
      return p;
    }
  }
  if (!p.startsWith("/")) p = "/" + p;
  return p;
}

/** @deprecated 빈 문자열 — fetch는 resolveApiPath(path)만 사용 */
export const API_BASE_URL = "";

export function apiUrl(path) {
  return resolveApiPath(path);
}

function fallbackNormalize(path) {
  if (path == null || path === "") return "/api";
  let p = String(path).trim();
  if (!p.startsWith("/")) p = "/" + p;
  return p;
}

export function getApiBase() {
  if (typeof window !== "undefined" && window.BoxerApiPath?.getApiBase) {
    return window.BoxerApiPath.getApiBase();
  }
  return "";
}

export function resolveApiPath(path) {
  if (typeof window !== "undefined" && window.BoxerApiPath?.resolveApiPath) {
    return window.BoxerApiPath.resolveApiPath(path);
  }
  const p = fallbackNormalize(path);
  const base = getApiBase();
  if (!base) return p;
  if (/^https?:\/\//i.test(p)) return p;
  return base.replace(/\/$/, "") + p;
}

export const API_BASE_URL = getApiBase();

export function apiUrl(path) {
  return resolveApiPath(path);
}

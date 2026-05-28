/**
 * 영상 URL — 항상 사이트 루트 절대 경로 /video/파일명.mp4
 */
(function (global) {
  function normalizeVideoPath(input) {
    if (input == null || input === "") return "";
    let raw = String(input).trim();
    if (/^https?:\/\//i.test(raw)) {
      try {
        const u = new URL(raw);
        raw = u.pathname + u.search;
      } catch {
        return raw;
      }
    }
    raw = raw.replace(/^\.\/video\//, "/video/").replace(/^\.\//, "/");
    if (!raw.startsWith("/video/")) {
      if (raw.startsWith("/")) return raw;
      return "/video/" + encodeURIComponent(raw);
    }
    const qIdx = raw.indexOf("?");
    const query = qIdx >= 0 ? raw.slice(qIdx) : "";
    let tail = qIdx >= 0 ? raw.slice("/video/".length, qIdx) : raw.slice("/video/".length);
    if (!tail) return "/video/" + query;
    try {
      tail = decodeURIComponent(tail);
    } catch {
      /* keep */
    }
    if (!/%[0-9A-Fa-f]{2}/.test(tail)) {
      return "/video/" + encodeURIComponent(tail) + query;
    }
    return "/video/" + tail + query;
  }

  function videoUrl(fileName) {
    if (!fileName) return "/video/";
    const name = String(fileName).replace(/^\/video\//, "");
    return normalizeVideoPath("/video/" + name);
  }

  global.BoxerVideoPath = { normalizeVideoPath, videoUrl };
})(typeof window !== "undefined" ? window : globalThis);

// =============================================
// api.js — 백엔드 API 공통 fetch 래퍼
// 모든 API 호출은 이 파일을 통해서 처리
// =============================================

(function injectApiEnvSync() {
  if (typeof window.__BOXER_API_URL__ !== "undefined") return;
  var src = "/js/config/api-env.js";
  try {
    var current = document.currentScript;
    if (current && current.src) {
      src = current.src.replace(/\/core\/api\.js(\?.*)?$/i, "/config/api-env.js");
    }
  } catch (e) {
    /* ignore */
  }
  document.write('<script src="' + src + '"><\/script>');
})();

// backend/.env 의 PORT(Uvicorn)와 반드시 같게 유지합니다. (기본 8000)
const BOXER_API_PORT = 8000;
const BOXER_API_FALLBACK_PORTS = [8020];

function boxerApiHost() {
  if (window.location.protocol === "file:") return "localhost";
  return window.location.hostname || "localhost";
}

/** Vercel 빌드: process.env.API_URL → api-env.js → window.__BOXER_API_URL__ */
function getConfiguredApiUrl() {
  const raw = typeof window.__BOXER_API_URL__ === "string" ? window.__BOXER_API_URL__.trim() : "";
  if (!raw) return null;
  return raw.replace(/\/$/, "");
}

function boxerApiCandidates() {
  const configured = getConfiguredApiUrl();
  if (configured) return [configured];

  // HTTPS 배포: http://localhost 호출 시 Mixed Content 차단 → 같은 출처(또는 Vercel API_URL 설정)
  if (window.location.protocol === "https:") {
    return [window.location.origin.replace(/\/$/, "")];
  }

  const host = boxerApiHost();
  return [BOXER_API_PORT, ...BOXER_API_FALLBACK_PORTS].map(
    (port) => `http://${host}:${port}`,
  );
}

function resolveApiBase() {
  return boxerApiCandidates()[0];
}

const API_BASE = resolveApiBase();

const api = {
  async _fetch(url, options) {
    const bases = boxerApiCandidates();
    const path =
      typeof url === "string" ? url.replace(/^https?:\/\/[^/]+/, "") : "";
    try {
      return await fetch(url, options);
    } catch (err) {
      for (let i = 1; i < bases.length; i += 1) {
        try {
          return await fetch(`${bases[i]}${path}`, options);
        } catch {
          /* 다음 후보 */
        }
      }
      const msg = typeof err?.message === "string" ? err.message : "";
      const isNetwork =
        err instanceof TypeError ||
        msg.includes("Failed to fetch") ||
        msg.includes("Load failed") ||
        msg.includes("NetworkError");
      if (isNetwork) {
        const hint =
          window.location.protocol === "https:" && !getConfiguredApiUrl()
            ? " Vercel 환경 변수 API_URL에 HTTPS 백엔드 주소를 설정하세요."
            : "";
        throw new Error(
          `API 서버(${bases.join(", ")})에 연결되지 않습니다.${hint} ` +
            "백엔드 터미널을 켜 두세요. Windows: backend 폴더에서 .\\start-api.ps1 실행.",
        );
      }
      throw err;
    }
  },

  formatErrorDetail(detail, fallback) {
    if (!detail) return fallback;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      const text = detail
        .map((item) => {
          if (typeof item === "string") return item;
          if (item && typeof item === "object") {
            const msg = item.msg || item.message || "";
            const loc = Array.isArray(item.loc) ? item.loc.join(".") : "";
            if (msg && loc) return `${loc}: ${msg}`;
            return msg || JSON.stringify(item);
          }
          return String(item);
        })
        .filter(Boolean)
        .join("\n");
      return text || fallback;
    }
    if (typeof detail === "object") {
      return detail.message || JSON.stringify(detail);
    }
    return String(detail);
  },

  headers() {
    const token = localStorage.getItem("boxer_token");
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  },

  async _handleResponse(res, path) {
    if (res.status === 401) {
      localStorage.removeItem("boxer_token");
      window.location.href = "/index.html";
      throw new Error("인증이 만료되었습니다. 다시 로그인해주세요.");
    }
    if (res.status === 403) throw new Error("접근 권한이 없습니다.");
    if (res.status === 404)
      throw new Error("요청한 데이터를 찾을 수 없습니다.");
    if (res.status === 409) {
      const data = await res.json().catch(() => ({}));
      throw new Error(
        this.formatErrorDetail(data.detail, "이미 존재하는 데이터입니다."),
      );
    }
    if (res.status === 422) {
      const data = await res.json().catch(() => ({}));
      throw new Error(
        this.formatErrorDetail(data.detail, "입력값이 올바르지 않습니다."),
      );
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(
        this.formatErrorDetail(data.detail, `요청 실패 (${res.status})`),
      );
    }
    if (res.status === 204) return null;
    const payload = await res.json();

    if (
      payload &&
      typeof payload === "object" &&
      "success" in payload &&
      "data" in payload
    ) {
      return payload.data;
    }

    return payload;
  },

  async get(path) {
    const res = await this._fetch(`${API_BASE}${path}`, {
      headers: this.headers(),
    });
    return this._handleResponse(res, path);
  },

  async post(path, body) {
    const res = await this._fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    return this._handleResponse(res, path);
  },

  async postForm(path, formData) {
    const token = localStorage.getItem("boxer_token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const cleanPath =
      typeof path === "string" ? path.replace(/^https?:\/\/[^/]+/, "") : "";
    const bases = boxerApiCandidates();
    let lastNetworkErr = null;
    for (let i = 0; i < bases.length; i += 1) {
      try {
        const res = await fetch(`${bases[i]}${cleanPath}`, {
          method: "POST",
          headers,
          body: formData,
        });
        return await this._handleResponse(res, path);
      } catch (err) {
        const msg = typeof err?.message === "string" ? err.message : "";
        const isNetwork =
          err instanceof TypeError ||
          msg.includes("Failed to fetch") ||
          msg.includes("Load failed") ||
          msg.includes("NetworkError");
        lastNetworkErr = err;
        if (!isNetwork || i === bases.length - 1) throw err;
      }
    }
    throw lastNetworkErr || new Error("API 서버에 연결되지 않습니다.");
  },

  async put(path, body) {
    const res = await this._fetch(`${API_BASE}${path}`, {
      method: "PUT",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    return this._handleResponse(res, path);
  },

  async delete(path) {
    const res = await this._fetch(`${API_BASE}${path}`, {
      method: "DELETE",
      headers: this.headers(),
    });
    return this._handleResponse(res, path);
  },
};

window.api = api;

// =============================================
// api.js — 백엔드 API 공통 fetch 래퍼
// - API_URL 있으면 절대 URL
// - 없으면 /api/... 상대 경로
// =============================================

(function ensureApiHelpers() {
  var current = document.currentScript && document.currentScript.src ? document.currentScript.src : "";
  var base = current ? current.replace(/\/core\/api\.js(\?.*)?$/i, "") : "/js";

  if (!window.BoxerApiPath) {
    document.write('<script src="' + base + '/core/api-path.js"><\/script>');
  }
  if (typeof window.__BOXER_API_URL__ === "undefined") {
    document.write('<script src="' + base + '/config/api-env.js"><\/script>');
  }
})();

function resolveApiPath(path) {
  if (window.BoxerApiPath && window.BoxerApiPath.resolveApiPath) {
    return window.BoxerApiPath.resolveApiPath(path);
  }
  if (path == null || path === "") return "/api";
  var p = String(path).trim();
  if (!p.startsWith("/")) p = "/" + p;
  var isQuickTunnel = /\.trycloudflare\.com$/i.test(window.location && window.location.hostname ? window.location.hostname : "");
  if (isQuickTunnel) {
    return window.location.origin.replace(/\/$/, "") + p;
  }
  var raw = typeof window.__BOXER_API_URL__ === "string" ? window.__BOXER_API_URL__.trim() : "";
  if (!raw) return p;
  var base = raw.replace(/\/$/, "");
  return base + p;
}

const api = {
  async parseJsonSafe(res) {
    const text = await res.text().catch(() => "");
    if (!text) return { ok: true, data: null, text: "" };
    try {
      return { ok: true, data: JSON.parse(text), text };
    } catch {
      return { ok: false, data: null, text };
    }
  },

  async _fetch(path, options) {
    const url = resolveApiPath(path);
    try {
      return await fetch(url, options);
    } catch (err) {
      const msg = typeof err?.message === "string" ? err.message : "";
      const isNetwork =
        err instanceof TypeError ||
        msg.includes("Failed to fetch") ||
        msg.includes("Load failed") ||
        msg.includes("NetworkError");
      if (isNetwork) {
        throw new Error(`API(${url})에 연결되지 않습니다. API_URL 또는 /api rewrite를 확인하세요.`);
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

  async _handleResponse(res) {
    if (res.status === 401) {
      localStorage.removeItem("boxer_token");
      window.location.href = "/index.html";
      throw new Error("인증이 만료되었습니다. 다시 로그인해주세요.");
    }
    if (res.status === 403) throw new Error("접근 권한이 없습니다.");
    if (res.status === 404) throw new Error("요청한 데이터를 찾을 수 없습니다.");
    if (res.status === 409) {
      const data = await res.json().catch(() => ({}));
      throw new Error(this.formatErrorDetail(data.detail, "이미 존재하는 데이터입니다."));
    }
    if (res.status === 422) {
      const data = await res.json().catch(() => ({}));
      throw new Error(this.formatErrorDetail(data.detail, "입력값이 올바르지 않습니다."));
    }
    if (!res.ok) {
      const parsed = await this.parseJsonSafe(res);
      const detail = parsed.ok ? parsed.data?.detail : "";
      throw new Error(this.formatErrorDetail(detail, `요청 실패 (${res.status})`));
    }
    if (res.status === 204) return null;
    const parsed = await this.parseJsonSafe(res);
    if (!parsed.ok) {
      const sample = (parsed.text || "").slice(0, 80);
      if (/hello,\s*world!?/i.test(sample)) {
        throw new Error("API_URL이 앱 백엔드가 아닌 기본 서버를 가리키고 있습니다. Vercel API_URL 값을 확인하세요.");
      }
      throw new Error(`API 응답이 JSON 형식이 아닙니다: ${sample || "(empty)"}`);
    }
    const payload = parsed.data;
    if (payload && typeof payload === "object" && "success" in payload && "data" in payload) {
      return payload.data;
    }
    return payload;
  },

  async get(path) {
    return this._handleResponse(await this._fetch(path, { headers: this.headers() }));
  },

  async post(path, body) {
    return this._handleResponse(
      await this._fetch(path, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(body),
      }),
    );
  },

  async postForm(path, formData) {
    const token = localStorage.getItem("boxer_token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    return this._handleResponse(
      await this._fetch(path, {
        method: "POST",
        headers,
        body: formData,
      }),
    );
  },

  async put(path, body) {
    return this._handleResponse(
      await this._fetch(path, {
        method: "PUT",
        headers: this.headers(),
        body: JSON.stringify(body),
      }),
    );
  },

  async delete(path) {
    return this._handleResponse(
      await this._fetch(path, {
        method: "DELETE",
        headers: this.headers(),
      }),
    );
  },
};

window.api = api;

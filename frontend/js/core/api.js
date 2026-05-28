// =============================================
// api.js — 백엔드 API 공통 fetch 래퍼 (상대 경로 /api/... 만 사용)
// =============================================

function resolveApiPath(path) {
  if (window.BoxerApiPath && window.BoxerApiPath.resolveApiPath) {
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

const api = {
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
        throw new Error(
          `API(${url})에 연결되지 않습니다. 백엔드를 켜고, 로컬은 node scripts/serve-frontend.cjs 로 /api 프록시를 사용하세요.`,
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
    const res = await this._fetch(path, { headers: this.headers() });
    return this._handleResponse(res, path);
  },

  async post(path, body) {
    const res = await this._fetch(path, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    return this._handleResponse(res, path);
  },

  async postForm(path, formData) {
    const token = localStorage.getItem("boxer_token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await this._fetch(path, {
      method: "POST",
      headers,
      body: formData,
    });
    return this._handleResponse(res, path);
  },

  async put(path, body) {
    const res = await this._fetch(path, {
      method: "PUT",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    return this._handleResponse(res, path);
  },

  async delete(path) {
    const res = await this._fetch(path, {
      method: "DELETE",
      headers: this.headers(),
    });
    return this._handleResponse(res, path);
  },
};

window.api = api;

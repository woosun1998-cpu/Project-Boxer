// =============================================
// api.js — 백엔드 API 공통 fetch 래퍼
// 모든 API 호출은 이 파일을 통해서 처리
// =============================================

// backend/.env 의 PORT(Uvicorn)와 반드시 같게 유지합니다. (기본 8000)
// 무엇: 기본 포트를 8000으로 사용
// 왜: 현재 프로젝트 실행 가이드/백엔드 기본값과 일치시키기 위함
const BOXER_API_PORT = 8000;
// 무엇: 구버전 실행 환경(8020)도 자동 재시도
// 왜: 기존 로컬 설정 사용자도 로그인 실패 없이 동작하도록 하기 위함
const BOXER_API_FALLBACK_PORTS = [8020];

function boxerApiHost() {
  if (window.location.protocol === "file:") return "localhost";
  return window.location.hostname || "localhost";
}

const API_BASE = `http://${boxerApiHost()}:${BOXER_API_PORT}`;
function boxerApiCandidates() {
  const host = boxerApiHost();
  return [BOXER_API_PORT, ...BOXER_API_FALLBACK_PORTS].map(
    port => `http://${host}:${port}`,
  );
}

const api = {
  /**
   * fetch가 네트워크 단계에서 실패할 때(서버 미기동, 포트 불일치 등) 한글 안내로 바꿈
   * 왜: 브라우저 기본 메시지 "Failed to fetch"만으로는 원인 파악이 어렵기 때문
   */
  async _fetch(url, options) {
    const bases = boxerApiCandidates();
    const path = typeof url === "string" ? url.replace(/^https?:\/\/[^/]+/, "") : "";
    try {
      return await fetch(url, options);
    } catch (err) {
      // 기본 포트 실패 시 폴백 포트로 재시도
      for (let i = 1; i < bases.length; i += 1) {
        try {
          return await fetch(`${bases[i]}${path}`, options);
        } catch {
          // 다음 폴백 포트로 계속 시도
        }
      }
      const msg = typeof err?.message === "string" ? err.message : "";
      const isNetwork =
        err instanceof TypeError ||
        msg.includes("Failed to fetch") ||
        msg.includes("Load failed") ||
        msg.includes("NetworkError");
      if (isNetwork) {
        throw new Error(
          `API 서버(${bases.join(", ")})에 연결되지 않습니다. ` +
            "백엔드 터미널을 켜 두세요. Windows: backend 폴더에서 PowerShell로 .\\start-api.ps1 실행. " +
            "또는: py -3 -m uvicorn main:app --reload --host 0.0.0.0 --port 8000",
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
        .map(item => {
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

  // JWT 포함 공통 헤더 반환
  headers() {
    const token = localStorage.getItem("boxer_token");
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  },

  // 공통 응답 처리
  async _handleResponse(res, path) {
    if (res.status === 401) {
      // 인증 만료 → 토큰 삭제 후 로그인 페이지로
      localStorage.removeItem("boxer_token");
      window.location.href = "/index.html";
      throw new Error("인증이 만료되었습니다. 다시 로그인해주세요.");
    }
    if (res.status === 403) throw new Error("접근 권한이 없습니다.");
    if (res.status === 404)
      throw new Error("요청한 데이터를 찾을 수 없습니다.");
    if (res.status === 409) {
      const data = await res.json().catch(() => ({}));
      throw new Error(this.formatErrorDetail(data.detail, "이미 존재하는 데이터입니다."));
    }
    if (res.status === 422) {
      const data = await res.json().catch(() => ({}));
      throw new Error(this.formatErrorDetail(data.detail, "입력값이 올바르지 않습니다."));
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(this.formatErrorDetail(data.detail, `요청 실패 (${res.status})`));
    }
    // 204 No Content
    if (res.status === 204) return null;
    const payload = await res.json();

    // Backend responses commonly use { success, message, data }
    // Unwrap data so page code can work with plain objects and arrays.
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
    const cleanPath = typeof path === "string" ? path.replace(/^https?:\/\/[^/]+/, "") : "";
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



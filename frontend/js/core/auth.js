// =============================================
// auth.js — 인증 상태 관리
// 토큰 저장/삭제, 사용자 정보 캐싱, 보호 라우팅
// =============================================

const TOKEN_KEY = 'boxer_token';
const USER_KEY  = 'boxer_user';
const LOGGED_IN_KEY = 'boxer_logged_in';
const LAST_ACTIVITY_KEY = 'boxer_last_activity';
const AUTH_EVENT_KEY = 'boxer_auth_event';
const INACTIVITY_LIMIT_MS = 30 * 60 * 1000; // 30분

const auth = {

  // 토큰 저장
  saveToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
  },

  // 토큰 반환
  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  },

  // 로그인 상태 확인 (토큰 존재 여부만)
  isLoggedIn() {
    // 요청사항: 메모리/토큰보다 localStorage 플래그를 최우선
    if (localStorage.getItem(LOGGED_IN_KEY) === 'true') return true;
    return !!this.getToken();
  },

  // 사용자 정보 캐시에 저장
  saveUser(user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },

  markLoggedIn() {
    localStorage.setItem(LOGGED_IN_KEY, 'true');
    this.touchActivity();
    this.broadcastAuthEvent('login');
  },

  // 캐시에서 사용자 정보 반환
  getCachedUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY));
    } catch {
      return null;
    }
  },

  // 캐시 제거
  clearUser() {
    localStorage.removeItem(USER_KEY);
  },

  clearSessionData() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(LOGGED_IN_KEY);
    localStorage.removeItem(LAST_ACTIVITY_KEY);
  },

  touchActivity() {
    localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
  },

  getLastActivityTs() {
    const raw = localStorage.getItem(LAST_ACTIVITY_KEY);
    const ts = Number(raw);
    return Number.isFinite(ts) ? ts : 0;
  },

  isSessionExpired() {
    if (!this.isLoggedIn()) return false;
    const lastTs = this.getLastActivityTs();
    if (!lastTs) return true;
    return Date.now() - lastTs > INACTIVITY_LIMIT_MS;
  },

  handlePageLoadSessionCheck() {
    if (this.isSessionExpired()) {
      this.logout({ redirect: false, reason: 'expired' });
      return false;
    }
    if (this.isLoggedIn()) this.touchActivity();
    return this.isLoggedIn();
  },

  broadcastAuthEvent(type) {
    localStorage.setItem(
      AUTH_EVENT_KEY,
      JSON.stringify({ type, at: Date.now() }),
    );
  },

  startInactivityManager() {
    if (this._inactivitySetupDone) return;
    this._inactivitySetupDone = true;

    const activityEvents = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    const markActive = () => {
      if (this.isLoggedIn()) this.touchActivity();
    };
    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, markActive, { passive: true });
    });

    this._inactivityTimer = window.setInterval(() => {
      if (!this.isLoggedIn()) return;
      if (this.isSessionExpired()) {
        this.logout({ redirect: false, reason: 'expired' });
        alert('30분 동안 활동이 없어 자동 로그아웃되었습니다.');
      }
    }, 10000);
  },

  // 서버에서 최신 사용자 정보 불러오기
  // 실패 시 캐시 제거 (만료된 캐시 방어)
  async fetchCurrentUser() {
    try {
      const user = await api.get('/api/users/me');
      this.saveUser(user);
      return user;
    } catch (err) {
      // 401은 api.js가 토큰 삭제 + 리다이렉트 처리.
      // 네트워크 흔들림에서는 캐시를 유지해 UI 닉네임 깜빡임을 막는다.
      const cached = this.getCachedUser();
      return cached || null;
    }
  },

  // 토큰 유효성 검증 + 사용자 정보 로드
  // 페이지 진입 시 호출 — 토큰이 만료됐으면 로그아웃으로 처리
  async validateSession() {
    if (!this.handlePageLoadSessionCheck()) return false;

    // 캐시가 있으면 우선 true 반환 후 백그라운드 갱신
    const cached = this.getCachedUser();
    if (cached) {
      // 백그라운드에서 최신 정보 갱신 (401 시 api.js가 자동 로그아웃)
      this.fetchCurrentUser().catch(() => {});
      return true;
    }

    // 캐시 없으면 서버에서 직접 확인 (동기적으로 기다림)
    const user = await this.fetchCurrentUser();
    return !!user;
  },

  // 로그인 처리 (토큰 + 사용자 정보 저장)
  async login(email, password) {
    const data = await api.post('/api/auth/login', { email, password });
    this.saveToken(data.token || data.access_token);
    this.markLoggedIn();
    const user = await this.fetchCurrentUser();
    // 요청사항: 로그인 성공 시 user + 로그인 플래그 강제 저장
    if (user) this.saveUser(user);
    localStorage.setItem(LOGGED_IN_KEY, 'true');
    return user;
  },

  // 회원가입 처리
  async signup(username, email, password) {
    const data = await api.post('/api/auth/signup', { username, email, password });
    if (data.token || data.access_token) {
      this.saveToken(data.token || data.access_token);
      this.markLoggedIn();
      await this.fetchCurrentUser();
    }
    return data;
  },

  // 로그아웃
  logout(options = {}) {
    const { redirect = true, reason = 'manual' } = options;
    this.clearSessionData();
    this.broadcastAuthEvent(reason === 'expired' ? 'auto_logout' : 'logout');
    if (redirect) window.location.href = '/index.html';
  },

  // 보호된 페이지 동기 진입 체크 (토큰만 확인)
  // 미로그인 → index.html 리다이렉트
  requireAuth() {
    if (!this.isLoggedIn()) {
      window.location.href = '/index.html';
      return false;
    }
    return true;
  },

  // 보호된 페이지 비동기 진입 체크 (토큰 + 서버 검증)
  // 사용법: const user = await auth.requireAuthAsync();
  // 반환값: 유효한 User 객체, 또는 null (리다이렉트 발생)
  async requireAuthAsync() {
    if (!this.isLoggedIn()) {
      window.location.href = '/index.html';
      return null;
    }
    const cached = this.getCachedUser();
    if (cached) {
      // 백그라운드 갱신 (만료 시 자동 로그아웃)
      this.fetchCurrentUser().catch(() => {});
      return cached;
    }
    // 캐시 없으면 서버에서 직접 로드
    const user = await this.fetchCurrentUser();
    if (!user) {
      // fetchCurrentUser 실패 + 토큰 삭제가 안 된 경우 방어
      this.logout();
      return null;
    }
    return user;
  },

  // 이미 로그인된 상태이면 대시보드로 리다이렉트
  redirectIfLoggedIn() {
    if (this.isLoggedIn()) {
      window.location.href = '/dashboard.html';
      return true;
    }
    return false;
  }
};

auth.startInactivityManager();

// ─── 공통 UI 유틸 ───────────────────────────

// 토스트 메시지 표시
function showToast(message, type = 'info', duration = 3000) {
  document.querySelectorAll('.toast').forEach(el => el.remove());

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('show'));
  });

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// 버튼 로딩 상태 토글
function setButtonLoading(btn, loading, originalText = null) {
  if (loading) {
    btn.dataset.originalText = btn.textContent;
    btn.textContent = '처리 중...';
    btn.disabled = true;
  } else {
    btn.textContent = originalText || btn.dataset.originalText || btn.textContent;
    btn.disabled = false;
  }
}

/**
 * 무엇: 구글 드라이브 보기/공유 URL을 lh3 임베드 URL로 통일
 * 왜: uc?export=view 리다이렉트 응답이 로컬 호스트에서 img 로드를 막는 경우가 있어, googleusercontent 임베드가 안정적임
 * @param {string|null|undefined} u
 * @returns {string|null}
 */
auth.normalizeDriveProfileImageUrl = function (u) {
  if (u == null || u === '') return null;
  if (typeof u !== 'string') return null;
  if (u.indexOf('data:') === 0) return u;
  if (u.indexOf('lh3.googleusercontent.com/d/') >= 0) return u.split('#')[0].split('&_bxcb=')[0];
  if (u.indexOf('drive.google.com/uc?export=view&id=') >= 0) {
    var um = u.match(/id=([a-zA-Z0-9_-]+)/);
    if (um) return 'https://lh3.googleusercontent.com/d/' + um[1] + '=w2000';
  }
  if (u.indexOf('drive.google.com') === -1 && u.indexOf('/file/d/') === -1) return u;
  var id = null;
  var m = u.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m) id = m[1];
  if (!id) {
    m = u.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (m) id = m[1];
  }
  if (!id) return u;
  return 'https://lh3.googleusercontent.com/d/' + id + '=w2000';
};

// 다른 스크립트(navbar.js 등)에서 window.auth로 접근할 수 있게 전역 노출
window.auth = auth;

/**
 * admin.js
 * Admin Hub 컨트롤러
 *
 * 기존 기능:
 *   - admin 권한 체크 (tier === "admin")
 *   - 로그아웃
 *
 * 추가 기능 (Phase 1):
 *   - GET /api/admin/platform/overview → KPI 렌더링
 *   - 환경 배지 (LOCAL / DEV / PROD)
 *   - API 실패 시 graceful fallback (정적 "—" 표시)
 */

import { API_BASE_URL } from '../core/config.js';
import { clearSession, getStoredUser, refreshCurrentUser } from '../core/auth.js';

// ── 유틸 ─────────────────────────────────────────────────────────────────────

function redirectToLogin() {
  window.location.href = '/index.html';
}

function authHeaders() {
  const token = localStorage.getItem('im_boxer_access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── 환경 배지 ─────────────────────────────────────────────────────────────────

function renderEnvBadge() {
  const badge = document.getElementById('envBadge');
  if (!badge) return;
  const host = location.hostname;
  if (host === 'localhost' || host === '127.0.0.1' || host === '') {
    badge.textContent = 'LOCAL';
    badge.style.borderColor = 'rgba(245,166,35,0.35)';
    badge.style.color = '#f5a623';
  } else if (host.includes('dev') || host.includes('staging')) {
    badge.textContent = 'DEV';
    badge.style.borderColor = 'rgba(0,194,255,0.35)';
    badge.style.color = '#00c2ff';
  } else {
    badge.textContent = 'PROD';
    badge.style.borderColor = 'rgba(232,0,13,0.35)';
    badge.style.color = '#E8000D';
  }
}

// ── 유저 렌더 ─────────────────────────────────────────────────────────────────

function renderUser(user) {
  const name = user?.username || '관리자';
  const nameEl = document.querySelector('[data-user-name]');
  const summaryEl = document.querySelector('[data-user-summary]');
  if (nameEl) nameEl.textContent = name;
  if (summaryEl) summaryEl.textContent = `${name}님의 Admin Hub`;
}

// ── Overview API ──────────────────────────────────────────────────────────────

async function fetchOverview() {
  const res = await fetch(`${API_BASE_URL}/api/admin/platform/overview`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── KPI 렌더링 ────────────────────────────────────────────────────────────────

function renderKPIs(metrics) {
  if (!Array.isArray(metrics)) return;

  metrics.forEach(({ key, value, unit }) => {
    const el = document.querySelector(`[data-kpi="${key}"]`);
    if (!el) return;
    el.textContent = value != null ? String(value) : '—';
    el.classList.remove('adm-kpi-loading');

    // unit이 있으면 인접한 unit span에도 반영
    if (unit) {
      const unitEl = el.nextElementSibling;
      if (unitEl?.classList.contains('adm-kpi-unit')) {
        unitEl.textContent = unit;
      }
    }
  });
}

// ── 모듈 카드 동적 업데이트 ────────────────────────────────────────────────────

function applyModuleStatuses(modules) {
  if (!Array.isArray(modules)) return;

  // API가 반환한 모듈 상태를 기존 하드코딩된 카드에 반영하거나,
  // 알 수 없는 모듈은 새 카드로 추가할 수 있음 (Phase 2에서 확장)
  modules.forEach(mod => {
    // 현재는 상태 로깅만 — 카드 자체는 HTML에 하드코딩되어 있음
    console.debug('[admin] module from API:', mod.key, mod.status);
  });
}

// ── 최근 업데이트 시각 ─────────────────────────────────────────────────────────

function renderLastUpdated() {
  const label = document.getElementById('lastUpdatedLabel');
  if (!label) return;
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  label.textContent = `업데이트 ${hh}:${mm}`;
}

// ── API 오프라인 배너 ──────────────────────────────────────────────────────────

function showApiBanner(msg) {
  const banner = document.getElementById('apiBanner');
  const msgEl = document.getElementById('apiBannerMsg');
  if (banner) banner.classList.add('visible');
  if (msgEl && msg) msgEl.textContent = msg;
}

// ── Overview 로드 ─────────────────────────────────────────────────────────────

async function loadOverview() {
  try {
    const data = await fetchOverview();
    renderKPIs(data.metrics ?? []);
    applyModuleStatuses(data.modules ?? []);
    renderLastUpdated();
  } catch (err) {
    console.warn('[admin] overview API 연결 실패:', err.message);
    showApiBanner(`Overview API 연결 실패 (${err.message}) — 정적 데이터를 표시합니다. 백엔드 서버를 확인하세요.`);
    // KPI "—" 유지, 페이지 자체는 계속 동작
  }
}

// ── 로그아웃 바인딩 ───────────────────────────────────────────────────────────

function bindLogoutButtons() {
  document.querySelectorAll('[data-logout-button]').forEach(btn => {
    btn.addEventListener('click', () => {
      clearSession();
      redirectToLogin();
    });
  });
}

function normalizeAdminNav() {
  const links = {
    premium: { href: './admin/premium.html', badge: 'LIVE', live: true },
    analytics: { href: './admin/analytics.html', badge: 'LIVE', live: true },
    settings: { href: './admin/settings.html', badge: 'PREVIEW', live: false },
  };

  document.querySelectorAll('.adm-nav-item').forEach(item => {
    const label = item.textContent.trim().toLowerCase();
    const key = Object.keys(links).find(name => label.startsWith(name));
    if (!key) return;

    const target = links[key];
    item.classList.remove('disabled');
    item.removeAttribute('tabindex');
    item.href = target.href;

    const badge = item.querySelector('.adm-nav-badge');
    if (badge) {
      badge.textContent = target.badge;
      badge.classList.toggle('live', target.live);
    }
  });

  const seen = new Set();
  document.querySelectorAll('.adm-nav-item').forEach(item => {
    const label = item.textContent.trim().toLowerCase().split(/\s+/)[0];
    const key = `${label}:${item.getAttribute('href')}`;
    if (seen.has(key)) item.remove();
    else seen.add(key);
  });
}

// ── 초기화 ───────────────────────────────────────────────────────────────────

async function init() {
  renderEnvBadge();
  bindLogoutButtons();
  normalizeAdminNav();

  // 로컬 캐시 먼저 표시
  const storedUser = getStoredUser();
  if (storedUser) renderUser(storedUser);

  // 서버에서 최신 유저 정보 가져오기
  const refreshedUser = await refreshCurrentUser();
  if (!refreshedUser && !storedUser) {
    redirectToLogin();
    return;
  }

  const user = refreshedUser ?? storedUser;

  // admin 권한 체크 (기존 로직 유지)
  if (user?.tier !== 'admin') {
    redirectToLogin();
    return;
  }

  renderUser(user);

  // Overview API 로드 (실패해도 페이지는 계속 동작)
  await loadOverview();
}

document.addEventListener('DOMContentLoaded', () => {
  init().catch(() => redirectToLogin());
});

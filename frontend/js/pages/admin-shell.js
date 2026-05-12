import { API_BASE_URL } from '../core/config.js';

export { API_BASE_URL };

const TOKEN_KEYS = ['boxer_token', 'im_boxer_access_token'];
const USER_KEYS = ['boxer_user', 'im_boxer_user_profile'];
const LOGGED_IN_KEYS = ['boxer_logged_in'];

function firstStored(keys) {
  for (const key of keys) {
    const value = localStorage.getItem(key);
    if (value) return value;
  }
  return null;
}

export function redirectToLogin() {
  window.location.href = location.pathname.includes('/admin/') ? '../index.html' : './index.html';
}

export function authHeaders() {
  const token = firstStored(TOKEN_KEYS);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function getStoredUser() {
  for (const key of USER_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    } catch {}
  }
  return null;
}

export function saveStoredUser(user) {
  if (!user) return;
  localStorage.setItem('boxer_user', JSON.stringify(user));
  localStorage.setItem('boxer_logged_in', 'true');
}

export function clearSession() {
  [...TOKEN_KEYS, ...USER_KEYS, ...LOGGED_IN_KEYS, 'boxer_last_activity'].forEach((key) => localStorage.removeItem(key));
  localStorage.setItem('boxer_auth_event', JSON.stringify({ type: 'logout', at: Date.now() }));
}

export async function refreshCurrentUser() {
  const headers = authHeaders();
  if (!headers.Authorization) return null;
  try {
    const res = await fetch(`${API_BASE_URL}/api/users/me`, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = await res.json();
    const user = payload?.data ?? payload;
    saveStoredUser(user);
    return user;
  } catch {
    return null;
  }
}

function isAdmin(user) {
  if (!user || typeof user !== 'object') return false;
  const tier = String(user.tier || '').toLowerCase();
  const role = String(user.role || '').toLowerCase();
  return tier === 'admin' || role === 'admin' || role === 'superadmin' || user.is_admin === true || user.is_superuser === true;
}

export function renderEnvBadge() {
  const badge = document.getElementById('envBadge');
  if (!badge) return;
  const host = location.hostname;
  badge.textContent = host === 'localhost' || host === '127.0.0.1' || host === '' ? 'LOCAL' : 'PROD';
}

export function bindLogout() {
  document.querySelectorAll('[data-logout-button]').forEach((btn) => {
    btn.addEventListener('click', () => { clearSession(); redirectToLogin(); });
  });
}

export function normalizeAdminNav() {
  const inAdminDir = /\/admin\//.test(location.pathname.replace(/\\/g, '/'));
  const prefix = inAdminDir ? './' : './admin/';
  const links = {
    premium: { href: `${prefix}premium.html`, badge: 'LIVE', live: true },
    analytics: { href: `${prefix}analytics.html`, badge: 'LIVE', live: true },
    settings: { href: `${prefix}settings.html`, badge: 'PREVIEW', live: false },
  };

  document.querySelectorAll('.adm-nav-item').forEach((item) => {
    const label = item.textContent.trim().toLowerCase();
    const key = Object.keys(links).find((name) => label.startsWith(name));
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
}

export async function initAdminShell(options = {}) {
  renderEnvBadge();
  bindLogout();
  normalizeAdminNav();

  const storedUser = getStoredUser();
  if (storedUser) {
    setAdminName(storedUser.username);
    options.onUser?.(storedUser);
  }

  const refreshedUser = await refreshCurrentUser();
  const user = refreshedUser ?? storedUser;
  if (!user || !isAdmin(user)) { redirectToLogin(); return null; }

  setAdminName(user.username);
  options.onUser?.(user);
  return user;
}

function setAdminName(name) {
  const el = document.querySelector('[data-admin-name]');
  if (el) el.textContent = name || '관리자';
  const userNameEl = document.querySelector('[data-user-name]');
  if (userNameEl) userNameEl.textContent = name || '관리자';
  const summaryEl = document.querySelector('[data-user-summary]');
  if (summaryEl) summaryEl.textContent = `${name || '관리자'}의 Admin Hub`;
}
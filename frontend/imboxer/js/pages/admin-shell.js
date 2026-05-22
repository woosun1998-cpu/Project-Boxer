/**
 * admin-shell.js
 * Admin Platform 공통 shell 초기화 모듈
 * frontend/admin/*.html 페이지에서 import 하여 사용
 */

import { API_BASE_URL } from '../core/config.js';
import { clearSession, getStoredUser, refreshCurrentUser } from '../core/auth.js';

export { API_BASE_URL };

export function redirectToLogin() {
  window.location.href = '/index.html';
}

export function authHeaders() {
  const token = localStorage.getItem('im_boxer_access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function renderEnvBadge() {
  const badge = document.getElementById('envBadge');
  if (!badge) return;
  const host = location.hostname;
  if (host === 'localhost' || host === '127.0.0.1' || host === '') {
    badge.textContent = 'LOCAL';
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

export function bindLogout() {
  document.querySelectorAll('[data-logout-button]').forEach(btn => {
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

/**
 * Admin 페이지 공통 초기화.
 * @param {{ onUser?: (user: object) => void }} options
 */
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
  if (!refreshedUser && !storedUser) { redirectToLogin(); return null; }

  const user = refreshedUser ?? storedUser;
  if (user?.tier !== 'admin') { redirectToLogin(); return null; }

  setAdminName(user.username);
  options.onUser?.(user);
  return user;
}

function setAdminName(name) {
  const el = document.querySelector('[data-admin-name]');
  if (el) el.textContent = name || '관리자';
}

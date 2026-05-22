import { API_BASE_URL, authHeaders, clearSession, getStoredUser, initAdminShell } from './admin-shell.js';

function redirectToLogin() {
  window.location.href = './index.html';
}

function renderUser(user) {
  const name = user?.username || '관리자';
  const nameEl = document.querySelector('[data-user-name]');
  const summaryEl = document.querySelector('[data-user-summary]');
  if (nameEl) nameEl.textContent = name;
  if (summaryEl) summaryEl.textContent = `${name}의 Admin Hub`;
}

async function fetchOverview() {
  const res = await fetch(`${API_BASE_URL}/api/admin/platform/overview`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function renderKPIs(metrics) {
  if (!Array.isArray(metrics)) return;
  metrics.forEach(({ key, value, unit }) => {
    const el = document.querySelector(`[data-kpi="${key}"]`);
    if (!el) return;
    el.textContent = value != null ? String(value) : '-';
    el.classList.remove('adm-kpi-loading');
    if (unit) {
      const unitEl = el.nextElementSibling;
      if (unitEl?.classList.contains('adm-kpi-unit')) unitEl.textContent = unit;
    }
  });
}

function renderLastUpdated() {
  const label = document.getElementById('lastUpdatedLabel');
  if (!label) return;
  const now = new Date();
  label.textContent = `업데이트 ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function showApiBanner(msg) {
  const banner = document.getElementById('apiBanner');
  const msgEl = document.getElementById('apiBannerMsg');
  if (banner) banner.classList.add('visible');
  if (msgEl && msg) msgEl.textContent = msg;
}

async function loadOverview() {
  try {
    const data = await fetchOverview();
    renderKPIs(data.metrics ?? []);
    renderLastUpdated();
  } catch (err) {
    showApiBanner(`Overview API 연결 실패 (${err.message}) - 백엔드 서버를 확인하세요.`);
  }
}

function bindLogoutButtons() {
  document.querySelectorAll('[data-logout-button]').forEach((btn) => {
    btn.addEventListener('click', () => { clearSession(); redirectToLogin(); });
  });
}

async function init() {
  bindLogoutButtons();
  const storedUser = getStoredUser();
  if (storedUser) renderUser(storedUser);
  const user = await initAdminShell({ onUser: renderUser });
  if (!user) return;
  await loadOverview();
}

document.addEventListener('DOMContentLoaded', () => {
  init().catch(() => redirectToLogin());
});
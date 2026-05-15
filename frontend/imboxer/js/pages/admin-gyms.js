import { initAdminShell, API_BASE_URL, authHeaders } from './admin-shell.js';

let selectedRadius = 3000;

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[ch]));

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' });
}

function setHidden(id, hidden) {
  const el = document.getElementById(id);
  if (el) el.hidden = hidden;
}

function renderFavoriteOverview(data) {
  const metrics = data.metrics || {};
  document.getElementById('statTotal').textContent = (metrics.total_favorites ?? 0).toLocaleString();
  document.getElementById('statToday').textContent = (metrics.today_favorites ?? 0).toLocaleString();
  document.getElementById('statTopQuery').textContent = `${(metrics.unique_gyms ?? 0).toLocaleString()}개 체육관`;
  document.getElementById('statUsers').textContent = (metrics.users_with_favorites ?? 0).toLocaleString();

  const topGyms = data.top_gyms || [];
  document.getElementById('topGymsTbody').innerHTML = topGyms.map((gym, index) => {
    const address = gym.road_address || gym.address || '-';
    const link = gym.place_url
      ? `<a href="${esc(gym.place_url)}" target="_blank" rel="noopener" style="color:var(--ice);font-size:0.72rem">카카오맵</a>`
      : '-';
    return `
      <tr>
        <td>${index + 1}</td>
        <td style="font-weight:800;color:var(--t1)">${esc(gym.name)}</td>
        <td>${esc(address)}</td>
        <td style="color:var(--ice);font-weight:800">${Number(gym.favorite_count || 0).toLocaleString()}</td>
        <td>${formatDate(gym.last_saved_at)}</td>
        <td>${link}</td>
      </tr>
    `;
  }).join('');
  setHidden('topGymsEmpty', topGyms.length !== 0);

  const regions = data.regions || [];
  document.getElementById('regionTbody').innerHTML = regions.map(row => `
    <tr>
      <td style="font-weight:800;color:var(--t1)">${esc(row.region)}</td>
      <td style="color:var(--ice);font-weight:800">${Number(row.favorite_count || 0).toLocaleString()}</td>
    </tr>
  `).join('');
  setHidden('regionEmpty', regions.length !== 0);

  const recent = data.recent_favorites || [];
  document.getElementById('recentTbody').innerHTML = recent.map(row => `
    <tr>
      <td style="font-weight:800;color:var(--t1)">${esc(row.username)}</td>
      <td>${esc(row.email)}</td>
      <td>${esc(row.name)}</td>
      <td>${esc(row.road_address || row.address || '-')}</td>
      <td>${formatDate(row.saved_at)}</td>
    </tr>
  `).join('');
  setHidden('recentEmpty', recent.length !== 0);
}

async function loadFavoriteOverview() {
  setHidden('favoriteLoading', false);
  setHidden('favoriteOverview', true);
  setHidden('favoriteError', true);

  try {
    const res = await fetch(`${API_BASE_URL}/api/admin/gyms/favorites`, { headers: authHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    renderFavoriteOverview(await res.json());
    setHidden('favoriteOverview', false);
  } catch (err) {
    document.getElementById('favoriteErrorMsg').textContent = `관심 체육관 집계 로드 실패 (${err.message})`;
    setHidden('favoriteError', false);
  } finally {
    setHidden('favoriteLoading', true);
  }
}

function bindRadiusButtons() {
  document.getElementById('radiusGroup')?.addEventListener('click', e => {
    const btn = e.target.closest('.btn-radius');
    if (!btn) return;
    document.querySelectorAll('.btn-radius').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedRadius = Number(btn.dataset.radius);
  });
}

async function runSearch() {
  const query = document.getElementById('searchQuery')?.value.trim() || '복싱장';
  const lat = parseFloat(document.getElementById('searchLat')?.value) || 37.5665;
  const lng = parseFloat(document.getElementById('searchLng')?.value) || 126.9780;

  setHidden('searchLoading', false);
  setHidden('searchResultWrap', true);
  setHidden('searchError', true);

  try {
    const params = new URLSearchParams({ query, lat, lng, radius_m: selectedRadius, provider: 'kakao' });
    const res = await fetch(`${API_BASE_URL}/api/boxing-gyms/nearby?${params}`, { headers: authHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const items = data.items ?? [];

    document.getElementById('resultTbody').innerHTML = items.map((gym, i) => {
      const dist = gym.distance_m < 1000 ? `${gym.distance_m}m` : `${(gym.distance_m / 1000).toFixed(1)}km`;
      const link = gym.place_url
        ? `<a href="${esc(gym.place_url)}" target="_blank" rel="noopener" style="color:var(--ice);font-size:0.72rem">카카오맵</a>`
        : '-';
      return `
        <tr>
          <td>${i + 1}</td>
          <td style="font-weight:700;color:var(--t1);max-width:160px;overflow:hidden;text-overflow:ellipsis">${esc(gym.name)}</td>
          <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis">${esc(gym.road_address || gym.address || '-')}</td>
          <td>${esc(gym.phone || '-')}</td>
          <td style="color:var(--ice)">${dist}</td>
          <td style="font-size:0.68rem;color:var(--t4)">${esc(gym.id)}</td>
          <td>${link}</td>
        </tr>
      `;
    }).join('');

    document.getElementById('resultMeta').textContent =
      `${items.length}개 결과 / "${query}" / 반경 ${selectedRadius / 1000}km / lat:${lat} lng:${lng}`;
    setHidden('searchResultWrap', false);
  } catch (err) {
    document.getElementById('searchErrorMsg').textContent = `검색 오류: ${err.message}`;
    setHidden('searchError', false);
  } finally {
    setHidden('searchLoading', true);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  bindRadiusButtons();
  document.getElementById('btnSearch')?.addEventListener('click', runSearch);
  document.getElementById('searchQuery')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') runSearch();
  });

  initAdminShell()
    .then(user => { if (user) loadFavoriteOverview(); })
    .catch(() => { window.location.href = '/index.html'; });
});

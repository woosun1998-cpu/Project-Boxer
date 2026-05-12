/**
 * boxing-gyms.js
 * 내 주변 복싱장 찾기 페이지 컨트롤러
 *
 * 의존:
 *   - window.IM_BOXER_MAP_CONFIG  (frontend/js/mapConfig.js)
 *   - backend GET /api/boxing-gyms/nearby
 *   - Kakao Map JavaScript SDK (동적 로딩)
 */

import { API_BASE_URL } from '../core/config.js';
import { clearSession } from '../core/auth.js';

// ── 상수 ────────────────────────────────────────────────────────────────────

const DEFAULT_CENTER = { lat: 37.5665, lng: 126.9780 }; // 서울 시청
const DEFAULT_RADIUS = 3000;
const KAKAO_SDK_SCRIPT_ID = 'im-boxer-kakao-map-sdk';
const KAKAO_SDK_TIMEOUT_MS = 12000;

// ── 상태 ────────────────────────────────────────────────────────────────────

const state = {
  map: null,
  gymOverlays: [],         // kakao.maps.CustomOverlay[]
  currentPosOverlay: null, // kakao.maps.CustomOverlay
  currentPos: null,        // { lat, lng }
  selectedRadius: DEFAULT_RADIUS,
  selectedQuery: '복싱장',
  gymsById: new Map(),     // id → gym 객체
  favoriteGyms: [],
  mapReady: false,
  mapSdkReady: false,
  mapSdkPromise: null,
  mapSdkError: null,
};

// ── Kakao Map SDK 동적 로더 ─────────────────────────────────────────────────

function waitForKakaoMaps(timeoutMs = KAKAO_SDK_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();

    function finishWhenReady() {
      if (window.kakao?.maps?.load) {
        window.kakao.maps.load(() => {
          state.mapSdkReady = true;
          state.mapSdkError = null;
          resolve();
        });
        return;
      }

      if (Date.now() - startedAt >= timeoutMs) {
        reject(new Error(
          '카카오맵 SDK 응답 시간이 초과되었습니다.\n' +
          '네트워크, JavaScript 키, 카카오 Web 플랫폼 도메인 등록을 확인하세요.'
        ));
        return;
      }

      window.setTimeout(finishWhenReady, 80);
    }

    finishWhenReady();
  });
}

function loadKakaoMapSDK() {
  return new Promise((resolve, reject) => {
    const key = String(window.IM_BOXER_MAP_CONFIG?.KAKAO_JAVASCRIPT_KEY || '').trim();

    if (!key || key === 'YOUR_KAKAO_JAVASCRIPT_KEY_HERE') {
      reject(new Error(
        '카카오 지도 API 키가 설정되지 않았습니다.\n' +
        'frontend/js/mapConfig.js 파일에서 KAKAO_JAVASCRIPT_KEY를 설정하세요.'
      ));
      return;
    }

    // 이미 로드된 경우
    if (window.kakao?.maps) {
      waitForKakaoMaps().then(resolve, reject);
      return;
    }

    const existingScript = document.getElementById(KAKAO_SDK_SCRIPT_ID);
    if (existingScript) {
      waitForKakaoMaps().then(resolve, reject);
      return;
    }

    const script = document.createElement('script');
    script.id = KAKAO_SDK_SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false&libraries=services`;
    script.onload = () => {
      waitForKakaoMaps().then(resolve, reject);
    };
    script.onerror = () => {
      script.remove();
      reject(new Error(
        '카카오맵 SDK 로딩에 실패했습니다.\n' +
        '카카오 JavaScript 키와 Web 플랫폼 도메인 등록을 확인하세요.\n' +
        '로컬 개발 도메인: http://localhost:5500, http://127.0.0.1:5500'
      ));
    };
    document.head.appendChild(script);
  });
}

function ensureKakaoMapSDK() {
  if (state.mapSdkReady && window.kakao?.maps) return Promise.resolve();
  if (!state.mapSdkPromise) {
    state.mapSdkPromise = loadKakaoMapSDK()
      .then(() => {
        state.mapSdkReady = true;
        state.mapSdkError = null;
      })
      .catch((err) => {
        state.mapSdkReady = false;
        state.mapSdkError = err;
        state.mapSdkPromise = null;
        throw err;
      });
  }
  return state.mapSdkPromise;
}

function getKakaoMaps() {
  return window.kakao?.maps || null;
}

// ── 지도 초기화 ──────────────────────────────────────────────────────────────

function initMap(lat, lng) {
  const maps = getKakaoMaps();
  if (!maps) {
    throw new Error('카카오맵이 아직 준비되지 않았습니다.');
  }

  const container = document.getElementById('boxingGymMap');

  // placeholder 제거
  const placeholder = document.getElementById('mapPlaceholder');
  if (placeholder) placeholder.remove();

  state.map = new maps.Map(container, {
    center: new maps.LatLng(lat, lng),
    level: 5,
  });
  state.mapReady = true;
}

function panMapTo(lat, lng) {
  const maps = getKakaoMaps();
  if (!state.map || !maps) return;
  state.map.panTo(new maps.LatLng(lat, lng));
}

function scrollToMap() {
  document.getElementById('boxingGymMap')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ── 마커 관리 ────────────────────────────────────────────────────────────────

function setCurrentPosOverlay(lat, lng) {
  const maps = getKakaoMaps();
  if (!state.map || !maps) return;
  if (state.currentPosOverlay) state.currentPosOverlay.setMap(null);

  const el = document.createElement('div');
  el.className = 'gym-map-here';
  el.innerHTML = `
    <div class="gym-map-here-dot"></div>
    <span class="gym-map-here-label">현재 위치</span>
  `;

  state.currentPosOverlay = new maps.CustomOverlay({
    position: new maps.LatLng(lat, lng),
    content: el,
    yAnchor: 1.3,
    zIndex: 5,
  });
  state.currentPosOverlay.setMap(state.map);
}

function clearGymOverlays() {
  state.gymOverlays.forEach(o => o.setMap(null));
  state.gymOverlays = [];
}

function renderGymOverlays(gyms) {
  const maps = getKakaoMaps();
  clearGymOverlays();
  if (!state.map || !maps) return;

  gyms.forEach((gym, i) => {
    const el = document.createElement('div');
    el.className = 'gym-map-marker';
    el.innerHTML = `<span>${i + 1}</span>`;
    el.title = gym.name;

    el.addEventListener('click', () => {
      panMapTo(gym.lat, gym.lng);
      highlightCard(gym.id);
      // 해당 카드로 스크롤
      const card = document.querySelector(`.gym-card[data-gym-id="${CSS.escape(gym.id)}"]`);
      card?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });

    const overlay = new maps.CustomOverlay({
      position: new maps.LatLng(gym.lat, gym.lng),
      content: el,
      yAnchor: 1,
      zIndex: 3,
    });
    overlay.setMap(state.map);
    state.gymOverlays.push(overlay);
  });

  // 결과 개수 업데이트
  const mapCount = document.getElementById('mapCount');
  if (mapCount) mapCount.textContent = gyms.length ? `${gyms.length}개 표시 중` : '—';
}

// ── API 호출 ─────────────────────────────────────────────────────────────────

async function fetchNearbyBoxingGyms(query, lat, lng, radiusM) {
  const params = new URLSearchParams({
    query,
    lat: String(lat),
    lng: String(lng),
    radius_m: String(radiusM),
    provider: 'kakao',
  });
  const res = await fetch(`${API_BASE_URL}/api/boxing-gyms/nearby?${params}`);

  if (!res.ok) {
    let detail = `서버 오류 (${res.status})`;
    try {
      const body = await res.json();
      const raw = body?.detail;
      if (typeof raw === 'string') {
        detail = raw;
      } else if (raw?.message) {
        detail = raw.message;
      } else if (raw?.error) {
        detail = raw.error;
      }
    } catch {}
    throw new Error(String(detail));
  }

  return res.json();
}

// ── 거리 포맷 ────────────────────────────────────────────────────────────────

function formatDistance(m) {
  if (m == null) return '—';
  if (m < 1000) return `${Math.round(m)}m`;
  return `${(m / 1000).toFixed(1)}km`;
}

// ── XSS 방지 ─────────────────────────────────────────────────────────────────

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getAuthToken() {
  return localStorage.getItem('im_boxer_access_token');
}

// ── 카드 렌더링 ──────────────────────────────────────────────────────────────

function renderGymCards(gyms) {
  const grid = document.getElementById('gymResultsGrid');
  const wrap = document.getElementById('gymResultsWrap');
  const countEl = document.getElementById('resultsCount');

  grid.innerHTML = '';
  state.gymsById.clear();

  if (!gyms.length) {
    wrap.hidden = true;
    showStatus('empty', '검색 결과 없음',
      '주변에 해당 검색어의 복싱장이 없습니다.\n반경을 늘리거나 다른 키워드로 검색해보세요.');
    return;
  }

  if (countEl) countEl.textContent = `${gyms.length}개`;
  wrap.hidden = false;

  gyms.forEach((gym, i) => {
    state.gymsById.set(gym.id, gym);

    const addr = esc(gym.road_address || gym.address || '주소 정보 없음');
    const phoneLine = gym.phone
      ? `<p class="gym-card-phone">📞 ${esc(gym.phone)}</p>`
      : '';
    const providerBadge = gym.provider
      ? `<span class="gym-card-provider">${esc(gym.provider)}</span>`
      : '';

    const card = document.createElement('div');
    card.className = 'gym-card';
    card.dataset.gymId = gym.id;
    card.innerHTML = `
      <div class="gym-card-top">
        <span class="gym-card-num">${i + 1}</span>
        <h3 class="gym-card-name">${esc(gym.name)}</h3>
      </div>
      <p class="gym-card-addr">${addr}</p>
      ${phoneLine}
      <div class="gym-card-meta">
        <span class="gym-card-dist">${formatDistance(gym.distance_m)}</span>
        ${providerBadge}
      </div>
      <div class="gym-card-actions">
        <button class="btn-gym-action map" type="button" data-action="map">🗺 지도에서 보기</button>
        <button class="btn-gym-action" type="button" data-action="dir">🧭 길찾기</button>
        <button class="btn-gym-action fav" type="button" data-action="fav">★ 관심 체육관</button>
      </div>
    `;

    // 카드 클릭 (버튼 제외): 지도 이동 + 강조
    card.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      panMapTo(gym.lat, gym.lng);
      highlightCard(gym.id);
    });

    // 버튼별 이벤트
    card.querySelectorAll('button[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        if (action === 'map') {
          panMapTo(gym.lat, gym.lng);
          highlightCard(gym.id);
          scrollToMap();
        } else if (action === 'dir') {
          openDirections(gym);
        } else if (action === 'fav') {
          saveFavoriteGym(gym);
        }
      });
    });

    grid.appendChild(card);
  });
}

// ── 카드 강조 ────────────────────────────────────────────────────────────────

function highlightCard(gymId) {
  document.querySelectorAll('.gym-card').forEach(c => c.classList.remove('active'));
  const target = document.querySelector(`.gym-card[data-gym-id="${CSS.escape(gymId)}"]`);
  if (target) {
    target.classList.add('active');
    target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

// ── 길찾기 ───────────────────────────────────────────────────────────────────

function openDirections(gym) {
  if (gym.place_url) {
    window.open(gym.place_url, '_blank', 'noopener,noreferrer');
    return;
  }
  // fallback: 카카오맵 검색 URL
  const kakaoFallback = `https://map.kakao.com/link/search/${encodeURIComponent(gym.name)}`;
  window.open(kakaoFallback, '_blank', 'noopener,noreferrer');
}

// ── 관심 체육관 ──────────────────────────────────────────────────────────────

async function saveFavoriteGym(gym) {
  const token = getAuthToken();
  if (!token) {
    alert('관심 체육관 저장은 로그인 후 이용 가능합니다.');
    return;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/boxing-gyms/favorites`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        gym_id: gym.id,
        name: gym.name,
        address: gym.address || '',
        road_address: gym.road_address || '',
        phone: gym.phone || '',
        lat: gym.lat,
        lng: gym.lng,
        place_url: gym.place_url || '',
        provider: gym.provider || 'kakao',
      }),
    });

    if (res.status === 409) {
      alert('이미 저장된 관심 체육관입니다.');
      return;
    }
    if (!res.ok) throw new Error(`저장 실패 (${res.status})`);

    alert(`"${gym.name}"이(가) 관심 체육관에 저장되었습니다.`);
    if (!document.getElementById('favoriteGymsModal')?.hidden) {
      await loadFavoriteGyms();
    }
  } catch (err) {
    console.error('[boxing-gyms] saveFavoriteGym error:', err);
    alert(`관심 체육관 저장 중 오류가 발생했습니다.\n${err.message}`);
  }
}

function getFavoriteRegion(gym) {
  const address = String(gym.road_address || gym.address || '').trim();
  if (!address) return '지역 정보 없음';

  const parts = address.split(/\s+/).filter(Boolean);
  const first = parts[0] || '지역 정보 없음';
  const second = parts[1] || '';

  const cityMap = {
    서울특별시: '서울',
    부산광역시: '부산',
    대구광역시: '대구',
    인천광역시: '인천',
    광주광역시: '광주',
    대전광역시: '대전',
    울산광역시: '울산',
    세종특별자치시: '세종',
    경기도: '경기',
    강원특별자치도: '강원',
    강원도: '강원',
    충청북도: '충북',
    충청남도: '충남',
    전라북도: '전북',
    전북특별자치도: '전북',
    전라남도: '전남',
    경상북도: '경북',
    경상남도: '경남',
    제주특별자치도: '제주',
  };

  const city = cityMap[first] || first;
  if (!second) return city;
  return `${city} ${second}`;
}

function groupFavoritesByRegion(items) {
  return items.reduce((groups, gym) => {
    const region = getFavoriteRegion(gym);
    if (!groups.has(region)) groups.set(region, []);
    groups.get(region).push(gym);
    return groups;
  }, new Map());
}

function renderFavoriteGyms(items) {
  const body = document.getElementById('favoriteGymsBody');
  if (!body) return;

  state.favoriteGyms = items;

  if (!items.length) {
    body.innerHTML = '<div class="gym-favorites-state">아직 저장한 관심 체육관이 없습니다.<br>검색 결과에서 ★ 관심 체육관을 눌러 저장해보세요.</div>';
    return;
  }

  const groups = Array.from(groupFavoritesByRegion(items).entries())
    .sort(([a], [b]) => a.localeCompare(b, 'ko'));

  body.innerHTML = groups.map(([region, gyms]) => `
    <section class="gym-favorites-region" aria-label="${esc(region)} 관심 체육관">
      <h3 class="gym-favorites-region-title">${esc(region)} <span>${gyms.length}</span></h3>
      <div class="gym-favorites-list">
        ${gyms.map(gym => {
          const addr = esc(gym.road_address || gym.address || '주소 정보 없음');
          const phone = gym.phone ? `<p class="gym-favorite-phone">📞 ${esc(gym.phone)}</p>` : '';
          return `
            <article class="gym-favorite-card" data-favorite-id="${gym.id}">
              <h4 class="gym-favorite-name">${esc(gym.name)}</h4>
              <p class="gym-favorite-addr">${addr}</p>
              ${phone}
              <div class="gym-favorite-actions">
                <button class="btn-favorite-mini" type="button" data-favorite-action="dir" data-favorite-id="${gym.id}">길찾기</button>
                <button class="btn-favorite-mini danger" type="button" data-favorite-action="delete" data-favorite-id="${gym.id}">삭제</button>
              </div>
            </article>
          `;
        }).join('')}
      </div>
    </section>
  `).join('');
}

async function loadFavoriteGyms() {
  const token = getAuthToken();
  const body = document.getElementById('favoriteGymsBody');

  if (!token) {
    if (body) body.innerHTML = '<div class="gym-favorites-state">관심 체육관 목록은 로그인 후 이용 가능합니다.</div>';
    return;
  }

  if (body) body.innerHTML = '<div class="gym-favorites-state">관심 체육관 목록을 불러오는 중입니다.</div>';

  try {
    const res = await fetch(`${API_BASE_URL}/api/boxing-gyms/favorites`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (res.status === 401 || res.status === 403) {
      throw new Error('로그인이 만료되었습니다. 다시 로그인해주세요.');
    }
    if (!res.ok) throw new Error(`목록 조회 실패 (${res.status})`);

    const data = await res.json();
    renderFavoriteGyms(data.items || []);
  } catch (err) {
    console.error('[boxing-gyms] loadFavoriteGyms error:', err);
    if (body) body.innerHTML = `<div class="gym-favorites-state">관심 체육관을 불러오지 못했습니다.<br>${esc(err.message)}</div>`;
  }
}

function openFavoritesModal() {
  const modal = document.getElementById('favoriteGymsModal');
  if (!modal) return;
  modal.hidden = false;
  document.body.classList.add('gym-modal-open');
  loadFavoriteGyms();
}

function closeFavoritesModal() {
  const modal = document.getElementById('favoriteGymsModal');
  if (!modal) return;
  modal.hidden = true;
  document.body.classList.remove('gym-modal-open');
}

async function deleteFavoriteGym(favoriteId) {
  const token = getAuthToken();
  const gym = state.favoriteGyms.find(item => String(item.id) === String(favoriteId));
  const label = gym?.name ? `"${gym.name}"` : '이 체육관';

  if (!token) {
    alert('관심 체육관 삭제는 로그인 후 이용 가능합니다.');
    return;
  }
  if (!confirm(`${label}을(를) 관심 체육관에서 삭제할까요?`)) return;

  try {
    const res = await fetch(`${API_BASE_URL}/api/boxing-gyms/favorites/${favoriteId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!res.ok) throw new Error(`삭제 실패 (${res.status})`);
    await loadFavoriteGyms();
  } catch (err) {
    console.error('[boxing-gyms] deleteFavoriteGym error:', err);
    alert(`관심 체육관 삭제 중 오류가 발생했습니다.\n${err.message}`);
  }
}

// ── 상태 UI ──────────────────────────────────────────────────────────────────

function showLoading(show) {
  const el = document.getElementById('gymLoading');
  if (el) el.hidden = !show;
}

/**
 * @param {'error'|'empty'|'permission'|'map-error'} type
 * @param {string} title
 * @param {string} desc
 */
function showStatus(type, title, desc) {
  const wrap = document.getElementById('gymStatus');
  const icon = document.getElementById('statusIcon');
  const titleEl = document.getElementById('statusTitle');
  const descEl = document.getElementById('statusDesc');

  if (!wrap) return;

  const icons = {
    error: { text: 'ERROR', cls: 'red' },
    empty: { text: 'ZERO', cls: 'muted' },
    permission: { text: 'LOCK', cls: 'muted' },
    'map-error': { text: 'MAP', cls: 'ice' },
  };
  const cfg = icons[type] || icons.error;

  if (icon) { icon.textContent = cfg.text; icon.className = `gym-status-icon ${cfg.cls}`; }
  if (titleEl) titleEl.textContent = title;
  if (descEl) descEl.textContent = desc;

  wrap.hidden = false;
}

function setMapPlaceholder(title, desc) {
  const placeholder = document.getElementById('mapPlaceholder');
  if (!placeholder) return;
  placeholder.innerHTML = `
    <strong>${esc(title)}</strong>
    ${esc(desc).replace(/\n/g, '<br>')}
  `;
}

function setMapSectionVisible(visible) {
  const section = document.querySelector('.gym-map-section');
  if (section) section.hidden = !visible;
}

function showMapUnavailable(err) {
  const message = err?.message || '카카오맵을 초기화하지 못했습니다.';
  console.warn('[boxing-gyms] Kakao Map SDK 로드 실패:', message);
  setMapSectionVisible(false);
  setMapPlaceholder('지도 사용 불가', `${message}\n\n검색 결과 목록은 계속 사용할 수 있습니다.`);
}

function hideStatus() {
  const el = document.getElementById('gymStatus');
  if (el) el.hidden = true;
}

// ── 검색 실행 ────────────────────────────────────────────────────────────────

async function doSearch(query, pos) {
  showLoading(true);
  hideStatus();
  document.getElementById('gymResultsWrap').hidden = true;

  const btnSearch = document.getElementById('btnSearch');
  const btnMy = document.getElementById('btnMyLocation');
  const btnSeoul = document.getElementById('btnSeoulCity');
  if (btnSearch) btnSearch.disabled = true;
  if (btnMy) btnMy.disabled = true;
  if (btnSeoul) btnSeoul.disabled = true;

  try {
    const data = await fetchNearbyBoxingGyms(query, pos.lat, pos.lng, state.selectedRadius);
    const gyms = data.items ?? [];

    renderGymCards(gyms);

    try {
      await ensureKakaoMapSDK();
      setMapSectionVisible(true);

      // 지도 초기화 (아직 안 된 경우)
      if (!state.mapReady) {
        initMap(pos.lat, pos.lng);
      } else {
        panMapTo(pos.lat, pos.lng);
      }

      setCurrentPosOverlay(pos.lat, pos.lng);
      renderGymOverlays(gyms);
      if (gyms.length) hideStatus();
    } catch (mapErr) {
      console.warn('[boxing-gyms] map render skipped:', mapErr);
      showMapUnavailable(mapErr);
      if (gyms.length) {
        showStatus('map-error', '지도 로딩 실패',
          `${mapErr.message || '카카오맵을 초기화하지 못했습니다.'}\n\n검색 결과 목록은 정상적으로 표시됩니다.`);
      }
    }

  } catch (err) {
    showStatus('error', 'API 오류', err.message || '검색 중 오류가 발생했습니다.');
    console.error('[boxing-gyms] fetchNearbyBoxingGyms error:', err);
  } finally {
    showLoading(false);
    if (btnSearch) btnSearch.disabled = false;
    if (btnMy) btnMy.disabled = false;
    if (btnSeoul) btnSeoul.disabled = false;
  }
}

// ── 내 위치로 찾기 ───────────────────────────────────────────────────────────

async function handleMyLocation() {
  if (!navigator.geolocation) {
    showStatus('permission', '위치 정보 미지원',
      '이 브라우저는 위치 정보 기능을 지원하지 않습니다.\n서울 시청 기준 검색을 이용해 주세요.');
    return;
  }

  showLoading(true);
  hideStatus();
  const txtEl = document.querySelector('#gymLoading .gym-loading-text');
  if (txtEl) txtEl.textContent = '현재 위치를 가져오는 중...';

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      state.currentPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      if (txtEl) txtEl.textContent = '검색 중...';
      doSearch(state.selectedQuery, state.currentPos);
    },
    (err) => {
      showLoading(false);
      let msg = '위치 권한이 거부되었습니다. 브라우저 설정에서 위치 권한을 허용하거나\n서울 시청 기준 검색을 이용해 주세요.';
      if (err.code === err.TIMEOUT) msg = '위치 정보 요청이 시간 초과되었습니다.\n서울 시청 기준 검색을 이용해 주세요.';
      showStatus('permission', '위치 권한 필요', msg);
    },
    { timeout: 10000, enableHighAccuracy: false }
  );
}

// ── 서울 시청 기준 검색 ──────────────────────────────────────────────────────

function handleSeoulCity() {
  state.currentPos = { ...DEFAULT_CENTER };
  doSearch(state.selectedQuery, state.currentPos);
}

// ── 검색어 처리 ──────────────────────────────────────────────────────────────

function handleSearch() {
  const input = document.getElementById('searchInput');
  const query = input?.value.trim() || state.selectedQuery;
  if (!query) return;

  state.selectedQuery = query;

  // 직접 입력 시 퀵 태그 활성 해제
  document.querySelectorAll('.gym-tag').forEach(t => {
    t.classList.toggle('active', t.dataset.query === query);
  });

  const pos = state.currentPos ?? DEFAULT_CENTER;
  doSearch(query, pos);
}

// ── 이벤트 바인딩 ────────────────────────────────────────────────────────────

function bindEvents() {
  // 내 위치 버튼
  document.getElementById('btnMyLocation')?.addEventListener('click', handleMyLocation);

  // 서울 시청 버튼
  document.getElementById('btnSeoulCity')?.addEventListener('click', handleSeoulCity);

  // 검색 버튼
  document.getElementById('btnSearch')?.addEventListener('click', handleSearch);

  // 관심 체육관 모달
  document.getElementById('btnOpenFavorites')?.addEventListener('click', openFavoritesModal);
  document.getElementById('btnCloseFavorites')?.addEventListener('click', closeFavoritesModal);
  document.getElementById('favoriteGymsModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'favoriteGymsModal') closeFavoritesModal();
  });
  document.getElementById('favoriteGymsBody')?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-favorite-action]');
    if (!btn) return;

    const favoriteId = btn.dataset.favoriteId;
    const gym = state.favoriteGyms.find(item => String(item.id) === String(favoriteId));
    if (!gym) return;

    if (btn.dataset.favoriteAction === 'dir') {
      openDirections(gym);
    } else if (btn.dataset.favoriteAction === 'delete') {
      deleteFavoriteGym(favoriteId);
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeFavoritesModal();
  });

  // 검색 입력 Enter
  document.getElementById('searchInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSearch();
  });

  // 퀵 태그
  document.getElementById('quickTagsContainer')?.addEventListener('click', (e) => {
    const tag = e.target.closest('.gym-tag');
    if (!tag) return;

    document.querySelectorAll('.gym-tag').forEach(t => t.classList.remove('active'));
    tag.classList.add('active');

    state.selectedQuery = tag.dataset.query;
    const input = document.getElementById('searchInput');
    if (input) input.value = '';

    const pos = state.currentPos ?? DEFAULT_CENTER;
    doSearch(state.selectedQuery, pos);
  });

  // 반경 버튼
  document.getElementById('radiusBtnsContainer')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-radius');
    if (!btn) return;

    document.querySelectorAll('.btn-radius').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    state.selectedRadius = Number(btn.dataset.radius);

    // 현재 위치가 있으면 즉시 재검색
    if (state.currentPos) {
      doSearch(state.selectedQuery, state.currentPos);
    }
  });

  // 로그아웃 버튼 (선택적 — 로그인 상태일 때만 동작)
  document.querySelectorAll('[data-logout-button]').forEach(btn => {
    btn.addEventListener('click', () => {
      clearSession();
      window.location.href = '/index.html';
    });
  });
}

// ── 초기화 ───────────────────────────────────────────────────────────────────

async function init() {
  bindEvents();

  // Kakao Map SDK 로드 (지도 API 키가 없어도 검색은 가능하도록 분리)
  ensureKakaoMapSDK().catch((err) => {
    showMapUnavailable(err);
    showStatus('map-error', '지도 로딩 실패',
      err.message + '\n\n검색 결과 목록은 정상적으로 표시됩니다.');
  });
}

init();

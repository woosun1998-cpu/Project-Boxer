/**
 * diet-boxing.js — 다이어트 복싱 전용 UI + MediaPipe 포즈 분석
 * 무엇: 라운드 타이머와 자세/활동 점수 시스템을 제공합니다.
 * 왜: 본 프로젝트와 분리된 실험 화면에서 기능 검증을 먼저 하기 위함입니다.
 */

(function () {
  'use strict';

  /** @typedef {{ id: string; label: string; rounds: number; workSec: number; restSec: number; met: number; desc: string }} Program */

  /** MET: 가벼운 복싱 움직임 기준 대략값 (참고용, 의학적 소모칼로리 아님) */
  /** @type {Program[]} */
  const PROGRAMS = [
    { id: 'light', label: '라이트', rounds: 4, workSec: 120, restSec: 45, met: 5.5, desc: '그림자복싱·가벼운 스텝 위주. 입문·유산소 비중.' },
    { id: 'standard', label: '스탠다드', rounds: 6, workSec: 180, restSec: 60, met: 7.0, desc: '콤비네이션·라운드 리듬. 일반적인 다이어트 루틴.' },
    { id: 'intense', label: '인텐스', rounds: 8, workSec: 180, restSec: 45, met: 8.5, desc: '고강도 인터벌 느낌. 숙련자·단기 집중용.' },
  ];

  /** 난이도별 추천 유튜브 링크 */
  const PROGRAM_VIDEO_LINKS = {
    light: [
      { title: '입문 15분', url: 'https://www.youtube.com/watch?v=Q7VZf-2SwA0' },
      { title: '기초 박싱', url: 'https://www.youtube.com/watch?v=7boGs9qujYA' },
      { title: '라이트 20분', url: 'https://www.youtube.com/watch?v=jhrKZXo4xH8' },
    ],
    standard: [
      { title: '팔로우 20분', url: 'https://www.youtube.com/watch?v=HSJD58U9InM' },
      { title: '콤보 20분', url: 'https://www.youtube.com/watch?v=dW0SRTg0sxk' },
      { title: '기본 30분', url: 'https://www.youtube.com/watch?v=IwRDZdV78c4' },
    ],
    intense: [
      { title: 'HIIT 20분', url: 'https://www.youtube.com/watch?v=HV7D7TDnOLo' },
      { title: '카디오 30분', url: 'https://www.youtube.com/watch?v=2FgmRsQWSsI' },
      { title: 'KO 인터벌', url: 'https://www.youtube.com/watch?v=r81EZ7pyumc' },
    ],
  };

  const STORAGE_KEY = 'boxer_diet_boxing_weight_kg';
  const STORAGE_TUNING_KEY = 'boxer_diet_boxing_tuning_v1';
  const STORAGE_SESSION_KEY = 'boxer_diet_sessions_v1';
  const STORAGE_REF_PROFILE_KEY = 'boxer_diet_ref_profiles_v1';
  const STORAGE_ANALYZE_TIMEOUT_KEY = 'boxer_diet_analyze_timeout_sec_v1';
  const DEFAULT_ANALYZE_TIMEOUT_SEC = 45;

  /** 기본 튜닝값 — 슬라이더와 동일한 의미로 유지합니다. */
  const DEFAULT_TUNING = {
    shoulderTol: 0.08,
    hipTol: 0.09,
    guardBias: 0.25,
    guardRange: 0.35,
    wristSpeedMin: 0.018,
    elbowMinDeg: 142,
    elbowDeltaDeg: 6,
    movementDivisor: 0.06,
    cadenceBonus: 0.3,
    punchCooldownMs: 220,
    postureWeight: 0.7,
    minVisibility: 0.35,
    feedbackTotalHigh: 85,
    feedbackPostureLow: 60,
    feedbackActivityLow: 45,
    segmentReachActive: 1.45,
    segmentElbowActive: 0.78,
  };

  /** 프리셋: 실험용으로 빠르게 전환 */
  const PRESETS = {
    strict: {
      shoulderTol: 0.055,
      hipTol: 0.065,
      guardBias: 0.22,
      guardRange: 0.3,
      wristSpeedMin: 0.022,
      elbowMinDeg: 148,
      elbowDeltaDeg: 8,
      movementDivisor: 0.07,
      cadenceBonus: 0.25,
      punchCooldownMs: 260,
      postureWeight: 0.78,
      minVisibility: 0.42,
      feedbackTotalHigh: 88,
      feedbackPostureLow: 65,
      feedbackActivityLow: 50,
      segmentReachActive: 1.5,
      segmentElbowActive: 0.82,
    },
    normal: { ...DEFAULT_TUNING },
    loose: {
      shoulderTol: 0.12,
      hipTol: 0.12,
      guardBias: 0.29,
      guardRange: 0.42,
      wristSpeedMin: 0.012,
      elbowMinDeg: 134,
      elbowDeltaDeg: 4,
      movementDivisor: 0.048,
      cadenceBonus: 0.38,
      punchCooldownMs: 170,
      postureWeight: 0.62,
      minVisibility: 0.26,
      feedbackTotalHigh: 78,
      feedbackPostureLow: 52,
      feedbackActivityLow: 38,
      segmentReachActive: 1.38,
      segmentElbowActive: 0.72,
    },
  };

  /** @type {typeof DEFAULT_TUNING} */
  let tuning = { ...DEFAULT_TUNING };

  /** @type {Program | null} */
  let selected = PROGRAMS[1];
  /** @type {'idle' | 'work' | 'rest' | 'done'} */
  let phase = 'idle';
  let roundIndex = 0;
  let remainingSec = 0;
  let timerId = null;
  let workSecondsTotal = 0;

  /** 점수 집계 상태 */
  let punchCount = 0;
  let postureScoreAvg = 0;
  let activityScoreAvg = 0;
  let scoreSampleCount = 0;

  /** 분석 입력 상태 */
  let stream = null;
  let cameraInstance = null;
  let pose = null;
  let rafId = 0;
  let runningMode = 'idle'; // idle | camera | upload_preview | upload_ref
  let sourceReady = false;
  let uploadedFileUrl = '';
  let uploadedFile = null;
  let isBuildingReference = false;
  let wasRunningBeforeHidden = false;
  let obstacleCaptureCanvas = null;
  let obstacleDetectBusy = false;
  let lastObstacleDetectAt = 0;
  let lastObstacleWarnAt = 0;

  const OBSTACLE_DETECT_INTERVAL_MS = 450;
  const OBSTACLE_DETECT_CONF = 0.25;
  const OBSTACLE_DETECT_IMGSZ = 640;
  const OBSTACLE_DETECT_JPEG_QUALITY = 0.72;
  const OBSTACLE_WARN_HOLD_MS = 2500;
  const OBSTACLE_DANGER_CLASSES = new Set(['chair', 'desk', 'dining table', 'laptop', 'keyboard', 'mouse', 'tv', 'bottle', 'cup', 'couch', 'book']);
  const OBSTACLE_LABEL_KO = {
    chair: '의자',
    desk: '책상',
    'dining table': '책상',
    laptop: '노트북',
    keyboard: '키보드',
    mouse: '마우스',
    tv: 'TV',
    bottle: '병',
    cup: '컵',
    couch: '소파',
    book: '책',
  };

  /** 기준 영상 벡터 비교 상태 */
  let referenceVectors = [];
  let referenceFrameCounter = 0;
  let similaritySmoothed = 0;
  let similarityHistory = [];
  let lastSimilarityAt = 0;
  let similarityBest = 0;
  let similaritySum = 0;
  let similarityCount = 0;
  let liveRecentVectors = [];
  let refCursor = 0;
  let currentSegment = 'guard';
  let segmentStats = {
    guard: { sum: 0, count: 0 },
    left: { sum: 0, count: 0 },
    right: { sum: 0, count: 0 },
    both: { sum: 0, count: 0 },
  };
  let coachingStats = {
    shoulderPenalty: 0,
    guardPenalty: 0,
    activityPenalty: 0,
    samples: 0,
  };
  let reportStats = {
    shoulderGapSum: 0,
    hipGapSum: 0,
    guardAvgSum: 0,
    leftReachSum: 0,
    rightReachSum: 0,
    leftElbowNormSum: 0,
    rightElbowNormSum: 0,
    samples: 0,
  };
  let coachLevel = 'normal';
  let ttsEnabled = false;
  let lastSpokenCue = '';
  let lastSpokenAt = 0;
  let lastLiveCue = '';
  let lastLiveCueLevel = 0;
  let lastLiveCueAt = 0;
  let referenceProfiles = [];

  /** 펀치 감지를 위한 이전 프레임 값 */
  let prev = {
    leftWristX: null,
    rightWristX: null,
    leftElbowAngle: null,
    rightElbowAngle: null,
    lastPunchAt: 0,
  };

  const byId = (...ids) => {
    for (let i = 0; i < ids.length; i += 1) {
      const node = document.getElementById(ids[i]);
      if (node) return node;
    }
    return null;
  };

  const ensureHiddenElement = (id, tagName, attrs = {}) => {
    let node = document.getElementById(id);
    if (node) return node;
    node = document.createElement(tagName);
    node.id = id;
    node.hidden = true;
    Object.keys(attrs).forEach((key) => {
      node.setAttribute(key, attrs[key]);
    });
    document.body.appendChild(node);
    return node;
  };

  const el = {
    programs: document.getElementById('diet-programs'),
    phase: document.getElementById('diet-phase'),
    round: document.getElementById('diet-round'),
    timer: document.getElementById('diet-time'),
    timerHint: document.getElementById('diet-timer-hint'),
    ring: document.getElementById('diet-ring-progress'),
    kcal: document.getElementById('diet-kcal'),
    start: byId('diet-start', 'diet-session-start'),
    pause: document.getElementById('diet-pause'),
    reset: document.getElementById('diet-reset'),
    weight: document.getElementById('diet-weight'),
    cameraStart: document.getElementById('diet-camera-start'),
    cameraStop: document.getElementById('diet-camera-stop'),
    upload: document.getElementById('diet-video-upload'),
    sourceVideo: byId('diet-source-video', 'diet-sample-video'),
    overlay: document.getElementById('diet-overlay'),
    scorePosture: document.getElementById('diet-score-posture'),
    scoreActivity: document.getElementById('diet-score-activity'),
    scoreTotal: document.getElementById('diet-score-total'),
    punchCount: document.getElementById('diet-punch-count'),
    feedback: document.getElementById('diet-feedback'),
    similarity: document.getElementById('diet-similarity'),
    referenceStatus: document.getElementById('diet-reference-status'),
    latency: document.getElementById('diet-latency'),
    similarityGraph: document.getElementById('diet-similarity-graph'),
    similarityAvg: document.getElementById('diet-sim-avg'),
    similarityBest: document.getElementById('diet-sim-best'),
    segmentLabel: document.getElementById('diet-segment-label'),
    segmentScore: document.getElementById('diet-segment-score'),
    segGuard: document.getElementById('diet-seg-guard'),
    segLeft: document.getElementById('diet-seg-left'),
    segRight: document.getElementById('diet-seg-right'),
    segBoth: document.getElementById('diet-seg-both'),
    liveCue: document.getElementById('diet-live-cue'),
    roundSummaryText: document.getElementById('diet-round-summary-text'),
    finalReportList: document.getElementById('diet-final-report-list'),
    coachLevel: document.getElementById('diet-coach-level'),
    ttsEnabled: document.getElementById('diet-tts-enabled'),
    refName: document.getElementById('diet-ref-name'),
    refProfileSelect: document.getElementById('diet-ref-profile-select'),
    refSaveProfile: document.getElementById('diet-ref-save-profile'),
    refLoadProfile: document.getElementById('diet-ref-load-profile'),
    refDeleteProfile: document.getElementById('diet-ref-delete-profile'),
    sessionHistory: document.getElementById('diet-session-history'),
    exportCsv: document.getElementById('diet-export-csv'),
    youtubeEmbed: document.getElementById('diet-youtube-embed'),
    youtubeStatus: document.getElementById('diet-youtube-status'),
    tuningPanel: document.getElementById('diet-tuning'),
    tuningResetScores: document.getElementById('diet-tuning-reset-scores'),
    tuningResetBtn: document.getElementById('diet-tuning-reset'),
    videoStack: document.getElementById('diet-video-stack'),
    refBuild: document.getElementById('diet-ref-build'),
    refClear: document.getElementById('diet-ref-clear'),
    refProgress: document.getElementById('diet-ref-progress'),
    refProgressFill: document.getElementById('diet-ref-progress-fill'),
    analyzeTimeout: document.getElementById('diet-analyze-timeout'),
    analyzeTimeoutReset: document.getElementById('diet-analyze-timeout-reset'),
  };

  if (!el.weight) el.weight = ensureHiddenElement('diet-weight', 'input', { type: 'number', value: '65' });
  if (!el.kcal) el.kcal = ensureHiddenElement('diet-kcal', 'span');
  if (!el.timer) el.timer = ensureHiddenElement('diet-time', 'time');
  if (!el.timerHint) el.timerHint = ensureHiddenElement('diet-timer-hint', 'small');
  if (!el.ring) el.ring = ensureHiddenElement('diet-ring-progress', 'circle');
  if (!el.start) el.start = ensureHiddenElement('diet-start', 'button', { type: 'button' });
  if (!el.pause) el.pause = ensureHiddenElement('diet-pause', 'button', { type: 'button' });
  if (!el.reset) el.reset = ensureHiddenElement('diet-reset', 'button', { type: 'button' });

  const ctx = el.overlay ? el.overlay.getContext('2d') : null;
  const graphCtx = el.similarityGraph ? el.similarityGraph.getContext('2d') : null;

  /**
   * 무엇: 튜닝 값을 안전 범위로 맞춥니다.
   * 왜: 슬라이더/저장 데이터가 깨져도 분석 루프가 멈추지 않게 하기 위함입니다.
   */
  function clampTuning(raw) {
    const o = { ...DEFAULT_TUNING, ...raw };
    o.shoulderTol = Math.min(0.14, Math.max(0.04, o.shoulderTol));
    o.hipTol = Math.min(0.14, Math.max(0.05, o.hipTol));
    o.guardBias = Math.min(0.35, Math.max(0.15, o.guardBias));
    o.guardRange = Math.min(0.45, Math.max(0.25, o.guardRange));
    o.wristSpeedMin = Math.min(0.035, Math.max(0.008, o.wristSpeedMin));
    o.elbowMinDeg = Math.min(165, Math.max(120, o.elbowMinDeg));
    o.elbowDeltaDeg = Math.min(15, Math.max(2, o.elbowDeltaDeg));
    o.movementDivisor = Math.min(0.12, Math.max(0.03, o.movementDivisor));
    o.cadenceBonus = Math.min(0.5, Math.max(0.1, o.cadenceBonus));
    o.punchCooldownMs = Math.min(400, Math.max(120, o.punchCooldownMs));
    o.postureWeight = Math.min(0.85, Math.max(0.3, o.postureWeight));
    o.minVisibility = Math.min(0.6, Math.max(0.2, o.minVisibility));
    o.feedbackTotalHigh = Math.min(95, Math.max(70, o.feedbackTotalHigh));
    o.feedbackPostureLow = Math.min(80, Math.max(40, o.feedbackPostureLow));
    o.feedbackActivityLow = Math.min(70, Math.max(25, o.feedbackActivityLow));
    o.segmentReachActive = Math.min(1.8, Math.max(1.2, o.segmentReachActive));
    o.segmentElbowActive = Math.min(0.95, Math.max(0.65, o.segmentElbowActive));
    return o;
  }

  function loadTuning() {
    try {
      const raw = localStorage.getItem(STORAGE_TUNING_KEY);
      if (!raw) return clampTuning({});
      const parsed = JSON.parse(raw);
      return clampTuning(parsed);
    } catch (e) {
      return clampTuning({});
    }
  }

  function loadJsonStorage(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed || fallback;
    } catch (e) {
      return fallback;
    }
  }

  function saveJsonStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      /* 저장 실패 무시 */
    }
  }

  function renderSessionHistory() {
    if (!el.sessionHistory) return;
    const sessions = loadJsonStorage(STORAGE_SESSION_KEY, []);
    el.sessionHistory.innerHTML = '';
    if (!sessions.length) {
      const li = document.createElement('li');
      li.textContent = '저장된 세션이 없습니다.';
      el.sessionHistory.appendChild(li);
      return;
    }
    sessions.slice(0, 8).forEach((s) => {
      const li = document.createElement('li');
      li.textContent = `${s.at} · ${s.program} · 평균 ${s.avg}% · 최고 ${s.best}% · 펀치 ${s.punches}회`;
      el.sessionHistory.appendChild(li);
    });
  }

  function exportSessionHistoryCsv() {
    const sessions = loadJsonStorage(STORAGE_SESSION_KEY, []);
    if (!sessions.length) {
      el.referenceStatus.textContent = '내보낼 세션 기록이 없습니다.';
      return;
    }
    const header = ['datetime', 'program', 'avg_similarity', 'best_similarity', 'punches'];
    const escapeCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = sessions.map((s) => [
      escapeCell(s.at),
      escapeCell(s.program),
      escapeCell(s.avg),
      escapeCell(s.best),
      escapeCell(s.punches),
    ].join(','));
    const csv = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    a.href = url;
    a.download = `diet_boxing_sessions_${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    el.referenceStatus.textContent = '세션 기록 CSV를 내보냈습니다.';
  }

  function saveSessionRecord() {
    const sessions = loadJsonStorage(STORAGE_SESSION_KEY, []);
    const avg = similarityCount ? Math.round(similaritySum / similarityCount) : 0;
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const record = {
      at: stamp,
      program: selected ? selected.label : '알 수 없음',
      avg,
      best: similarityBest || 0,
      punches: punchCount || 0,
    };
    sessions.unshift(record);
    saveJsonStorage(STORAGE_SESSION_KEY, sessions.slice(0, 30));
    renderSessionHistory();
  }

  function renderReferenceProfiles() {
    if (!el.refProfileSelect) return;
    referenceProfiles = loadJsonStorage(STORAGE_REF_PROFILE_KEY, []);
    el.refProfileSelect.innerHTML = '';
    if (!referenceProfiles.length) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = '저장된 프로필 없음';
      el.refProfileSelect.appendChild(opt);
      return;
    }
    referenceProfiles.forEach((profile) => {
      const opt = document.createElement('option');
      opt.value = profile.name;
      opt.textContent = `${profile.name} (${profile.vectors.length}개)`;
      el.refProfileSelect.appendChild(opt);
    });
  }

  function saveReferenceProfileFromCurrent() {
    const name = (el.refName && el.refName.value ? el.refName.value : '').trim();
    if (!name) {
      el.referenceStatus.textContent = '프로필 이름을 입력해 주세요.';
      return;
    }
    if (!referenceVectors.length) {
      el.referenceStatus.textContent = '저장할 기준 데이터가 없습니다. 먼저 기준 영상 분석을 완료해 주세요.';
      return;
    }
    const list = loadJsonStorage(STORAGE_REF_PROFILE_KEY, []);
    const next = list.filter((x) => x.name !== name);
    next.unshift({
      name,
      vectors: referenceVectors,
      createdAt: Date.now(),
    });
    saveJsonStorage(STORAGE_REF_PROFILE_KEY, next.slice(0, 20));
    el.referenceStatus.textContent = `프로필 저장 완료: ${name}`;
    renderReferenceProfiles();
  }

  function loadSelectedReferenceProfile() {
    if (!el.refProfileSelect || !el.refProfileSelect.value) return;
    const list = loadJsonStorage(STORAGE_REF_PROFILE_KEY, []);
    const picked = list.find((x) => x.name === el.refProfileSelect.value);
    if (!picked || !picked.vectors || !picked.vectors.length) {
      el.referenceStatus.textContent = '선택한 프로필을 불러올 수 없습니다.';
      return;
    }
    referenceVectors = picked.vectors;
    resetSimilarityRuntime();
    el.referenceStatus.textContent = `프로필 불러오기 완료: ${picked.name} (${picked.vectors.length}개)`;
  }

  function deleteSelectedReferenceProfile() {
    if (!el.refProfileSelect || !el.refProfileSelect.value) return;
    const name = el.refProfileSelect.value;
    const list = loadJsonStorage(STORAGE_REF_PROFILE_KEY, []);
    const next = list.filter((x) => x.name !== name);
    saveJsonStorage(STORAGE_REF_PROFILE_KEY, next);
    el.referenceStatus.textContent = `프로필 삭제 완료: ${name}`;
    renderReferenceProfiles();
  }

  function saveTuning() {
    try {
      localStorage.setItem(STORAGE_TUNING_KEY, JSON.stringify(tuning));
    } catch (e) {
      /* 저장 실패는 무시 */
    }
  }

  function maybeResetScoresOnTuning() {
    if (el.tuningResetScores && el.tuningResetScores.checked && phase === 'work') resetScores();
  }

  function updateTuningOutputs() {
    const t = tuning;
    const out = (id, text) => {
      const n = document.getElementById(id);
      if (n) n.textContent = text;
    };
    out('t-shoulder-tol-v', t.shoulderTol.toFixed(2));
    out('t-hip-tol-v', t.hipTol.toFixed(2));
    out('t-guard-bias-v', t.guardBias.toFixed(2));
    out('t-guard-range-v', t.guardRange.toFixed(2));
    out('t-wrist-speed-v', t.wristSpeedMin.toFixed(3));
    out('t-elbow-min-v', String(Math.round(t.elbowMinDeg)));
    out('t-elbow-delta-v', String(Math.round(t.elbowDeltaDeg)));
    out('t-move-div-v', t.movementDivisor.toFixed(2));
    out('t-cadence-v', t.cadenceBonus.toFixed(2));
    out('t-cooldown-v', String(Math.round(t.punchCooldownMs)));
    out('t-posture-w-v', `${Math.round(t.postureWeight * 100)}%`);
    out('t-vis-v', t.minVisibility.toFixed(2));
    out('t-fb-high-v', String(Math.round(t.feedbackTotalHigh)));
    out('t-fb-post-v', String(Math.round(t.feedbackPostureLow)));
    out('t-fb-act-v', String(Math.round(t.feedbackActivityLow)));
    out('t-seg-reach-v', t.segmentReachActive.toFixed(2));
    out('t-seg-elbow-v', t.segmentElbowActive.toFixed(2));
  }

  function syncUIFromTuning() {
    const setRange = (id, val) => {
      const n = document.getElementById(id);
      if (n) n.value = String(val);
    };
    const t = tuning;
    setRange('t-shoulder-tol', Math.round(t.shoulderTol * 100));
    setRange('t-hip-tol', Math.round(t.hipTol * 100));
    setRange('t-guard-bias', Math.round(t.guardBias * 100));
    setRange('t-guard-range', Math.round(t.guardRange * 100));
    setRange('t-wrist-speed', Math.round(t.wristSpeedMin * 1000));
    setRange('t-elbow-min', Math.round(t.elbowMinDeg));
    setRange('t-elbow-delta', Math.round(t.elbowDeltaDeg));
    setRange('t-move-div', Math.round(t.movementDivisor * 100));
    setRange('t-cadence', Math.round(t.cadenceBonus * 100));
    setRange('t-cooldown', Math.round(t.punchCooldownMs));
    setRange('t-posture-w', Math.round(t.postureWeight * 100));
    setRange('t-vis', Math.round(t.minVisibility * 100));
    setRange('t-fb-high', Math.round(t.feedbackTotalHigh));
    setRange('t-fb-post', Math.round(t.feedbackPostureLow));
    setRange('t-fb-act', Math.round(t.feedbackActivityLow));
    setRange('t-seg-reach', Math.round(t.segmentReachActive * 100));
    setRange('t-seg-elbow', Math.round(t.segmentElbowActive * 100));
    updateTuningOutputs();
  }

  function applyInputToTuning(id, value) {
    const v = parseFloat(value);
    switch (id) {
      case 't-shoulder-tol':
        tuning.shoulderTol = v / 100;
        break;
      case 't-hip-tol':
        tuning.hipTol = v / 100;
        break;
      case 't-guard-bias':
        tuning.guardBias = v / 100;
        break;
      case 't-guard-range':
        tuning.guardRange = v / 100;
        break;
      case 't-wrist-speed':
        tuning.wristSpeedMin = v / 1000;
        break;
      case 't-elbow-min':
        tuning.elbowMinDeg = v;
        break;
      case 't-elbow-delta':
        tuning.elbowDeltaDeg = v;
        break;
      case 't-move-div':
        tuning.movementDivisor = v / 100;
        break;
      case 't-cadence':
        tuning.cadenceBonus = v / 100;
        break;
      case 't-cooldown':
        tuning.punchCooldownMs = v;
        break;
      case 't-posture-w':
        tuning.postureWeight = v / 100;
        break;
      case 't-vis':
        tuning.minVisibility = v / 100;
        break;
      case 't-fb-high':
        tuning.feedbackTotalHigh = v;
        break;
      case 't-fb-post':
        tuning.feedbackPostureLow = v;
        break;
      case 't-fb-act':
        tuning.feedbackActivityLow = v;
        break;
      case 't-seg-reach':
        tuning.segmentReachActive = v / 100;
        break;
      case 't-seg-elbow':
        tuning.segmentElbowActive = v / 100;
        break;
      default:
        return;
    }
    tuning = clampTuning(tuning);
    saveTuning();
    updateTuningOutputs();
    maybeResetScoresOnTuning();
  }

  function applyPreset(name) {
    const preset = PRESETS[name];
    if (!preset) return;
    tuning = clampTuning({ ...preset });
    syncUIFromTuning();
    saveTuning();
    maybeResetScoresOnTuning();
  }

  function resetTuningDefaults() {
    tuning = clampTuning({ ...DEFAULT_TUNING });
    syncUIFromTuning();
    saveTuning();
    maybeResetScoresOnTuning();
  }

  function bindTuningEvents() {
    if (el.tuningPanel) {
      el.tuningPanel.addEventListener('input', (ev) => {
        const target = ev.target;
        if (target && target instanceof HTMLInputElement && target.id) {
          applyInputToTuning(target.id, target.value);
        }
      });
    }
    document.querySelectorAll('.diet-preset-btn').forEach((btn) => {
      btn.addEventListener('click', () => applyPreset(btn.getAttribute('data-preset') || 'normal'));
    });
    if (el.tuningResetBtn) el.tuningResetBtn.addEventListener('click', resetTuningDefaults);
  }

  function getWeightKg() {
    const raw = localStorage.getItem(STORAGE_KEY);
    const n = raw ? parseFloat(raw) : 65;
    return Number.isFinite(n) && n > 30 && n < 200 ? n : 65;
  }

  /**
   * 무엇: 기준 영상 분석 제한 시간을 읽습니다.
   * 왜: 브라우저별 영상 종료 이벤트 지연에 대응할 수 있게 사용자 설정을 반영하기 위함입니다.
   */
  function getAnalyzeTimeoutSec() {
    const raw = localStorage.getItem(STORAGE_ANALYZE_TIMEOUT_KEY);
    const n = raw ? parseInt(raw, 10) : DEFAULT_ANALYZE_TIMEOUT_SEC;
    if (!Number.isFinite(n)) return DEFAULT_ANALYZE_TIMEOUT_SEC;
    return Math.min(300, Math.max(15, n));
  }

  function saveAnalyzeTimeoutSec(value) {
    const n = parseInt(value, 10);
    if (!Number.isFinite(n)) return;
    const clamped = Math.min(300, Math.max(15, n));
    localStorage.setItem(STORAGE_ANALYZE_TIMEOUT_KEY, String(clamped));
    if (el.analyzeTimeout) el.analyzeTimeout.value = String(clamped);
  }

  /**
   * 무엇: 기준 분석 진행률 텍스트/바를 함께 갱신합니다.
   * 왜: 숫자와 시각 막대를 동시에 보여 상태를 더 직관적으로 알리기 위함입니다.
   */
  function setReferenceProgress(percent, label) {
    const safe = Math.min(100, Math.max(0, Math.round(Number(percent) || 0)));
    const state = label || (safe >= 100 ? '완료' : safe > 0 ? '진행 중' : '');
    if (el.refProgress) {
      const suffix = state ? ` (${state})` : '';
      el.refProgress.textContent = `기준 분석 진행률: ${safe}%${suffix}`;
    }
    if (el.refProgressFill) {
      el.refProgressFill.style.width = `${safe}%`;
      el.refProgressFill.classList.remove('is-running', 'is-done', 'is-fail', 'is-low');
      if (state === '실패') {
        el.refProgressFill.classList.add('is-fail');
      } else if (state === '벡터 부족') {
        el.refProgressFill.classList.add('is-low');
      } else if (state === '완료') {
        el.refProgressFill.classList.add('is-done');
      } else if (state === '진행 중' || (safe > 0 && safe < 100)) {
        el.refProgressFill.classList.add('is-running');
      }
    }
  }

  function saveWeight() {
    const v = parseFloat(el.weight.value);
    if (Number.isFinite(v) && v > 30 && v < 200) localStorage.setItem(STORAGE_KEY, String(v));
  }

  function estimateKcal(met, minutes, weightKg) {
    return (met * 3.5 * weightKg) / 200 * minutes;
  }

  function formatTime(totalSec) {
    const t = Math.max(0, Math.floor(totalSec));
    return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
  }

  function setRingProgress(remaining, total) {
    if (!el.ring || total <= 0) return;
    const r = 104;
    const c = 2 * Math.PI * r;
    el.ring.setAttribute('stroke-dasharray', String(c));
    el.ring.style.strokeDashoffset = String(c * (1 - remaining / total));
  }

  function renderPrograms() {
    if (!el.programs) return;
    el.programs.innerHTML = '';
    PROGRAMS.forEach((p) => {
      const card = document.createElement('div');
      card.setAttribute('role', 'button');
      card.tabIndex = 0;
      card.className = 'diet-program' + (selected && selected.id === p.id ? ' is-selected' : '');
      const links = PROGRAM_VIDEO_LINKS[p.id] || [];
      const linkHtml = links.map((item) => `<a class="diet-program-link" href="${item.url}" target="_blank" rel="noopener noreferrer" data-video-url="${item.url}">${item.title}</a>`).join('');
      card.innerHTML = `
        <h3>${p.label} <span class="diet-badge">MET ~${p.met}</span></h3>
        <p>${p.desc}</p>
        <div class="diet-program-links">
          <span class="diet-program-links-label">추천 영상</span>
          ${linkHtml}
        </div>
      `;
      const selectProgram = () => {
        if (phase !== 'idle' && phase !== 'done') return;
        selected = p;
        renderPrograms();
        resetSession(false);
      };
      card.addEventListener('click', (ev) => {
        if (ev.target && ev.target.closest && ev.target.closest('.diet-program-link')) return;
        selectProgram();
      });
      card.querySelectorAll('.diet-program-link').forEach((anchor) => {
        anchor.addEventListener('click', (ev) => {
          ev.preventDefault();
          const url = anchor.getAttribute('data-video-url') || '';
          embedYoutubeVideo(url);
        });
      });
      card.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          selectProgram();
        }
      });
      el.programs.appendChild(card);
    });
  }

  function getYoutubeEmbedUrl(url) {
    try {
      const u = new URL(url);
      if (u.hostname.includes('youtu.be')) {
        const id = u.pathname.replace('/', '').trim();
        return id ? `https://www.youtube.com/embed/${id}?autoplay=1&rel=0` : '';
      }
      if (u.hostname.includes('youtube.com')) {
        const id = u.searchParams.get('v');
        return id ? `https://www.youtube.com/embed/${id}?autoplay=1&rel=0` : '';
      }
      return '';
    } catch (e) {
      return '';
    }
  }

  function embedYoutubeVideo(url) {
    if (!el.youtubeEmbed) return;
    const embedUrl = getYoutubeEmbedUrl(url);
    if (!embedUrl) {
      if (el.youtubeStatus) el.youtubeStatus.textContent = '영상 링크를 읽지 못했습니다. 다른 링크를 선택해 주세요.';
      return;
    }
    el.youtubeEmbed.src = embedUrl;
    if (el.youtubeStatus) el.youtubeStatus.textContent = '추천 영상 재생 중입니다.';
  }

  function updateKcalDisplay() {
    if (!selected) return;
    const kcal = estimateKcal(selected.met, workSecondsTotal / 60, getWeightKg());
    el.kcal.textContent = kcal < 10 ? kcal.toFixed(1) : String(Math.round(kcal));
  }

  function setPhaseTexts() {
    if (!selected) return;
    if (phase === 'idle') {
      el.phase.textContent = '준비';
      el.round.textContent = `${selected.label} 프로그램 준비`;
      remainingSec = selected.workSec;
    } else if (phase === 'work') {
      el.phase.textContent = '운동';
      el.round.textContent = `${roundIndex + 1}/${selected.rounds} 라운드 진행 중`;
    } else if (phase === 'rest') {
      el.phase.textContent = '휴식';
      el.round.textContent = '다음 라운드 준비';
    } else {
      el.phase.textContent = '완료';
      el.round.textContent = '운동이 끝났어요';
      remainingSec = 0;
    }
    if (el.timer) el.timer.textContent = formatTime(remainingSec);
    const total = phase === 'rest' ? selected.restSec : selected.workSec;
    setRingProgress(Math.max(0, remainingSec), total);
  }

  function clearTimer() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function tick() {
    if (!selected) return;
    remainingSec -= 1;
    if (remainingSec < 0) {
      if (phase === 'work') {
        workSecondsTotal += selected.workSec;
        updateKcalDisplay();
        if (roundIndex + 1 >= selected.rounds) {
          phase = 'done';
          clearTimer();
          setPhaseTexts();
          el.start.disabled = false;
          el.pause.disabled = true;
          if (el.roundSummaryText) {
            el.roundSummaryText.textContent = buildRoundSummaryText();
          }
          renderFinalReport();
          saveSessionRecord();
          return;
        }
        phase = 'rest';
        remainingSec = selected.restSec;
      } else if (phase === 'rest') {
        roundIndex += 1;
        phase = 'work';
        remainingSec = selected.workSec;
      }
    }
    setPhaseTexts();
  }

  function resetScores() {
    punchCount = 0;
    postureScoreAvg = 0;
    activityScoreAvg = 0;
    scoreSampleCount = 0;
    prev = { leftWristX: null, rightWristX: null, leftElbowAngle: null, rightElbowAngle: null, lastPunchAt: 0 };
    renderScores();
  }

  function resetSession(full) {
    clearTimer();
    phase = 'idle';
    roundIndex = 0;
    workSecondsTotal = 0;
    if (full) saveWeight();
    el.weight.value = String(getWeightKg());
    setPhaseTexts();
    updateKcalDisplay();
    resetScores();
    resetCoachingStats();
    el.start.disabled = false;
    el.start.textContent = '시작';
    el.pause.disabled = true;
    el.pause.textContent = '일시정지';
  }

  function startSession() {
    if (!selected) return;
    saveWeight();
    if (phase === 'done' || phase === 'idle') {
      phase = 'work';
      roundIndex = 0;
      remainingSec = selected.workSec;
      workSecondsTotal = 0;
      resetScores();
      resetSimilarityRuntime();
      resetCoachingStats();
    }
    el.start.disabled = true;
    el.start.textContent = '시작';
    el.pause.disabled = false;
    setPhaseTexts();
    clearTimer();
    timerId = setInterval(tick, 1000);
  }

  function pauseSession() {
    if (!timerId) return;
    clearTimer();
    el.start.disabled = false;
    el.pause.disabled = true;
    el.start.textContent = '재개';
    el.pause.textContent = '일시정지';
  }

  function resumeOrStart() {
    if (phase === 'idle' || phase === 'done') return startSession();
    if (timerId) return;
    el.pause.disabled = false;
    el.start.disabled = true;
    el.start.textContent = '시작';
    el.pause.textContent = '일시정지';
    timerId = setInterval(tick, 1000);
  }

  function renderScores() {
    const p = Math.round(postureScoreAvg);
    const a = Math.round(activityScoreAvg);
    const w = tuning.postureWeight;
    const t = Math.round(p * w + a * (1 - w));
    el.scorePosture.textContent = String(p);
    el.scoreActivity.textContent = String(a);
    el.scoreTotal.textContent = String(t);
    el.punchCount.textContent = String(punchCount);
  }

  function getLandmark(landmarks, index) {
    const p = landmarks[index];
    if (!p || p.visibility < tuning.minVisibility) return null;
    return p;
  }

  function getAngleDeg(a, b, c) {
    const abx = a.x - b.x;
    const aby = a.y - b.y;
    const cbx = c.x - b.x;
    const cby = c.y - b.y;
    const dot = (abx * cbx) + (aby * cby);
    const mag = Math.hypot(abx, aby) * Math.hypot(cbx, cby);
    if (!mag) return 0;
    return Math.acos(Math.max(-1, Math.min(1, dot / mag))) * (180 / Math.PI);
  }

  function clamp01(v) {
    return Math.max(0, Math.min(1, v));
  }

  /**
   * 무엇: 유사도 비교 전용 포즈 특징(값+신뢰도)을 생성합니다.
   * 왜: 랜드마크 가시성이 낮을 때 영향을 줄여 점프하는 오판정을 줄이기 위함입니다.
   */
  function toPoseVector(landmarks) {
    const p = (idx) => landmarks[idx] || null;
    const ls = p(11);
    const rs = p(12);
    const le = p(13);
    const re = p(14);
    const lw = p(15);
    const rw = p(16);
    const lh = p(23);
    const rh = p(24);
    if (!(ls && rs && le && re && lw && rw && lh && rh)) return null;

    const shoulderWidth = Math.hypot(ls.x - rs.x, ls.y - rs.y);
    if (shoulderWidth < 0.02) return null;

    const vis = (point) => clamp01((point.visibility || 0) / Math.max(0.01, tuning.minVisibility));
    const vis3 = (a, b, c) => Math.min(vis(a), vis(b), vis(c));
    const vis2 = (a, b) => Math.min(vis(a), vis(b));

    const vals = [
      getAngleDeg(ls, le, lw) / 180,
      getAngleDeg(rs, re, rw) / 180,
      Math.hypot(ls.x - lw.x, ls.y - lw.y) / shoulderWidth,
      Math.hypot(rs.x - rw.x, rs.y - rw.y) / shoulderWidth,
      (ls.y - lw.y) / shoulderWidth,
      (rs.y - rw.y) / shoulderWidth,
      Math.abs(ls.y - rs.y) / shoulderWidth,
      Math.abs(lh.y - rh.y) / shoulderWidth,
    ];
    const weights = [
      vis3(ls, le, lw),
      vis3(rs, re, rw),
      vis2(ls, lw),
      vis2(rs, rw),
      vis2(ls, lw),
      vis2(rs, rw),
      vis2(ls, rs),
      vis2(lh, rh),
    ];
    return { vals, weights };
  }

  /**
   * 무엇: 포즈 특징을 동작 구간 라벨(가드/왼/오른/양팔)로 분류합니다.
   * 왜: 전체 유사도 외에 '어떤 동작에서 잘/못 하는지'를 보여주기 위함입니다.
   */
  function classifySegment(vectorLike) {
    const vals = vectorLike && vectorLike.vals ? vectorLike.vals : null;
    if (!vals) return 'guard';
    const leftActive = vals[2] > tuning.segmentReachActive || vals[0] > tuning.segmentElbowActive;
    const rightActive = vals[3] > tuning.segmentReachActive || vals[1] > tuning.segmentElbowActive;
    if (leftActive && rightActive) return 'both';
    if (leftActive) return 'left';
    if (rightActive) return 'right';
    return 'guard';
  }

  function segmentLabelKo(key) {
    if (key === 'left') return '왼팔 전개';
    if (key === 'right') return '오른팔 전개';
    if (key === 'both') return '양팔 전개';
    return '가드';
  }

  function vectorDistance(a, b, mirrored) {
    if (!a || !b || a.vals.length !== b.vals.length) return 999;
    const map = mirrored ? [1, 0, 3, 2, 5, 4, 6, 7] : [0, 1, 2, 3, 4, 5, 6, 7];
    let weighted = 0;
    let weightSum = 0;
    for (let i = 0; i < map.length; i += 1) {
      const j = map[i];
      const w = Math.max(0.05, (a.weights[i] + b.weights[j]) / 2);
      weighted += Math.abs(a.vals[i] - b.vals[j]) * w;
      weightSum += w;
    }
    return weightSum > 0 ? weighted / weightSum : 999;
  }

  function resetReferenceModel(message) {
    referenceVectors = [];
    referenceFrameCounter = 0;
    similaritySmoothed = 0;
    similarityHistory = [];
    lastSimilarityAt = 0;
    similarityBest = 0;
    similaritySum = 0;
    similarityCount = 0;
    liveRecentVectors = [];
    refCursor = 0;
    segmentStats = {
      guard: { sum: 0, count: 0 },
      left: { sum: 0, count: 0 },
      right: { sum: 0, count: 0 },
      both: { sum: 0, count: 0 },
    };
    el.similarity.textContent = '--';
    el.latency.textContent = '--';
    el.similarityAvg.textContent = '--';
    el.similarityBest.textContent = '--';
    el.segmentLabel.textContent = '--';
    el.segmentScore.textContent = '--';
    el.segGuard.textContent = '--';
    el.segLeft.textContent = '--';
    el.segRight.textContent = '--';
    el.segBoth.textContent = '--';
    drawSimilarityGraph();
    if (message) el.referenceStatus.textContent = message;
  }

  /** 운동 라운드 시작 시 유사도 히스토리를 리셋합니다. */
  function resetSimilarityRuntime() {
    similaritySmoothed = 0;
    similarityHistory = [];
    lastSimilarityAt = 0;
    similarityBest = 0;
    similaritySum = 0;
    similarityCount = 0;
    liveRecentVectors = [];
    refCursor = 0;
    currentSegment = 'guard';
    segmentStats = {
      guard: { sum: 0, count: 0 },
      left: { sum: 0, count: 0 },
      right: { sum: 0, count: 0 },
      both: { sum: 0, count: 0 },
    };
    el.similarity.textContent = '--';
    el.latency.textContent = '--';
    el.similarityAvg.textContent = '--';
    el.similarityBest.textContent = '--';
    el.segmentLabel.textContent = '--';
    el.segmentScore.textContent = '--';
    el.segGuard.textContent = '--';
    el.segLeft.textContent = '--';
    el.segRight.textContent = '--';
    el.segBoth.textContent = '--';
    drawSimilarityGraph();
  }

  function resetCoachingStats() {
    coachingStats = {
      shoulderPenalty: 0,
      guardPenalty: 0,
      activityPenalty: 0,
      samples: 0,
    };
    if (el.liveCue) el.liveCue.textContent = '실시간 코칭: 준비 중';
    lastLiveCue = '';
    lastLiveCueLevel = 0;
    lastLiveCueAt = 0;
    if (el.roundSummaryText) el.roundSummaryText.textContent = '아직 라운드가 종료되지 않았습니다.';
    if (el.finalReportList) el.finalReportList.innerHTML = '';
    reportStats = {
      shoulderGapSum: 0,
      hipGapSum: 0,
      guardAvgSum: 0,
      leftReachSum: 0,
      rightReachSum: 0,
      leftElbowNormSum: 0,
      rightElbowNormSum: 0,
      samples: 0,
    };
  }

  /**
   * 무엇: 문구가 바뀌었을 때만 음성으로 읽습니다.
   * 왜: 같은 안내 반복 재생을 막아 사용자 피로를 줄이기 위함입니다.
   */
  function speakCue(text) {
    if (!ttsEnabled || !window.speechSynthesis || !text) return;
    const now = Date.now();
    if (text === lastSpokenCue && now - lastSpokenAt < 2500) return;
    try {
      window.speechSynthesis.cancel();
      const ut = new SpeechSynthesisUtterance(text.replace(/^실시간 코칭\([^)]+\):\s*/, ''));
      ut.lang = 'ko-KR';
      ut.rate = 1;
      ut.pitch = 1;
      window.speechSynthesis.speak(ut);
      lastSpokenCue = text;
      lastSpokenAt = now;
    } catch (e) {
      /* 음성 재생 실패는 무시 */
    }
  }

  function getSegmentAverages() {
    const avg = (key) => {
      const s = segmentStats[key];
      return s && s.count ? Math.round(s.sum / s.count) : null;
    };
    return {
      guard: avg('guard'),
      left: avg('left'),
      right: avg('right'),
      both: avg('both'),
    };
  }

  function buildRoundSummaryText() {
    if (!coachingStats.samples) return '라운드 데이터가 부족합니다.';
    const issues = [
      { key: '어깨/골반 정렬', val: coachingStats.shoulderPenalty / coachingStats.samples },
      { key: '가드 유지', val: coachingStats.guardPenalty / coachingStats.samples },
      { key: '활동 리듬', val: coachingStats.activityPenalty / coachingStats.samples },
    ].sort((a, b) => b.val - a.val);
    const top = issues.slice(0, 3).map((item, idx) => `${idx + 1}) ${item.key} (${Math.round(item.val * 100)}%)`);
    const segAvgs = getSegmentAverages();
    const segPairs = [
      { key: '가드', val: segAvgs.guard },
      { key: '왼팔', val: segAvgs.left },
      { key: '오른팔', val: segAvgs.right },
      { key: '양팔', val: segAvgs.both },
    ].filter((x) => typeof x.val === 'number');
    if (!segPairs.length) return `라운드 개선 TOP3: ${top.join(' · ')}`;
    segPairs.sort((a, b) => a.val - b.val);
    return `라운드 개선 TOP3: ${top.join(' · ')} / 취약 동작: ${segPairs[0].key} (${segPairs[0].val}%)`;
  }

  function renderFinalReport() {
    if (!el.finalReportList) return;
    if (!reportStats.samples) {
      el.finalReportList.innerHTML = '<li>최종 리포트 데이터가 부족합니다.</li>';
      return;
    }
    const n = reportStats.samples;
    const shoulderAvg = reportStats.shoulderGapSum / n;
    const hipAvg = reportStats.hipGapSum / n;
    const guardAvg = reportStats.guardAvgSum / n;
    const leftReachAvg = reportStats.leftReachSum / n;
    const rightReachAvg = reportStats.rightReachSum / n;
    const leftElbowAvg = reportStats.leftElbowNormSum / n;
    const rightElbowAvg = reportStats.rightElbowNormSum / n;

    const shoulderDiffPct = Math.round(Math.max(0, (shoulderAvg / Math.max(0.02, tuning.shoulderTol) - 1) * 100));
    const hipDiffPct = Math.round(Math.max(0, (hipAvg / Math.max(0.02, tuning.hipTol) - 1) * 100));
    const guardLowPct = Math.round(Math.max(0, (0.8 - guardAvg) * 100));
    const leftReachGapPct = Math.round(Math.max(0, ((tuning.segmentReachActive - leftReachAvg) / Math.max(0.01, tuning.segmentReachActive)) * 100));
    const rightReachGapPct = Math.round(Math.max(0, ((tuning.segmentReachActive - rightReachAvg) / Math.max(0.01, tuning.segmentReachActive)) * 100));
    const leftElbowGapPct = Math.round(Math.max(0, ((tuning.segmentElbowActive - leftElbowAvg) / Math.max(0.01, tuning.segmentElbowActive)) * 100));
    const rightElbowGapPct = Math.round(Math.max(0, ((tuning.segmentElbowActive - rightElbowAvg) / Math.max(0.01, tuning.segmentElbowActive)) * 100));

    const grade = (v) => {
      if (v <= 12) return { text: '좋음', cls: 'good' };
      if (v <= 30) return { text: '주의', cls: 'warn' };
      return { text: '개선필요', cls: 'bad' };
    };
    const rows = [
      { text: `어깨 정렬: 기준 대비 ${shoulderDiffPct}% 흔들림`, score: shoulderDiffPct },
      { text: `골반 정렬: 기준 대비 ${hipDiffPct}% 흔들림`, score: hipDiffPct },
      { text: `가드 유지: 기준 대비 ${guardLowPct}% 낮음`, score: guardLowPct },
      { text: `왼팔 전개: 거리 ${leftReachGapPct}% · 각도 ${leftElbowGapPct}% 부족`, score: Math.round((leftReachGapPct + leftElbowGapPct) / 2) },
      { text: `오른팔 전개: 거리 ${rightReachGapPct}% · 각도 ${rightElbowGapPct}% 부족`, score: Math.round((rightReachGapPct + rightElbowGapPct) / 2) },
    ];
    el.finalReportList.innerHTML = rows
      .map((row) => {
        const g = grade(row.score);
        return `<li>${row.text}<span class="diet-report-badge ${g.cls}">${g.text}</span></li>`;
      })
      .join('');
  }

  function drawSimilarityGraph() {
    if (!graphCtx || !el.similarityGraph) return;
    const targetW = Math.max(320, Math.round(el.similarityGraph.clientWidth || 760));
    const targetH = 140;
    if (el.similarityGraph.width !== targetW) el.similarityGraph.width = targetW;
    if (el.similarityGraph.height !== targetH) el.similarityGraph.height = targetH;
    const w = targetW;
    const h = targetH;
    graphCtx.clearRect(0, 0, w, h);

    graphCtx.fillStyle = '#070811';
    graphCtx.fillRect(0, 0, w, h);

    graphCtx.strokeStyle = 'rgba(255,255,255,0.12)';
    graphCtx.lineWidth = 1;
    for (let i = 1; i <= 4; i += 1) {
      const y = (h / 5) * i;
      graphCtx.beginPath();
      graphCtx.moveTo(0, y);
      graphCtx.lineTo(w, y);
      graphCtx.stroke();
    }

    const targetY = h - (80 / 100) * h;
    graphCtx.strokeStyle = 'rgba(255,214,10,0.9)';
    graphCtx.lineWidth = 1.2;
    graphCtx.setLineDash([6, 4]);
    graphCtx.beginPath();
    graphCtx.moveTo(0, targetY);
    graphCtx.lineTo(w, targetY);
    graphCtx.stroke();
    graphCtx.setLineDash([]);

    if (!similarityHistory.length) return;

    graphCtx.strokeStyle = '#30D158';
    graphCtx.lineWidth = 2;
    graphCtx.beginPath();
    for (let i = 0; i < similarityHistory.length; i += 1) {
      const x = similarityHistory.length <= 1 ? 0 : (i / (similarityHistory.length - 1)) * w;
      const y = h - (similarityHistory[i] / 100) * h;
      if (i === 0) graphCtx.moveTo(x, y);
      else graphCtx.lineTo(x, y);
    }
    graphCtx.stroke();
  }

  function updateSimilarityFromLive(landmarks) {
    if (!referenceVectors.length) return;
    const now = performance.now();
    const live = toPoseVector(landmarks);
    if (!live) return;

    liveRecentVectors.push(live);
    if (liveRecentVectors.length > 6) liveRecentVectors.shift();

    /* DTW-lite: 참조 커서를 중심으로 앞뒤 창(window)에서 최소 거리를 찾습니다. */
    const winBack = 8;
    const winFwd = 18;
    const start = Math.max(0, refCursor - winBack);
    const end = Math.min(referenceVectors.length - 1, refCursor + winFwd);
    let best = Infinity;
    let bestIdx = refCursor;
    let bestMirror = false;
    let bestLabel = 'guard';
    for (let i = start; i <= end; i += 1) {
      const refItem = referenceVectors[i];
      if (!refItem || !refItem.vec) continue;
      for (let k = 0; k < liveRecentVectors.length; k += 1) {
        const cand = liveRecentVectors[k];
        const dNormal = vectorDistance(cand, refItem.vec, false);
        if (dNormal < best) {
          best = dNormal;
          bestIdx = i;
          bestMirror = false;
          bestLabel = refItem.label || 'guard';
        }
        const dMirror = vectorDistance(cand, refItem.vec, true);
        if (dMirror < best) {
          best = dMirror;
          bestIdx = i;
          bestMirror = true;
          bestLabel = refItem.label || 'guard';
        }
      }
    }
    refCursor = bestIdx;

    const raw = Math.round(clamp01(1 - best / 0.85) * 100);
    /* 반응 속도를 높이기 위해 완만한 평균 대신 빠른 추종 계수를 사용 */
    similaritySmoothed = similaritySmoothed === 0 ? raw : (similaritySmoothed * 0.62) + (raw * 0.38);
    const smoothedInt = Math.round(similaritySmoothed);
    el.similarity.textContent = String(smoothedInt);
    similarityHistory.push(smoothedInt);
    if (similarityHistory.length > 140) similarityHistory.shift();
    similarityBest = Math.max(similarityBest, smoothedInt);
    similaritySum += smoothedInt;
    similarityCount += 1;
    el.similarityBest.textContent = String(similarityBest);
    el.similarityAvg.textContent = String(Math.round(similaritySum / Math.max(1, similarityCount)));
    el.segmentLabel.textContent = segmentLabelKo(bestLabel);
    currentSegment = bestLabel;
    el.segmentScore.textContent = String(smoothedInt);
    if (segmentStats[bestLabel]) {
      segmentStats[bestLabel].sum += smoothedInt;
      segmentStats[bestLabel].count += 1;
    }
    const segAvg = (key) => {
      const s = segmentStats[key];
      return s.count ? String(Math.round(s.sum / s.count)) : '--';
    };
    el.segGuard.textContent = segAvg('guard');
    el.segLeft.textContent = segAvg('left');
    el.segRight.textContent = segAvg('right');
    el.segBoth.textContent = segAvg('both');
    drawSimilarityGraph();

    if (lastSimilarityAt) {
      el.latency.textContent = String(Math.max(1, Math.round(now - lastSimilarityAt)));
    }
    lastSimilarityAt = now;
    if (bestMirror) {
      el.referenceStatus.textContent = `유사도 비교 중 (사우스포/오소독스 자동 보정) · 기준 위치 ${bestIdx + 1}/${referenceVectors.length}`;
    }
  }

  /**
   * 무엇: 어깨 수평, 상체 균형, 가드 높이 기준으로 자세 점수를 계산합니다.
   * 왜: 체형이 달라도 공통적으로 확인 가능한 기본 자세 지표이기 때문입니다.
   */
  function calcPostureScore(landmarks) {
    const ls = getLandmark(landmarks, 11);
    const rs = getLandmark(landmarks, 12);
    const lh = getLandmark(landmarks, 23);
    const rh = getLandmark(landmarks, 24);
    const lw = getLandmark(landmarks, 15);
    const rw = getLandmark(landmarks, 16);
    if (!(ls && rs && lh && rh && lw && rw)) return 0;

    const shoulderLevel = 1 - clamp01(Math.abs(ls.y - rs.y) / Math.max(0.02, tuning.shoulderTol));
    const hipLevel = 1 - clamp01(Math.abs(lh.y - rh.y) / Math.max(0.02, tuning.hipTol));
    const guardLeft = clamp01((ls.y - lw.y + tuning.guardBias) / Math.max(0.05, tuning.guardRange));
    const guardRight = clamp01((rs.y - rw.y + tuning.guardBias) / Math.max(0.05, tuning.guardRange));
    const guardAvg = (guardLeft + guardRight) / 2;

    return Math.round((shoulderLevel * 0.3 + hipLevel * 0.3 + guardAvg * 0.4) * 100);
  }

  function deriveCoachSignals(landmarks) {
    const ls = getLandmark(landmarks, 11);
    const rs = getLandmark(landmarks, 12);
    const lh = getLandmark(landmarks, 23);
    const rh = getLandmark(landmarks, 24);
    const lw = getLandmark(landmarks, 15);
    const rw = getLandmark(landmarks, 16);
    const le = getLandmark(landmarks, 13);
    const re = getLandmark(landmarks, 14);
    if (!(ls && rs && lh && rh && lw && rw && le && re)) return null;
    const shoulderWidth = Math.hypot(ls.x - rs.x, ls.y - rs.y);
    if (shoulderWidth < 0.02) return null;
    return {
      shoulderGap: Math.abs(ls.y - rs.y),
      hipGap: Math.abs(lh.y - rh.y),
      guardL: clamp01((ls.y - lw.y + tuning.guardBias) / Math.max(0.05, tuning.guardRange)),
      guardR: clamp01((rs.y - rw.y + tuning.guardBias) / Math.max(0.05, tuning.guardRange)),
      leftReach: Math.hypot(ls.x - lw.x, ls.y - lw.y) / shoulderWidth,
      rightReach: Math.hypot(rs.x - rw.x, rs.y - rw.y) / shoulderWidth,
      leftElbowNorm: getAngleDeg(ls, le, lw) / 180,
      rightElbowNorm: getAngleDeg(rs, re, rw) / 180,
    };
  }

  /**
   * 무엇: 손목 전진 속도 + 팔 각도 펴짐을 이용해 펀치를 감지합니다.
   * 왜: 단순한 위치 비교보다 실제 타격 동작에 가까운 패턴을 잡기 쉽기 때문입니다.
   */
  function detectPunchAndActivity(landmarks) {
    const now = Date.now();
    const ls = getLandmark(landmarks, 11);
    const rs = getLandmark(landmarks, 12);
    const le = getLandmark(landmarks, 13);
    const re = getLandmark(landmarks, 14);
    const lw = getLandmark(landmarks, 15);
    const rw = getLandmark(landmarks, 16);
    if (!(ls && rs && le && re && lw && rw)) return 0;

    const leftAngle = getAngleDeg(ls, le, lw);
    const rightAngle = getAngleDeg(rs, re, rw);
    const leftSpeed = prev.leftWristX === null ? 0 : Math.abs(lw.x - prev.leftWristX);
    const rightSpeed = prev.rightWristX === null ? 0 : Math.abs(rw.x - prev.rightWristX);

    let punchTriggered = false;
    const minSpd = tuning.wristSpeedMin;
    const minArm = tuning.elbowMinDeg;
    const deltaNeed = tuning.elbowDeltaDeg;
    const leftPunchLike =
      leftSpeed > minSpd &&
      leftAngle > minArm &&
      (prev.leftElbowAngle === null || leftAngle - prev.leftElbowAngle > deltaNeed);
    const rightPunchLike =
      rightSpeed > minSpd &&
      rightAngle > minArm &&
      (prev.rightElbowAngle === null || rightAngle - prev.rightElbowAngle > deltaNeed);

    if ((leftPunchLike || rightPunchLike) && now - prev.lastPunchAt > tuning.punchCooldownMs) {
      punchCount += 1;
      prev.lastPunchAt = now;
      punchTriggered = true;
    }

    prev.leftWristX = lw.x;
    prev.rightWristX = rw.x;
    prev.leftElbowAngle = leftAngle;
    prev.rightElbowAngle = rightAngle;

    const movementLevel = clamp01((leftSpeed + rightSpeed) / Math.max(0.02, tuning.movementDivisor));
    const cadenceBonus = punchTriggered ? tuning.cadenceBonus : 0;
    return Math.round(clamp01(movementLevel + cadenceBonus) * 100);
  }

  function updateFeedback(totalScore, postureScore, activityScore) {
    if (totalScore >= tuning.feedbackTotalHigh) {
      el.feedback.textContent = '아주 좋아요! 자세 안정성과 활동량이 모두 좋습니다.';
    } else if (postureScore < tuning.feedbackPostureLow) {
      el.feedback.textContent = '가드 높이와 어깨 수평을 조금 더 신경 써 주세요.';
    } else if (activityScore < tuning.feedbackActivityLow) {
      el.feedback.textContent = '팔을 조금 더 빠르게 뻗고 리듬 있게 복귀해 주세요.';
    } else {
      el.feedback.textContent = '좋은 흐름입니다. 현재 페이스를 유지해 보세요.';
    }
  }

  function updateLiveCue(signals, activityScore) {
    if (!el.liveCue) return;
    if (!signals) {
      const msg = '실시간 코칭: 관절 인식이 약합니다. 전신을 화면에 맞춰 주세요.';
      pushLiveCue(msg, 3);
      return;
    }
    const segText = segmentLabelKo(currentSegment);
    const guardAvg = (signals.guardL + signals.guardR) / 2;
    const shoulderRisk = Math.max(signals.shoulderGap / Math.max(0.02, tuning.shoulderTol), signals.hipGap / Math.max(0.02, tuning.hipTol));
    const guardThreshold = coachLevel === 'strict' ? 0.62 : coachLevel === 'soft' ? 0.46 : 0.52;
    const shoulderThreshold = coachLevel === 'strict' ? 0.82 : coachLevel === 'soft' ? 1.1 : 0.95;
    const activityThreshold = coachLevel === 'strict'
      ? tuning.feedbackActivityLow + 7
      : coachLevel === 'soft'
        ? tuning.feedbackActivityLow - 5
        : tuning.feedbackActivityLow;

    let msg = '';
    let level = 1;
    if (guardAvg < guardThreshold) {
      msg = `실시간 코칭(${segText}): 가드를 조금 더 올리고 턱을 보호하세요.`;
      level = 3;
    } else if (shoulderRisk > shoulderThreshold) {
      msg = `실시간 코칭(${segText}): 어깨/골반 수평을 맞춰 중심을 안정시켜 주세요.`;
      level = 3;
    } else if (activityScore < activityThreshold) {
      if (currentSegment === 'left') {
        msg = '실시간 코칭(왼팔 전개): 왼손을 뻗은 뒤 가드 복귀를 더 빠르게 해보세요.';
      } else if (currentSegment === 'right') {
        msg = '실시간 코칭(오른팔 전개): 오른손 타격 후 중심축 복귀를 더 빠르게 해보세요.';
      } else if (currentSegment === 'both') {
        msg = '실시간 코칭(양팔 전개): 양손 콤보 간 박자를 일정하게 유지해 보세요.';
      } else {
        msg = '실시간 코칭(가드): 잽 후 복귀 리듬을 조금 더 빠르게 가져가세요.';
      }
      level = 2;
    } else {
      msg = `실시간 코칭(${segText}): 흐름이 좋습니다. 현재 템포를 유지하세요.`;
      level = 1;
    }
    pushLiveCue(msg, level);
  }

  /**
   * 무엇: 코칭 문구 업데이트 빈도를 제어합니다.
   * 왜: 프레임마다 문구가 바뀌는 깜빡임을 줄이고, 중요한 경고는 즉시 보여주기 위함입니다.
   */
  function pushLiveCue(msg, level) {
    if (!el.liveCue || !msg) return;
    const now = Date.now();
    const elapsed = now - lastLiveCueAt;
    const holdMs = level >= 3 ? 600 : level === 2 ? 1100 : 1600;
    const canOverride = level > lastLiveCueLevel;

    if (!canOverride && msg !== lastLiveCue && elapsed < holdMs) return;
    if (msg === lastLiveCue && elapsed < 400) return;

    el.liveCue.textContent = msg;
    lastLiveCue = msg;
    lastLiveCueLevel = level;
    lastLiveCueAt = now;
    speakCue(msg);
  }

  function toObstacleKo(name) {
    return OBSTACLE_LABEL_KO[name] || name;
  }

  function getObstacleCaptureCanvas(videoEl) {
    if (!obstacleCaptureCanvas) obstacleCaptureCanvas = document.createElement('canvas');
    const vw = Math.max(1, videoEl.videoWidth || 640);
    const vh = Math.max(1, videoEl.videoHeight || 480);
    const targetW = 640;
    const targetH = Math.max(360, Math.round((vh / vw) * targetW));
    obstacleCaptureCanvas.width = targetW;
    obstacleCaptureCanvas.height = targetH;
    return obstacleCaptureCanvas;
  }

  async function detectObstaclesFromApi() {
    if (!sourceReady || !el.sourceVideo || runningMode !== 'camera') return;
    if (obstacleDetectBusy) return;
    const now = performance.now();
    if (now - lastObstacleDetectAt < OBSTACLE_DETECT_INTERVAL_MS) return;
    if (!window.api || typeof api.postForm !== 'function') return;
    lastObstacleDetectAt = now;
    obstacleDetectBusy = true;
    try {
      const canvas = getObstacleCaptureCanvas(el.sourceVideo);
      const ctx2d = canvas.getContext('2d');
      if (!ctx2d) return;
      ctx2d.drawImage(el.sourceVideo, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', OBSTACLE_DETECT_JPEG_QUALITY));
      if (!blob) return;
      const formData = new FormData();
      formData.append('frame', blob, 'diet-frame.jpg');
      const res = await api.postForm(`/api/detect/obstacles?conf=${OBSTACLE_DETECT_CONF}&imgsz=${OBSTACLE_DETECT_IMGSZ}`, formData);
      const detections = Array.isArray(res?.detections) ? res.detections : [];
      const dangerList = [...new Set(detections
        .map((d) => String(d.class_name || ''))
        .filter((name) => name && name !== 'person' && OBSTACLE_DANGER_CLASSES.has(name))
        .map((name) => toObstacleKo(name)))];
      if (dangerList.length > 0) {
        lastObstacleWarnAt = Date.now();
        pushLiveCue(`실시간 코칭(안전): 주변 위험물체 - ${dangerList.join(', ')}`, 3);
      } else if (Date.now() - lastObstacleWarnAt <= OBSTACLE_WARN_HOLD_MS) {
        pushLiveCue('실시간 코칭(안전): 주변 물체 거리 유지', 2);
      }
    } catch (_) {
      // 서버 감지 실패 시 기존 자세 코칭은 계속 동작
    } finally {
      obstacleDetectBusy = false;
    }
  }

  function resizeCanvasToVideo() {
    if (!el.sourceVideo.videoWidth || !el.sourceVideo.videoHeight) return;
    /* 캔버스 내부 해상도 = 비디오 프레임과 동일해야 랜드마크(정규화 좌표)와 일치합니다. */
    el.overlay.width = el.sourceVideo.videoWidth;
    el.overlay.height = el.sourceVideo.videoHeight;
  }

  /**
   * 무엇: 웹캠일 때만 영상·오버레이를 좌우 반전합니다.
   * 왜: 거울처럼 보이게 하고, 같은 transform으로 픽셀과 스켈레톤 위치를 맞춥니다.
   */
  function setCameraMirror(on) {
    if (!el.videoStack) return;
    el.videoStack.classList.toggle('is-camera-mirror', !!on);
  }

  function drawPose(results) {
    if (!ctx) return;
    resizeCanvasToVideo();
    ctx.clearRect(0, 0, el.overlay.width, el.overlay.height);
    if (!results.poseLandmarks) return;

    window.drawConnectors(ctx, results.poseLandmarks, window.POSE_CONNECTIONS, { color: '#30D158', lineWidth: 3 });
    window.drawLandmarks(ctx, results.poseLandmarks, { color: '#FFD60A', fillColor: '#007AFF', radius: 3 });
  }

  function updateScoreWithLandmarks(landmarks) {
    const postureScore = calcPostureScore(landmarks);
    const activityScore = detectPunchAndActivity(landmarks);
    const signals = deriveCoachSignals(landmarks);
    scoreSampleCount += 1;
    postureScoreAvg += (postureScore - postureScoreAvg) / scoreSampleCount;
    activityScoreAvg += (activityScore - activityScoreAvg) / scoreSampleCount;
    renderScores();
    const w = tuning.postureWeight;
    updateFeedback(Math.round(postureScoreAvg * w + activityScoreAvg * (1 - w)), postureScore, activityScore);
    updateLiveCue(signals, activityScore);

    if (signals) {
      const guardAvg = (signals.guardL + signals.guardR) / 2;
      coachingStats.shoulderPenalty += clamp01(Math.max(
        signals.shoulderGap / Math.max(0.02, tuning.shoulderTol),
        signals.hipGap / Math.max(0.02, tuning.hipTol),
      ) - 0.6);
      coachingStats.guardPenalty += clamp01(0.8 - guardAvg);
      coachingStats.activityPenalty += clamp01((tuning.feedbackActivityLow - activityScore) / 100);
      coachingStats.samples += 1;

      reportStats.shoulderGapSum += signals.shoulderGap;
      reportStats.hipGapSum += signals.hipGap;
      reportStats.guardAvgSum += guardAvg;
      reportStats.leftReachSum += signals.leftReach;
      reportStats.rightReachSum += signals.rightReach;
      reportStats.leftElbowNormSum += signals.leftElbowNorm;
      reportStats.rightElbowNormSum += signals.rightElbowNorm;
      reportStats.samples += 1;
    }
  }

  async function ensurePose() {
    if (pose) {
      try {
        pose.setOptions({ selfieMode: false });
      } catch (e) {
        /* 옵션 갱신 실패는 무시 */
      }
      return pose;
    }
    if (!window.Pose) throw new Error('MediaPipe Pose 로드 실패');
    pose = new window.Pose({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
    });
    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      minDetectionConfidence: 0.55,
      minTrackingConfidence: 0.55,
      /* false: 원본 프레임 기준 랜드마크. 표시는 CSS로만 거울 반전해 어긋남을 줄입니다. */
      selfieMode: false,
    });
    pose.onResults((results) => {
      drawPose(results);
      if (!results.poseLandmarks) return;
      detectObstaclesFromApi();

      if (runningMode === 'upload_ref') {
        referenceFrameCounter += 1;
        if (referenceFrameCounter % 3 === 0) {
          const refVec = toPoseVector(results.poseLandmarks);
          if (refVec && referenceVectors.length < 600) {
            referenceVectors.push({
              vec: refVec,
              label: classifySegment(refVec),
            });
          }
        }
      }

      if (runningMode === 'camera' && referenceVectors.length > 8) {
        updateSimilarityFromLive(results.poseLandmarks);
      }

      if (phase === 'work') updateScoreWithLandmarks(results.poseLandmarks);
    });
    return pose;
  }

  function stopCurrentSource() {
    if (cameraInstance && cameraInstance.stop) cameraInstance.stop();
    cameraInstance = null;

    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }

    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;

    if (runningMode === 'upload_preview' || runningMode === 'upload_ref') {
      el.sourceVideo.pause();
      el.sourceVideo.removeAttribute('src');
      el.sourceVideo.load();
    }

    runningMode = 'idle';
    sourceReady = false;
    obstacleDetectBusy = false;
    lastObstacleWarnAt = 0;
    setCameraMirror(false);
    el.feedback.textContent = '분석 준비 중입니다. 카메라 또는 영상을 연결하세요.';
  }

  async function startCamera() {
    stopCurrentSource();
    try {
      const p = await ensurePose();
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 960 },
          height: { ideal: 540 },
          aspectRatio: { ideal: 16 / 9 },
        },
        audio: false,
      });
      el.sourceVideo.srcObject = stream;
      await el.sourceVideo.play();
      sourceReady = true;
      runningMode = 'camera';
      setCameraMirror(true);
      el.feedback.textContent = '카메라 분석 중입니다. 운동 시작 후 점수가 누적됩니다.';
      if (referenceVectors.length > 8) {
        el.referenceStatus.textContent = `기준 벡터 ${referenceVectors.length}개와 실시간 유사도 비교 중`;
      }

      cameraInstance = new window.Camera(el.sourceVideo, {
        onFrame: async () => {
          if (!sourceReady) return;
          await p.send({ image: el.sourceVideo });
        },
        width: 960,
        height: 540,
      });
      cameraInstance.start();
    } catch (err) {
      el.feedback.textContent = `카메라 시작 실패: ${err && err.message ? err.message : '권한을 확인해 주세요.'}`;
    }
  }

  async function startUploadedVideo(file) {
    if (file) {
      uploadedFile = file;
      if (uploadedFileUrl) URL.revokeObjectURL(uploadedFileUrl);
      uploadedFileUrl = URL.createObjectURL(file);
      resetReferenceModel('새 영상을 올렸습니다. “기준 영상 분석”을 눌러 기준 데이터를 생성하세요.');
    }

    if (!uploadedFileUrl) {
      el.feedback.textContent = '먼저 업로드할 영상을 선택해 주세요.';
      return;
    }

    stopCurrentSource();
    try {
      const p = await ensurePose();
      el.sourceVideo.srcObject = null;
      el.sourceVideo.src = uploadedFileUrl;
      el.sourceVideo.muted = true;
      el.sourceVideo.loop = true;
      await el.sourceVideo.play();
      sourceReady = true;
      runningMode = 'upload_preview';
      setCameraMirror(false);
      el.feedback.textContent = '업로드 영상을 미리보기 중입니다. 기준으로 쓰려면 “기준 영상 분석”을 누르세요.';

      const loop = async () => {
        if (!sourceReady) return;
        if (runningMode !== 'upload_preview' && runningMode !== 'upload_ref') return;
        if (!el.sourceVideo.paused && !el.sourceVideo.ended) await p.send({ image: el.sourceVideo });
        rafId = requestAnimationFrame(loop);
      };
      loop();
    } catch (err) {
      el.feedback.textContent = `영상 분석 시작 실패: ${err && err.message ? err.message : '영상 파일을 확인해 주세요.'}`;
    }
  }

  /**
   * 무엇: 업로드된 영상 전체를 순회하며 기준 포즈 벡터를 수집합니다.
   * 왜: 이후 웹캠 포즈와 가장 가까운 프레임을 찾아 유사도(%)를 계산하기 위함입니다.
   */
  async function buildReferenceFromUploaded() {
    if (isBuildingReference) {
      el.referenceStatus.textContent = '이미 기준 영상 분석 중입니다. 완료될 때까지 잠시 기다려 주세요.';
      return;
    }
    if (!uploadedFileUrl) {
      el.referenceStatus.textContent = '기준 영상이 없습니다. 먼저 영상을 업로드해 주세요.';
      return;
    }

    try {
      isBuildingReference = true;
      if (el.refBuild) {
        el.refBuild.disabled = true;
        el.refBuild.textContent = '분석 중...';
      }
      setReferenceProgress(0, '진행 중');
      if (runningMode !== 'upload_preview') await startUploadedVideo();
      referenceVectors = [];
      referenceFrameCounter = 0;
      resetSimilarityRuntime();
      el.referenceStatus.textContent = '기준 영상 분석 중... 잠시만 기다려 주세요.';
      el.feedback.textContent = '영상의 관절 시퀀스를 기준 데이터로 추출하고 있습니다.';

      runningMode = 'upload_ref';
      el.sourceVideo.loop = false;
      el.sourceVideo.currentTime = 0;
      await el.sourceVideo.play();

      const analyzeTimeoutMs = getAnalyzeTimeoutSec() * 1000;
      await new Promise((resolve, reject) => {
        const updateProgress = () => {
          const duration = el.sourceVideo.duration || 0;
          const current = el.sourceVideo.currentTime || 0;
          if (!duration) return;
          const pct = Math.min(100, Math.max(0, Math.round((current / duration) * 100)));
          setReferenceProgress(pct);
        };
        const handleEnded = () => {
          clearTimeout(timeoutId);
          clearInterval(progressTimerId);
          el.sourceVideo.removeEventListener('ended', handleEnded);
          resolve();
        };
        const progressTimerId = setInterval(updateProgress, 200);
        const timeoutId = setTimeout(() => {
          clearInterval(progressTimerId);
          el.sourceVideo.removeEventListener('ended', handleEnded);
          reject(new Error('기준 분석 제한 시간을 초과했습니다.'));
        }, analyzeTimeoutMs);
        el.sourceVideo.addEventListener('ended', handleEnded);
      });

      runningMode = 'upload_preview';
      el.sourceVideo.loop = true;
      el.sourceVideo.currentTime = 0;
      await el.sourceVideo.play();

      if (referenceVectors.length < 10) {
        setReferenceProgress(100, '벡터 부족');
        el.referenceStatus.textContent = '기준 벡터가 너무 적습니다. 전신이 잘 보이는 영상을 사용해 주세요.';
        return;
      }
      setReferenceProgress(100, '완료');
      el.referenceStatus.textContent = `기준 영상 분석 완료: ${referenceVectors.length}개 포즈 벡터 저장됨`;
      el.feedback.textContent = '이제 카메라를 켜면 기준 영상과의 유사도(%)가 실시간으로 표시됩니다.';
    } catch (err) {
      runningMode = 'upload_preview';
      setReferenceProgress(0, '실패');
      el.referenceStatus.textContent = '기준 영상 분석에 실패했습니다.';
      el.feedback.textContent = `기준 분석 실패: ${err && err.message ? err.message : '영상을 다시 확인해 주세요.'}`;
    } finally {
      isBuildingReference = false;
      if (el.refBuild) {
        el.refBuild.disabled = false;
        el.refBuild.textContent = '기준 영상 분석';
      }
    }
  }

  function bindAnalyzerEvents() {
    if (el.cameraStart) el.cameraStart.addEventListener('click', startCamera);
    if (el.cameraStop) el.cameraStop.addEventListener('click', stopCurrentSource);
    if (el.upload) {
      el.upload.addEventListener('change', (event) => {
        const file = event.target.files && event.target.files[0];
        startUploadedVideo(file);
      });
    }
    if (el.refBuild) el.refBuild.addEventListener('click', buildReferenceFromUploaded);
    if (el.refClear) {
      el.refClear.addEventListener('click', () => {
        resetReferenceModel('기준 영상이 초기화되었습니다. 새 영상을 업로드해 다시 분석해 주세요.');
      });
    }
    if (el.refSaveProfile) el.refSaveProfile.addEventListener('click', saveReferenceProfileFromCurrent);
    if (el.refLoadProfile) el.refLoadProfile.addEventListener('click', loadSelectedReferenceProfile);
    if (el.refDeleteProfile) el.refDeleteProfile.addEventListener('click', deleteSelectedReferenceProfile);
    if (el.exportCsv) el.exportCsv.addEventListener('click', exportSessionHistoryCsv);
    if (el.analyzeTimeoutReset) {
      el.analyzeTimeoutReset.addEventListener('click', () => {
        saveAnalyzeTimeoutSec(DEFAULT_ANALYZE_TIMEOUT_SEC);
      });
    }
  }

  function setHiddenById(id, hidden) {
    const node = document.getElementById(id);
    if (!node) return;
    if (hidden) node.setAttribute('hidden', '');
    else node.removeAttribute('hidden');
  }

  function setModeView(mode) {
    // mode: gate | play-source | play-config | analyze
    setHiddenById('diet-mode-gate', mode !== 'gate');
    setHiddenById('diet-play-sections', mode !== 'play-source' && mode !== 'play-config');
    setHiddenById('diet-play-source-gate', mode !== 'play-source');
    setHiddenById('diet-play-config', mode !== 'play-config');
    setHiddenById('diet-analyzer-section', mode !== 'analyze');
  }

  function bindModeEvents() {
    const modePlay = document.getElementById('diet-mode-play');
    const modeAnalyze = document.getElementById('diet-mode-analyze');
    const sourceSample = document.getElementById('diet-source-sample');
    const sourceUpload = document.getElementById('diet-source-upload');
    const backToMode = document.getElementById('diet-back-to-mode');
    const analyzeBackToMode = document.getElementById('diet-analyze-back-to-mode');
    const playUploadPanel = document.getElementById('diet-play-upload-panel');
    const directLinkSection = document.getElementById('diet-direct-link-section');
    const uploadPickBtn = document.getElementById('diet-play-upload-pick');
    const uploadInput = document.getElementById('diet-video-upload');

    if (modePlay) {
      modePlay.addEventListener('click', () => {
        setModeView('play-source');
      });
    }
    if (modeAnalyze) {
      modeAnalyze.addEventListener('click', () => {
        setModeView('analyze');
      });
    }
    if (sourceSample) {
      sourceSample.addEventListener('click', () => {
        if (playUploadPanel) playUploadPanel.setAttribute('hidden', '');
        if (directLinkSection) directLinkSection.removeAttribute('hidden');
        setModeView('play-config');
      });
    }
    if (sourceUpload) {
      sourceUpload.addEventListener('click', () => {
        if (playUploadPanel) playUploadPanel.removeAttribute('hidden');
        if (directLinkSection) directLinkSection.setAttribute('hidden', '');
        setModeView('play-config');
      });
    }
    if (backToMode) {
      backToMode.addEventListener('click', () => {
        setModeView('gate');
      });
    }
    if (analyzeBackToMode) {
      analyzeBackToMode.addEventListener('click', () => {
        setModeView('gate');
      });
    }
    if (uploadPickBtn && uploadInput) {
      uploadPickBtn.addEventListener('click', () => uploadInput.click());
    }
  }

  /**
   * 무엇: 탭 비활성/복귀 시 분석 리소스를 제어합니다.
   * 왜: 백그라운드 상태에서 불필요한 처리로 브라우저가 느려지는 것을 줄이기 위함입니다.
   */
  function handleVisibilityChange() {
    if (document.hidden) {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      if (timerId) {
        wasRunningBeforeHidden = true;
        pauseSession();
      } else {
        wasRunningBeforeHidden = false;
      }
      return;
    }

    if (wasRunningBeforeHidden && phase !== 'idle' && phase !== 'done' && !timerId) {
      wasRunningBeforeHidden = false;
      resumeOrStart();
      return;
    }
    wasRunningBeforeHidden = false;
  }

  function init() {
    if (!el.start) return;
    const main = document.getElementById('diet-main');
    if (main) {
      main.classList.remove('diet-main--hidden');
      main.removeAttribute('hidden');
      main.setAttribute('aria-hidden', 'false');
    }
    setModeView('gate');
    tuning = loadTuning();
    syncUIFromTuning();
    bindTuningEvents();
    drawSimilarityGraph();
    if (el.coachLevel) {
      coachLevel = el.coachLevel.value || 'normal';
      el.coachLevel.addEventListener('change', () => {
        coachLevel = el.coachLevel.value || 'normal';
      });
    }
    if (el.ttsEnabled) {
      ttsEnabled = !!el.ttsEnabled.checked;
      el.ttsEnabled.addEventListener('change', () => {
        ttsEnabled = !!el.ttsEnabled.checked;
        if (!ttsEnabled && window.speechSynthesis) window.speechSynthesis.cancel();
      });
    }
    renderReferenceProfiles();
    renderSessionHistory();
    if (el.analyzeTimeout) {
      el.analyzeTimeout.value = String(getAnalyzeTimeoutSec());
      el.analyzeTimeout.addEventListener('change', () => {
        saveAnalyzeTimeoutSec(el.analyzeTimeout.value);
      });
    }
    setReferenceProgress(0);
    el.weight.value = String(getWeightKg());
    renderPrograms();
    resetSession(false);
    bindAnalyzerEvents();
    bindModeEvents();

    el.start.addEventListener('click', () => {
      if (timerId) return;
      if (phase === 'idle' || phase === 'done') startSession();
      else resumeOrStart();
    });
    el.pause.addEventListener('click', () => {
      if (phase === 'idle' || phase === 'done') return;
      if (timerId) pauseSession();
      else resumeOrStart();
    });
    el.reset.addEventListener('click', () => resetSession(true));
    window.addEventListener('beforeunload', stopCurrentSource);
    window.addEventListener('beforeunload', () => {
      if (uploadedFileUrl) {
        URL.revokeObjectURL(uploadedFileUrl);
        uploadedFileUrl = '';
      }
    });
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('resize', drawSimilarityGraph);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

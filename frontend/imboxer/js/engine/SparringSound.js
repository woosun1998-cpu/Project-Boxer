const STORAGE_KEY = "im_boxer_sparring_sound_enabled";
const BGM_NEXT_INDEX_KEY = "im_boxer_sparring_bgm_next_indexes";
const ROOT = "./assets/sounds";

const MODE_BGM = {
  beginner: [
    `${ROOT}/bgm/sparring/beginner_sparring_BGM1.mp3`,
    `${ROOT}/bgm/sparring/beginner_sparring_BGM2.mp3`,
  ],
  intermediate: [
    `${ROOT}/bgm/sparring/intermediater_sparring_BGM1.mp3`,
    `${ROOT}/bgm/sparring/intermediater_sparring_BGM2.mp3`,
  ],
  advanced: [
    `${ROOT}/bgm/sparring/advanced_sparring_BGM1.mp3`,
    `${ROOT}/bgm/sparring/advanced_sparring_BGM2.mp3`,
  ],
  pro: [
    `${ROOT}/bgm/sparring/advanced_sparring_BGM1.mp3`,
    `${ROOT}/bgm/sparring/advanced_sparring_BGM2.mp3`,
  ],
};

const SFX = {
  readyRound: `${ROOT}/bgm/sparring/ready_round.mp3`,
  crowd: `${ROOT}/crowd/crowd-cheering-in-stadium.mp3`,
  openingBell: `${ROOT}/ui/opening-bell.mp3`,
  closeBell: `${ROOT}/ui/close-bell.mp3`,
  winTheme: `${ROOT}/ui/win_theme.mp3`,
  loseTheme: `${ROOT}/ui/lose_theme.mp3`,
  youWin: `${ROOT}/ui/you-win.mp3`,
  youLose: `${ROOT}/ui/you-lose.mp3`,
};

const PUNCHES = [
  `${ROOT}/sfx/PUNCHES/alice_soundz-punch.mp3`,
  `${ROOT}/sfx/PUNCHES/classic-punch-impact.mp3`,
  `${ROOT}/sfx/PUNCHES/dragon-studio-hard-punch.mp3`,
  `${ROOT}/sfx/PUNCHES/freesound_community-punch.mp3`,
  `${ROOT}/sfx/PUNCHES/punch-04.mp3`,
  `${ROOT}/sfx/PUNCHES/punch-sound-effect.mp3`,
  `${ROOT}/sfx/PUNCHES/soraatwod-punch.mp3`,
  `${ROOT}/sfx/PUNCHES/strong-punch.mp3`,
  `${ROOT}/sfx/PUNCHES/universfield-punch.mp3`,
];

const WHOOSHES = [
  `${ROOT}/sfx/PUNCHES/BIG_WOOSH.mp3`,
  `${ROOT}/sfx/PUNCHES/dragon-studio-epic-whoosh.mp3`,
  `${ROOT}/sfx/PUNCHES/dragon-studio-simple-whoosh.mp3`,
  `${ROOT}/sfx/PUNCHES/dragon-studio-whoosh.mp3`,
  `${ROOT}/sfx/PUNCHES/soundreality-whoosh1.mp3`,
];

const state = {
  enabled: readEnabled(),
  bgm: null,
  bgmMode: "",
  bgmQueue: [],
  bgmIndex: 0,
  ready: null,
  activeShots: new Set(),
  toggleButtons: new Set(),
  unlockBound: false,
};

function readEnabled() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "0";
  } catch {
    return true;
  }
}

function saveEnabled(value) {
  try {
    localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  } catch {
    // Ignore private-mode storage failures.
  }
}

function normalizeMode(mode) {
  return Object.prototype.hasOwnProperty.call(MODE_BGM, mode) ? mode : "beginner";
}

function readNextIndexes() {
  try {
    const raw = localStorage.getItem(BGM_NEXT_INDEX_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveNextIndexes(indexes) {
  try {
    localStorage.setItem(BGM_NEXT_INDEX_KEY, JSON.stringify(indexes));
  } catch {
    // Ignore private-mode storage failures.
  }
}

function createAlternatingBgmQueue(mode) {
  const list = MODE_BGM[normalizeMode(mode)] || MODE_BGM.beginner;
  if (list.length <= 1) {
    return [...list];
  }

  const indexes = readNextIndexes();
  const nextIndex = Math.abs(Number.parseInt(indexes[mode], 10) || 0) % list.length;
  indexes[mode] = (nextIndex + 1) % list.length;
  saveNextIndexes(indexes);

  return [
    ...list.slice(nextIndex),
    ...list.slice(0, nextIndex),
  ];
}

function randomItem(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function safePlay(audio) {
  if (!audio || !state.enabled) {
    return Promise.resolve(false);
  }
  return audio.play().then(
    () => true,
    () => false,
  );
}

function createAudio(src, { volume = 0.75, loop = false } = {}) {
  const audio = new Audio(src);
  audio.preload = "auto";
  audio.volume = volume;
  audio.loop = loop;
  return audio;
}

function syncToggles() {
  state.toggleButtons.forEach((button) => {
    button.dataset.soundEnabled = state.enabled ? "1" : "0";
    button.setAttribute("aria-pressed", state.enabled ? "true" : "false");
    button.textContent = state.enabled ? "SOUND ON" : "SOUND OFF";
  });
}

function setEnabled(value) {
  state.enabled = Boolean(value);
  saveEnabled(state.enabled);
  syncToggles();

  if (!state.enabled) {
    stopBgm();
    stopReady();
    state.activeShots.forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
    });
    state.activeShots.clear();
  }
  window.dispatchEvent(new CustomEvent("im-boxer-sparring-sound-change", {
    detail: { enabled: state.enabled },
  }));
}

function bindToggle(button) {
  if (!button) {
    return;
  }
  state.toggleButtons.add(button);
  button.addEventListener("click", () => {
    setEnabled(!state.enabled);
  });
  syncToggles();
}

function init({ toggleSelector = "[data-sound-toggle]" } = {}) {
  document.querySelectorAll(toggleSelector).forEach(bindToggle);
  if (!state.unlockBound) {
    const unlock = () => {
      if (state.enabled) {
        void safePlay(state.ready);
        void safePlay(state.bgm);
      }
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      state.unlockBound = false;
    };
    window.addEventListener("pointerdown", unlock, { passive: true, once: true });
    window.addEventListener("keydown", unlock);
    state.unlockBound = true;
  }
  syncToggles();
}

function stopBgm() {
  if (!state.bgm) {
    return;
  }
  state.bgm.pause();
  state.bgm.onended = null;
  state.bgm.src = "";
  state.bgm = null;
  state.bgmMode = "";
  state.bgmQueue = [];
}

function playNextBgmTrack() {
  if (!state.enabled || !state.bgmQueue.length) {
    return;
  }

  const src = state.bgmQueue[state.bgmIndex % state.bgmQueue.length];
  state.bgmIndex += 1;

  if (!state.bgm) {
    state.bgm = createAudio(src, { volume: 0.42 });
  } else {
    state.bgm.src = src;
  }

  state.bgm.loop = false;
  state.bgm.onended = playNextBgmTrack;
  void safePlay(state.bgm);
}

function startModeBgm(mode = "beginner", { restart = false } = {}) {
  const normalizedMode = normalizeMode(mode);
  if (!state.enabled) {
    return;
  }
  if (!restart && state.bgm && state.bgmMode === normalizedMode) {
    void safePlay(state.bgm);
    return;
  }

  stopBgm();
  state.bgmMode = normalizedMode;
  state.bgmQueue = createAlternatingBgmQueue(normalizedMode);
  state.bgmIndex = 0;
  playNextBgmTrack();
}

function startRandomSparringBgm() {
  startModeBgm(randomItem(Object.keys(MODE_BGM)), { restart: true });
}

function stopReady() {
  if (!state.ready) {
    return;
  }
  state.ready.pause();
  state.ready.src = "";
  state.ready = null;
}

function playReadyRound() {
  if (!state.enabled) {
    return;
  }
  stopReady();
  state.ready = createAudio(SFX.readyRound, { volume: 0.7, loop: true });
  void safePlay(state.ready);
}

function playOneShot(src, { volume = 0.75, delayMs = 0 } = {}) {
  if (!state.enabled || !src) {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    window.setTimeout(() => {
      if (!state.enabled) {
        resolve(false);
        return;
      }
      const audio = createAudio(src, { volume });
      state.activeShots.add(audio);
      const cleanup = () => {
        state.activeShots.delete(audio);
        audio.onended = null;
        audio.onerror = null;
      };
      audio.onended = cleanup;
      audio.onerror = cleanup;
      safePlay(audio).then(resolve);
    }, Math.max(0, delayMs));
  });
}

function playCrowdAndBell() {
  stopReady();
  void playOneShot(SFX.crowd, { volume: 0.7 });
  void playOneShot(SFX.openingBell, { volume: 0.85, delayMs: 850 });
}

function playCloseBell() {
  void playOneShot(SFX.closeBell, { volume: 0.85 });
}

function playPunch() {
  void playOneShot(randomItem(PUNCHES), { volume: 0.78 });
}

function playWhoosh() {
  void playOneShot(randomItem(WHOOSHES), { volume: 0.42 });
}

function playResult(winner) {
  stopBgm();
  stopReady();
  playCloseBell();
  if (winner === "player") {
    void playOneShot(SFX.winTheme, { volume: 0.82, delayMs: 780 });
    void playOneShot(SFX.youWin, { volume: 0.9, delayMs: 1350 });
  } else {
    void playOneShot(SFX.loseTheme, { volume: 0.82, delayMs: 780 });
    void playOneShot(SFX.youLose, { volume: 0.9, delayMs: 1350 });
  }
}

export const SparringSound = {
  init,
  setEnabled,
  startModeBgm,
  startRandomSparringBgm,
  stopBgm,
  playReadyRound,
  stopReady,
  playCrowdAndBell,
  playCloseBell,
  playPunch,
  playWhoosh,
  playResult,
};

if (typeof window !== "undefined") {
  window.IM_BOXER_SPARRING_SOUND = SparringSound;
}

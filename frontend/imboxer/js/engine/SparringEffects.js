/**
 * SparringEffects.js
 * Pure visual effects module for sparring_start.html.
 * Codex drives game logic; this module handles all CSS/DOM visual feedback.
 * Exposed as window.IM_BOXER_SPARRING_EFFECTS for non-module usage.
 */

const _game = () => document.querySelector('.ss-game');
const _attr = (el, key, val, delay) => {
  if (!el) return;
  el.dataset[key] = val ?? '';
  if (delay != null) setTimeout(() => delete el.dataset[key], delay);
};

/* ── Internal helpers ──────────────────────────── */
function _restartAnim(el) {
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = '';
}

/* ── Exported API ──────────────────────────────── */
export const SparringEffects = {

  /**
   * Player took a hit — red vignette flash + screen shake + chromatic.
   * @param {number} intensity  1 = normal, 2 = heavy
   */
  playerHit(intensity = 1) {
    const g = _game(); if (!g) return;
    _restartAnim(g);
    g.dataset.hitPlayer = '';
    g.dataset.shake = '';
    g.dataset.damageShock = '';
    if (intensity >= 2) navigator.vibrate?.([110, 35, 90, 25, 140]);
    else                navigator.vibrate?.([55, 25, 65]);
    setTimeout(() => {
      delete g.dataset.hitPlayer;
      delete g.dataset.shake;
      delete g.dataset.damageShock;
    }, intensity >= 2 ? 720 : 560);
  },

  /**
   * Player landed a hit on AI — yellow flash.
   */
  aiHit() {
    const g = _game(); if (!g) return;
    _restartAnim(g);
    g.dataset.hitAi = '';
    navigator.vibrate?.([25]);
    setTimeout(() => delete g.dataset.hitAi, 300);
  },

  /**
   * Show a judgment popup text (HIT!, DODGE!, etc.).
   * @param {HTMLElement} el   The [data-player-judgment] or [data-ai-judgment] element
   * @param {string} text      Display text
   * @param {'hit'|'guard'|'dodge'|'damage'|'ko'|'perfect'} type
   */
  showJudgment(el, text, type = 'hit') {
    if (!el) return;
    el.textContent = text;
    el.dataset.judgmentType = type;
    delete el.dataset.visible;
    void el.offsetWidth;
    el.dataset.visible = '';
    setTimeout(() => {
      delete el.dataset.visible;
      delete el.dataset.judgmentType;
    }, 850);
  },

  /**
   * Show combo burst animation.
   * @param {HTMLElement} el   The [data-combo-flash] element
   * @param {number} count     Combo count
   */
  comboFlash(el, count) {
    if (!el) return;
    el.textContent = `x${count} COMBO`;
    const level = count >= 7 ? 'fever' : count >= 5 ? 'hot' : 'normal';
    el.dataset.comboLevel = level;
    delete el.dataset.visible;
    void el.offsetWidth;
    el.dataset.visible = '';
    if (count >= 7) {
      const g = _game();
      if (g) { g.dataset.shake = ''; setTimeout(() => delete g.dataset.shake, 420); }
      navigator.vibrate?.([60, 20, 60]);
    }
    setTimeout(() => {
      delete el.dataset.visible;
      delete el.dataset.comboLevel;
    }, 920);
  },

  /**
   * Toggle danger state (red pulsing vignette) for HP < 30%.
   * @param {boolean} isDanger
   */
  setDanger(isDanger) {
    const g = _game(); if (!g) return;
    if (isDanger) g.dataset.danger = '';
    else          delete g.dataset.danger;
  },

  /**
   * Round transition flash (ROUND 2, ROUND 3 …).
   * @param {number} roundNum
   */
  roundTransition(roundNum) {
    const el = document.querySelector('[data-round-flash]');
    const txt = document.querySelector('[data-round-flash-text]');
    if (!el || !txt) return;
    txt.textContent = `ROUND ${roundNum}`;
    el.dataset.visible = '';
    setTimeout(() => delete el.dataset.visible, 1400);
  },

  /**
   * KO sequence: slow → flash → KO text.
   * @param {'player'|'ai'} winner  Who landed the KO
   */
  koSequence(winner) {
    const g = _game(); if (!g) return;
    const judgeEl = document.querySelector('[data-player-judgment]');
    navigator.vibrate?.([100, 40, 100, 40, 220]);

    /* Step 1: screen shake */
    g.dataset.shake = '';
    setTimeout(() => delete g.dataset.shake, 450);

    /* Step 2: KO popup */
    setTimeout(() => {
      this.showJudgment(judgeEl, 'K.O.!!', 'ko');
      g.dataset.shake = '';
      setTimeout(() => delete g.dataset.shake, 450);
    }, 300);

    /* Step 3: gameover state handled by Codex via data-game-state="game_over" */
  },

  /**
   * Update coach metric with color-coded feedback value.
   * @param {'jab'|'guard'|'distance'|'accuracy'|'reaction'} metric
   * @param {string} value  e.g. 'GOOD', 'TOO LOW', 'PERFECT'
   */
  setCoach(metric, value) {
    const el = document.querySelector(`[data-coach-${metric}]`);
    if (!el) return;
    el.textContent = value;
    el.dataset.coachVal = value;
  },

  /**
   * Set coach tip text.
   * @param {string} text
   */
  setCoachTip(text) {
    const el = document.querySelector('[data-coach-tip]');
    if (el) el.innerHTML = text;
  },

  /**
   * Update a stat value (score, combo, hit-count, punch-speed).
   */
  setStat(attr, value) {
    const el = document.querySelector(`[data-${attr}]`);
    if (el) el.textContent = value;
  },

  /**
   * Update HP bar + value.
   * @param {'player'|'ai'} who
   * @param {number} pct  0–100
   */
  setHp(who, pct) {
    const bar = document.querySelector(`[data-${who}-hp-bar]`);
    const val = document.querySelector(`[data-${who}-hp]`);
    if (bar) {
      bar.style.width = Math.max(0, Math.min(100, pct)) + '%';
      if (pct <= 15) bar.dataset.hpLow = ''; else delete bar.dataset.hpLow;
    }
    if (val) val.textContent = Math.round(pct);
    if (who === 'player') this.setDanger(pct < 30);
  },
};

/* Expose globally for non-module scripts (Codex compatibility) */
window.IM_BOXER_SPARRING_EFFECTS = SparringEffects;

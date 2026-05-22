// =============================================
// GameEngine.js
// Core sparring state, scoring, combo, and accuracy evaluation.
// =============================================

class BoxingGame {
  constructor(config = {}) {
    this.playerHP = 100;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.dodgeCount = 0;
    this.hitCount = 0;
    this.isGameOver = false;
    this.sessionId = null;
    this.lastRoundResult = null;

    this.hpLoss = config.hpLoss ?? 10;
    this.baseScore = config.baseScore ?? 100;
    this.comboBonus = config.comboBonus ?? 0.1;
  }

  onJudge(result, reactionMs, judgeMeta = {}) {
    if (this.isGameOver) return null;

    const accuracy = this.evaluateAccuracy(result, reactionMs, judgeMeta);

    if (result === 'DODGE') {
      this.combo++;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      this.dodgeCount++;

      const speedBonus = reactionMs < 200 ? 1.5
        : reactionMs < 300 ? 1.2
        : 1.0;

      const comboMultiplier = 1 + this.combo * this.comboBonus;
      const earned = Math.floor(
        this.baseScore * comboMultiplier * speedBonus * accuracy.accuracyMultiplier
      );

      this.score += earned;
      this._showEffect(`${accuracy.judgeLabel}!`, 'var(--color-accent-green)', earned);

      this.lastRoundResult = {
        result,
        reactionMs,
        earned,
        earnedScorePerAttack: earned,
        totalScore: this.score,
        combo: this.combo,
        hp: this.playerHP,
        speedBonus,
        comboMultiplier,
        accuracyScore: accuracy.accuracyScore,
        accuracyMultiplier: accuracy.accuracyMultiplier,
        judgeLabel: accuracy.judgeLabel,
        breakdown: accuracy.breakdown,
        attackType: judgeMeta.attackType || 'unknown',
        dodgeDirection: judgeMeta.dodgeDirection || 'unknown',
        outcome: 'success'
      };
    } else {
      this.playerHP = Math.max(0, this.playerHP - this.hpLoss);
      this.combo = 0;
      this.hitCount++;

      this._showEffect(accuracy.judgeLabel.toUpperCase(), 'var(--color-accent-red)');
      this._shakeScreen();

      this.lastRoundResult = {
        result,
        reactionMs,
        earned: 0,
        earnedScorePerAttack: 0,
        totalScore: this.score,
        combo: this.combo,
        hp: this.playerHP,
        speedBonus: 0,
        comboMultiplier: 1,
        accuracyScore: accuracy.accuracyScore,
        accuracyMultiplier: accuracy.accuracyMultiplier,
        judgeLabel: accuracy.judgeLabel,
        breakdown: accuracy.breakdown,
        attackType: judgeMeta.attackType || 'unknown',
        dodgeDirection: judgeMeta.dodgeDirection || 'unknown',
        outcome: 'fail'
      };

      if (this.playerHP <= 0) {
        this.triggerKO();
      }
    }

    this.renderUI();
    return this.lastRoundResult;
  }

  evaluateAccuracy(result, reactionMs, judgeMeta = {}) {
    const dodgeWindowMs = Math.max(180, Number(judgeMeta.dodgeWindowMs ?? judgeMeta.dodge_window_ms ?? 500));
    const timingScore = this.calculateTimingScore(result, reactionMs, dodgeWindowMs);
    const directionScore = this.calculateDirectionScore(result, judgeMeta);
    const displacementScore = this.calculateDisplacementScore(result, judgeMeta);
    const guardScore = this.calculateGuardScore(judgeMeta);
    const accuracyScore = Math.max(0, Math.min(100, timingScore + directionScore + displacementScore + guardScore));
    const judgeLabel = this.getJudgeLabel(result, accuracyScore, timingScore, guardScore);
    const accuracyMultiplier = this.getAccuracyMultiplier(judgeLabel, accuracyScore);

    return {
      accuracyScore,
      accuracyMultiplier,
      judgeLabel,
      breakdown: {
        timing: timingScore,
        direction: directionScore,
        displacement: displacementScore,
        guard: guardScore
      }
    };
  }

  calculateTimingScore(result, reactionMs, dodgeWindowMs) {
    if (result !== 'DODGE') return 0;
    const normalized = 1 - Math.min(Math.max(reactionMs, 0), dodgeWindowMs) / dodgeWindowMs;
    return Math.round(Math.max(0, normalized) * 40);
  }

  calculateDirectionScore(result, judgeMeta) {
    const raw = judgeMeta.directionMatched;
    const requiredMove = String(judgeMeta.requiredMove || judgeMeta.required_move || '').toLowerCase();
    const attackType = String(judgeMeta.attackType || judgeMeta.attack_type || '').toLowerCase();

    if (typeof raw === 'number') {
      return this.clampScore(raw, 30);
    }
    if (typeof raw === 'boolean') {
      if (!raw) {
        if (result !== 'DODGE') return 0;
        if (requiredMove === 'lean_back') return 8;
        if (requiredMove === 'duck') return 6;
        if (requiredMove === 'slip_side') return 10;
        return 12;
      }

      if (attackType === 'uppercut') return 30;
      if (attackType === 'straight') return requiredMove === 'lean_back' ? 28 : 24;
      if (attackType === 'hook') return requiredMove === 'slip_side' ? 30 : 26;
      if (attackType === 'jab') return requiredMove === 'slip_side' ? 28 : 24;
      return 30;
    }
    return result === 'DODGE' ? 18 : 0;
  }

  calculateDisplacementScore(result, judgeMeta) {
    if (typeof judgeMeta.displacementScore === 'number') {
      return this.clampScore(judgeMeta.displacementScore, 20);
    }

    const ratio = Number(judgeMeta.displacementRatio ?? (result === 'DODGE' ? 0.75 : 0));
    const satisfied = judgeMeta.displacementSatisfied;
    if (typeof satisfied === 'boolean') {
      return satisfied ? Math.min(20, Math.round(Math.max(ratio, 0.6) * 20)) : Math.round(Math.max(ratio, 0) * 8);
    }

    return this.clampScore(Math.round(Math.max(0, ratio) * 20), 20);
  }

  calculateGuardScore(judgeMeta) {
    if (typeof judgeMeta.guardScore === 'number') {
      return this.clampScore(judgeMeta.guardScore, 10);
    }
    if (typeof judgeMeta.guardOk === 'boolean') {
      return judgeMeta.guardOk ? 10 : 0;
    }
    return 4;
  }

  clampScore(score, max) {
    return Math.max(0, Math.min(max, Math.round(score)));
  }

  getJudgeLabel(result, accuracyScore, timingScore, guardScore) {
    if (result !== 'DODGE') return 'Miss';
    if (accuracyScore >= 90 && timingScore >= 32 && guardScore >= 8) return 'Perfect';
    if (accuracyScore >= 75) return 'Clean';
    if (accuracyScore >= 55) return 'Late';
    if (accuracyScore >= 35) return 'Unsafe';
    return 'Miss';
  }

  getAccuracyMultiplier(judgeLabel, accuracyScore) {
    switch (judgeLabel) {
      case 'Perfect':
        return 1.35;
      case 'Clean':
        return 1.15;
      case 'Late':
        return 1.0;
      case 'Unsafe':
        return 0.9;
      case 'Miss':
      default:
        return accuracyScore > 0 ? 0.75 : 0.6;
    }
  }

  renderUI() {
    const hpBar = document.getElementById('hp-bar');
    if (hpBar) {
      hpBar.style.width = this.playerHP + '%';
      hpBar.style.background =
        this.playerHP > 50 ? 'var(--color-accent-green)' :
        this.playerHP > 25 ? 'var(--color-accent-gold)' :
        'var(--color-accent-red)';

      const hpWrap = document.getElementById('hp-bar-wrap');
      if (hpWrap) {
        hpWrap.style.animation = this.playerHP <= 20 ? 'hpPulse 0.8s ease infinite' : '';
      }
    }

    const hpNum = document.getElementById('hp-num');
    if (hpNum) hpNum.textContent = this.playerHP;

    const scoreEl = document.getElementById('score-display');
    if (scoreEl) scoreEl.textContent = this.score.toLocaleString();

    const comboEl = document.getElementById('combo-display');
    if (comboEl) {
      comboEl.textContent = this.combo > 0 ? `${this.combo} COMBO` : '';
      if (this.combo > 0) {
        comboEl.style.animation = 'none';
        requestAnimationFrame(() => {
          comboEl.style.animation = 'comboBounce 0.3s ease';
        });
      }
    }
  }

  _showEffect(text, color, score = null) {
    const el = document.createElement('div');
    el.className = 'game-effect';
    el.textContent = score ? `${text} +${score}` : text;
    el.style.cssText = `
      color: ${color};
      font-family: var(--font-display);
      font-size: 2.5rem;
      font-weight: 800;
      letter-spacing: 2px;
      position: fixed;
      top: 38%;
      left: 50%;
      transform: translateX(-50%);
      animation: effectFloat 1.2s forwards;
      pointer-events: none;
      z-index: 999;
      text-shadow: 0 0 20px ${color};
    `;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1200);
  }

  _shakeScreen() {
    const gameArea = document.getElementById('game-area') || document.body;
    gameArea.style.animation = 'screenShake 0.4s ease';
    setTimeout(() => { gameArea.style.animation = ''; }, 400);
  }

  triggerKO() {
    this.isGameOver = true;

    const koScreen = document.getElementById('ko-screen');
    if (!koScreen) return;
    koScreen.style.display = 'flex';

    const total = this.dodgeCount + this.hitCount || 1;

    const el = id => document.getElementById(id);
    if (el('final-score')) el('final-score').textContent = this.score.toLocaleString();
    if (el('final-combo')) el('final-combo').textContent = this.maxCombo;
    if (el('final-accuracy')) el('final-accuracy').textContent = Math.round(this.dodgeCount / total * 100) + '%';
    if (el('final-dodges')) el('final-dodges').textContent = this.dodgeCount;
    if (el('final-hits')) el('final-hits').textContent = this.hitCount;
  }

  reset() {
    this.playerHP = 100;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.dodgeCount = 0;
    this.hitCount = 0;
    this.isGameOver = false;
    this.sessionId = null;
    this.lastRoundResult = null;
    this.renderUI();
  }
}

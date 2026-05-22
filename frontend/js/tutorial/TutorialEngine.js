const TutorialEngine = (() => {
  const DEFAULT_MODE = 'stance';
  const MODE_ALIASES = {
    stance: 'stance',
    jab: 'jab',
    straight: 'straight',
    hook: 'hook',
    ducking: 'ducking',
    combo: 'combo'
  };

  const PROFILE_MAP = {
    stance: {
      title: 'Stance',
      priority: ['stance', 'guard', 'balance', 'chinTuck', 'elbowIn', 'core'],
      weights: { stance: 0.24, guard: 0.22, balance: 0.18, chinTuck: 0.12, elbowIn: 0.12, core: 0.12 },
      labels: {
        guard: 'Guard height',
        stance: 'Foot position',
        balance: 'Weight balance',
        chinTuck: 'Chin position',
        elbowIn: 'Elbow tuck',
        core: 'Body angle'
      }
    },
    jab: {
      title: 'Jab',
      priority: ['recovery', 'guard', 'stance', 'balance', 'chinTuck', 'elbowIn'],
      weights: { recovery: 0.24, guard: 0.22, stance: 0.16, balance: 0.14, chinTuck: 0.12, elbowIn: 0.12 },
      labels: {
        recovery: 'Guard recovery',
        guard: 'Rear hand guard',
        stance: 'Front foot base',
        balance: 'Center line',
        chinTuck: 'Chin cover',
        elbowIn: 'Punch path'
      }
    },
    straight: {
      title: 'Straight',
      priority: ['rotation', 'stance', 'balance', 'guard', 'chinTuck', 'core'],
      weights: { rotation: 0.24, stance: 0.18, balance: 0.16, guard: 0.16, chinTuck: 0.12, core: 0.14 },
      labels: {
        rotation: 'Rotation power',
        stance: 'Pivot base',
        balance: 'Weight transfer',
        guard: 'Lead hand guard',
        chinTuck: 'Eyes and chin',
        core: 'Core line'
      }
    },
    hook: {
      title: 'Hook',
      priority: ['hookLine', 'rotation', 'guard', 'balance', 'elbowIn', 'core'],
      weights: { hookLine: 0.24, rotation: 0.18, guard: 0.16, balance: 0.16, elbowIn: 0.14, core: 0.12 },
      labels: {
        hookLine: 'Horizontal line',
        rotation: 'Short rotation',
        guard: 'Off hand guard',
        balance: 'Axis control',
        elbowIn: 'Arm angle',
        core: 'Torso link'
      }
    },
    ducking: {
      title: 'Ducking',
      priority: ['duckLevel', 'headMovement', 'guard', 'balance', 'stance', 'core'],
      weights: { duckLevel: 0.24, headMovement: 0.20, guard: 0.18, balance: 0.14, stance: 0.12, core: 0.12 },
      labels: {
        duckLevel: 'Lowered level',
        headMovement: 'Head path',
        guard: 'Guard while evading',
        balance: 'Return balance',
        stance: 'Base stability',
        core: 'Knees over waist'
      }
    },
    combo: {
      title: 'Combo',
      priority: ['comboFlow', 'recovery', 'guard', 'balance', 'stance', 'headMovement'],
      weights: { comboFlow: 0.26, recovery: 0.18, guard: 0.18, balance: 0.14, stance: 0.12, headMovement: 0.12 },
      labels: {
        comboFlow: 'Combo flow',
        recovery: 'Guard return',
        guard: 'Active guard',
        balance: 'Balance reset',
        stance: 'Foot control',
        headMovement: 'Reaction move'
      }
    }
  };

  const state = {
    leadSide: 'left',
    lastTimestamp: 0,
    baseline: null,
    lastMetrics: null,
    jabPhase: 'idle',
    jabExtendedAt: 0,
    comboEvents: [],
    headTravel: 0
  };

  function clamp(value, min = 0, max = 1) {
    return Math.min(Math.max(value, min), max);
  }

  function distance(a, b) {
    if (!a || !b) return 0;
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function averageX(...points) {
    const valid = points.filter(Boolean);
    if (!valid.length) return 0;
    return valid.reduce((sum, point) => sum + point.x, 0) / valid.length;
  }

  function averageY(...points) {
    const valid = points.filter(Boolean);
    if (!valid.length) return 0;
    return valid.reduce((sum, point) => sum + point.y, 0) / valid.length;
  }

  function angleDeg(a, b, c) {
    if (!a || !b || !c) return 180;
    const abx = a.x - b.x;
    const aby = a.y - b.y;
    const cbx = c.x - b.x;
    const cby = c.y - b.y;
    const dot = abx * cbx + aby * cby;
    const mag = Math.hypot(abx, aby) * Math.hypot(cbx, cby);
    if (!mag) return 180;
    return Math.acos(clamp(dot / mag, -1, 1)) * (180 / Math.PI);
  }

  function normalizeMode(mode) {
    if (!mode) return DEFAULT_MODE;
    return MODE_ALIASES[mode] || DEFAULT_MODE;
  }

  function getProfile(mode = DEFAULT_MODE) {
    return PROFILE_MAP[normalizeMode(mode)];
  }

  function inferLeadSide(lm) {
    if (!lm[15] || !lm[16] || !lm[11] || !lm[12]) return state.leadSide;
    const leftReach = Math.abs(lm[15].x - lm[11].x);
    const rightReach = Math.abs(lm[16].x - lm[12].x);
    return leftReach >= rightReach ? 'left' : 'right';
  }

  function getMetricSnapshot(lm) {
    const shoulderWidth = Math.max(distance(lm[11], lm[12]), 0.001);
    const hipWidth = Math.max(distance(lm[23], lm[24]), 0.001);
    const footWidth = Math.abs((lm[27]?.x ?? 0) - (lm[28]?.x ?? 0));
    const leadSide = inferLeadSide(lm);
    const rearSide = leadSide === 'left' ? 'right' : 'left';

    const leadShoulder = leadSide === 'left' ? lm[11] : lm[12];
    const rearShoulder = rearSide === 'left' ? lm[11] : lm[12];
    const leadElbow = leadSide === 'left' ? lm[13] : lm[14];
    const rearElbow = rearSide === 'left' ? lm[13] : lm[14];
    const leadWrist = leadSide === 'left' ? lm[15] : lm[16];
    const rearWrist = rearSide === 'left' ? lm[15] : lm[16];
    const leadHip = leadSide === 'left' ? lm[23] : lm[24];
    const rearHip = rearSide === 'left' ? lm[23] : lm[24];
    const leadKnee = leadSide === 'left' ? lm[25] : lm[26];
    const rearKnee = rearSide === 'left' ? lm[25] : lm[26];
    const leadAnkle = leadSide === 'left' ? lm[27] : lm[28];
    const rearAnkle = rearSide === 'left' ? lm[27] : lm[28];

    const shoulderCenterX = averageX(lm[11], lm[12]);
    const hipCenterX = averageX(lm[23], lm[24]);
    const footCenterX = averageX(lm[27], lm[28]);
    const shoulderCenterY = averageY(lm[11], lm[12]);

    const leadExtension = distance(leadShoulder, leadWrist) / shoulderWidth;
    const leadGuardGap = distance(leadWrist, leadShoulder) / shoulderWidth;
    const rearGuardGap = distance(rearWrist, rearShoulder) / shoulderWidth;
    const headOffset = Math.abs((lm[0]?.x ?? shoulderCenterX) - shoulderCenterX) / shoulderWidth;
    const duckDepth = Math.max(0, ((lm[0]?.y ?? shoulderCenterY) - shoulderCenterY) / shoulderWidth);
    const rearHeelLift = rearAnkle && rearKnee ? clamp((rearAnkle.y - rearKnee.y) * 3 + 0.5, 0, 1) : 0.5;
    const shoulderTilt = Math.abs((lm[11]?.y ?? 0) - (lm[12]?.y ?? 0)) / shoulderWidth;
    const hookAngle = angleDeg(leadShoulder, leadElbow, leadWrist);
    const rearHookAngle = angleDeg(rearShoulder, rearElbow, rearWrist);
    const hookLineDiff = shoulderWidth ? Math.min(
      Math.abs((leadElbow?.y ?? 0) - (leadShoulder?.y ?? 0)),
      Math.abs((rearElbow?.y ?? 0) - (rearShoulder?.y ?? 0))
    ) / shoulderWidth : 1;
    const hipRotation = Math.abs((leadHip?.x ?? 0) - (rearHip?.x ?? 0)) / hipWidth;
    const shoulderRotation = Math.abs((leadShoulder?.x ?? 0) - (rearShoulder?.x ?? 0)) / shoulderWidth;
    const leadKneeAngle = angleDeg(leadHip, leadKnee, leadAnkle);
    const rearKneeAngle = angleDeg(rearHip, rearKnee, rearAnkle);
    const kneeFlex = ((180 - leadKneeAngle) + (180 - rearKneeAngle)) / 2;

    return {
      shoulderWidth,
      footWidthRatio: footWidth / shoulderWidth,
      shoulderCenterX,
      shoulderCenterY,
      footCenterX,
      leadSide,
      leadShoulder,
      rearShoulder,
      leadElbow,
      rearElbow,
      leadWrist,
      rearWrist,
      leadHip,
      rearHip,
      leadKnee,
      rearKnee,
      leadAnkle,
      rearAnkle,
      leadExtension,
      leadGuardGap,
      rearGuardGap,
      headOffset,
      duckDepth,
      rearHeelLift,
      shoulderTilt,
      hookAngle,
      rearHookAngle,
      hookLineDiff,
      hipRotation,
      shoulderRotation,
      kneeFlex
    };
  }

  function getOrCreateBaseline(metrics) {
    if (!state.baseline) {
      state.baseline = {
        centerX: metrics.shoulderCenterX,
        shoulderY: metrics.shoulderCenterY,
        leadGuardGap: metrics.leadGuardGap
      };
    }
    return state.baseline;
  }

  function buildResult(score, okThreshold, goodMessage, adjustMessage, severity) {
    return {
      ok: score >= okThreshold,
      score: clamp(score),
      message: score >= okThreshold ? goodMessage : adjustMessage,
      severity
    };
  }

  function checkGuard(metrics, mode) {
    if (!metrics.leadWrist || !metrics.rearWrist) {
      return buildResult(0, 0.72, 'Guard visible.', 'Keep both hands inside the camera frame.', 'high');
    }
    const guardHeightScore = clamp(1 - (((metrics.leadWrist.y + metrics.rearWrist.y) / 2) - (metrics.shoulderCenterY - 0.05)) * 3.2);
    const rearHandProtection = clamp(1 - Math.max(0, metrics.rearWrist.y - (metrics.rearShoulder?.y ?? 0)) * 4.5);
    const score = mode === 'jab' || mode === 'straight'
      ? clamp(guardHeightScore * 0.45 + rearHandProtection * 0.55)
      : guardHeightScore;
    return buildResult(
      score,
      0.72,
      'Guard is protecting your face well.',
      mode === 'jab' || mode === 'straight'
        ? 'Keep the rear hand close to the chin while punching.'
        : 'Lift both hands closer to eye level.',
      'high'
    );
  }

  function checkStance(metrics, mode) {
    const targetMin = mode === 'hook' ? 0.78 : 0.9;
    const targetMax = mode === 'straight' ? 1.55 : 1.7;
    const widthScore = clamp(1 - Math.abs(metrics.footWidthRatio - 1.08) / 0.52);
    const heelScore = mode === 'stance' || mode === 'jab' || mode === 'straight'
      ? clamp(0.45 + metrics.rearHeelLift * 0.55)
      : 1;
    const score = clamp(widthScore * 0.75 + heelScore * 0.25);
    const message = metrics.footWidthRatio < targetMin
      ? 'Widen the base slightly for a more stable stance.'
      : 'Bring the feet back toward the base stance width.';
    return buildResult(
      score,
      0.68,
      mode === 'straight' ? 'Stable base for pivot and transfer.' : 'Foot width and base look stable.',
      message,
      'medium'
    );
  }

  function checkBalance(metrics, mode) {
    const diff = Math.abs(metrics.shoulderCenterX - metrics.footCenterX) / metrics.shoulderWidth;
    const score = clamp(1 - diff / 0.4);
    return buildResult(
      score,
      0.72,
      mode === 'combo' ? 'Balance stays alive through the sequence.' : 'Weight stays centered over the base.',
      mode === 'straight'
        ? 'Do not let the chest fall forward during the weight transfer.'
        : 'Bring the body center back between both feet.',
      'medium'
    );
  }

  function checkChinTuck(metrics, mode) {
    const score = clamp(1 - metrics.headOffset / 0.38);
    return buildResult(
      score,
      0.7,
      'Chin is well protected.',
      mode === 'ducking'
        ? 'Keep the eyes forward and hide the chin while moving.'
        : 'Tuck the chin a little more behind the shoulder.',
      'low'
    );
  }

  function checkElbowIn(metrics, mode) {
    const leadGap = Math.abs((metrics.leadElbow?.x ?? 0) - (metrics.leadHip?.x ?? 0)) / metrics.shoulderWidth;
    const rearGap = Math.abs((metrics.rearElbow?.x ?? 0) - (metrics.rearHip?.x ?? 0)) / metrics.shoulderWidth;
    const angleTarget = mode === 'hook'
      ? Math.min(
          clamp(1 - Math.abs(metrics.hookAngle - 90) / 55),
          clamp(1 - Math.abs(metrics.rearHookAngle - 90) / 55)
        )
      : 1;
    const score = clamp((1 - ((leadGap + rearGap) / 2) / 0.55) * 0.7 + angleTarget * 0.3);
    return buildResult(
      score,
      0.68,
      mode === 'hook' ? 'Arm angle and elbow path are compact.' : 'Elbows are staying close to the body.',
      mode === 'hook'
        ? 'Keep the elbow near ninety degrees and rotate in a compact arc.'
        : 'Pull the elbows a bit closer to the rib line.',
      'medium'
    );
  }

  function checkCore(metrics, mode) {
    const torsoAlignment = clamp(1 - Math.abs(metrics.shoulderCenterX - metrics.footCenterX) / metrics.shoulderWidth / 0.5);
    const shoulderTiltScore = clamp(1 - metrics.shoulderTilt / 0.3);
    const score = clamp(torsoAlignment * 0.7 + shoulderTiltScore * 0.3);
    return buildResult(
      score,
      0.7,
      mode === 'straight' ? 'Shoulders and hips stay linked.' : 'Torso shape is staying organized.',
      mode === 'ducking'
        ? 'Lower with the knees rather than folding from the waist.'
        : 'Brace the core and keep the upper body angle clean.',
      'low'
    );
  }

  function checkRotation(metrics) {
    const raw = clamp((metrics.hipRotation * 0.5) + (metrics.shoulderRotation * 0.5));
    const score = clamp((raw - 0.35) / 0.45);
    return buildResult(
      score,
      0.68,
      'Shoulder and hip rotation are driving the punch.',
      'Add more pivot and hip turn to create power.',
      'high'
    );
  }

  function checkHookLine(metrics) {
    const lineScore = clamp(1 - metrics.hookLineDiff / 0.18);
    const angleScore = clamp(1 - Math.abs(metrics.hookAngle - 90) / 55);
    const score = clamp(lineScore * 0.55 + angleScore * 0.45);
    return buildResult(
      score,
      0.68,
      'Shoulder, elbow, and fist stay on a clean line.',
      'Keep the hook flatter and closer to shoulder height.',
      'high'
    );
  }

  function checkDuckLevel(metrics) {
    const baseline = getOrCreateBaseline(metrics);
    const relativeDrop = clamp(((metrics.duckDepth + (metrics.shoulderCenterY - baseline.shoulderY)) + 0.12) / 0.32);
    const kneeScore = clamp((metrics.kneeFlex - 8) / 42);
    const score = clamp(relativeDrop * 0.6 + kneeScore * 0.4);
    return buildResult(
      score,
      0.65,
      'Level change is coming from the legs.',
      'Bend the knees more and drop the level without folding forward.',
      'high'
    );
  }

  function checkHeadMovement(metrics) {
    const baseline = getOrCreateBaseline(metrics);
    const lateral = Math.abs(metrics.shoulderCenterX - baseline.centerX) / metrics.shoulderWidth;
    const activityBoost = clamp(state.headTravel / 0.45);
    const score = clamp(lateral * 0.55 + activityBoost * 0.45);
    return buildResult(
      score,
      0.58,
      'Head movement is clearly visible.',
      'Move the head farther off the center line.',
      'medium'
    );
  }

  function checkRecovery(metrics) {
    const guardReturn = clamp(1 - (metrics.leadGuardGap - 0.7) / 0.9);
    let speedScore = 0.45;
    if (state.jabPhase === 'recovered' && state.jabExtendedAt) {
      const elapsed = Math.max(1, state.lastTimestamp - state.jabExtendedAt);
      speedScore = clamp(1 - (elapsed - 220) / 900);
    }
    const score = clamp(guardReturn * 0.55 + speedScore * 0.45);
    return buildResult(
      score,
      0.66,
      'Hand is returning to guard quickly.',
      'Bring the punching hand back to the guard faster.',
      'high'
    );
  }

  function checkComboFlow(metrics) {
    const recentEvents = state.comboEvents.filter(event => state.lastTimestamp - event.at < 1800);
    const frequencyScore = clamp(recentEvents.length / 4);
    const movementScore = clamp((state.headTravel + Math.abs(metrics.leadExtension - (state.lastMetrics?.leadExtension ?? metrics.leadExtension))) / 0.55);
    const score = clamp(frequencyScore * 0.55 + movementScore * 0.45);
    return buildResult(
      score,
      0.58,
      'The sequence is flowing without long pauses.',
      'Reduce the pause between moves and reconnect the guard faster.',
      'high'
    );
  }

  function updateTemporalState(metrics) {
    const now = Date.now();
    if (!state.lastTimestamp) {
      state.lastTimestamp = now;
    }

    const previous = state.lastMetrics;
    if (previous) {
      state.headTravel = clamp(
        state.headTravel * 0.85 + Math.abs(metrics.shoulderCenterX - previous.shoulderCenterX) / metrics.shoulderWidth,
        0,
        1
      );

      const extensionDelta = metrics.leadExtension - previous.leadExtension;
      if (metrics.leadExtension > 1.18 && extensionDelta > 0.035) {
        state.jabPhase = 'extended';
        state.jabExtendedAt = now;
        state.comboEvents.push({ at: now, type: 'extension' });
      } else if (state.jabPhase === 'extended' && metrics.leadGuardGap < 0.88) {
        state.jabPhase = 'recovered';
        state.comboEvents.push({ at: now, type: 'recovery' });
      } else if (metrics.leadExtension < 0.92) {
        state.jabPhase = 'idle';
      }

      if (Math.abs(metrics.shoulderCenterX - previous.shoulderCenterX) / metrics.shoulderWidth > 0.08) {
        state.comboEvents.push({ at: now, type: 'slip' });
      }
    }

    state.comboEvents = state.comboEvents.filter(event => now - event.at < 2500);
    state.leadSide = metrics.leadSide;
    state.lastMetrics = metrics;
    state.lastTimestamp = now;
  }

  function buildChecks(metrics, mode) {
    const generic = {
      guard: checkGuard(metrics, mode),
      stance: checkStance(metrics, mode),
      balance: checkBalance(metrics, mode),
      chinTuck: checkChinTuck(metrics, mode),
      elbowIn: checkElbowIn(metrics, mode),
      core: checkCore(metrics, mode),
      rotation: checkRotation(metrics),
      hookLine: checkHookLine(metrics),
      duckLevel: checkDuckLevel(metrics),
      headMovement: checkHeadMovement(metrics),
      recovery: checkRecovery(metrics),
      comboFlow: checkComboFlow(metrics)
    };

    const profile = getProfile(mode);
    return profile.priority.reduce((accumulator, key) => {
      accumulator[key] = generic[key];
      return accumulator;
    }, {});
  }

  function calcAccuracy(checks, mode = DEFAULT_MODE) {
    const profile = getProfile(mode);
    return Object.entries(checks).reduce((sum, [key, value]) => {
      return sum + (value?.score || 0) * (profile.weights[key] || 0);
    }, 0);
  }

  function generateFeedback(checks, mode = DEFAULT_MODE) {
    const profile = getProfile(mode);
    for (const key of profile.priority) {
      const item = checks[key];
      if (item && !item.ok) {
        return item.message;
      }
    }
    return `${profile.title} alignment looks stable. Hold for 3 seconds.`;
  }

  function drawColoredSkeleton(ctx, lm, checks = {}) {
    if (!ctx || !lm) return;
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;

    function colorFor(check) {
      if (!check) return 'rgba(255,255,255,0.38)';
      if (check.ok) return '#30D158';
      if ((check.score || 0) >= 0.5) return '#FFD60A';
      return '#FF2D55';
    }

    const colors = {
      upper: colorFor(checks.guard || checks.recovery || checks.hookLine),
      middle: colorFor(checks.balance || checks.rotation || checks.core),
      lower: colorFor(checks.stance || checks.duckLevel || checks.headMovement),
      head: colorFor(checks.chinTuck || checks.headMovement)
    };

    const connections = [
      [11, 12, colors.upper],
      [11, 13, colors.upper],
      [13, 15, colors.upper],
      [12, 14, colors.upper],
      [14, 16, colors.upper],
      [11, 23, colors.middle],
      [12, 24, colors.middle],
      [23, 24, colors.middle],
      [23, 25, colors.lower],
      [25, 27, colors.lower],
      [24, 26, colors.lower],
      [26, 28, colors.lower]
    ];

    ctx.save();
    ctx.lineWidth = 3;
    for (const [start, end, color] of connections) {
      const a = lm[start];
      const b = lm[end];
      if (!a || !b) continue;
      if ((a.visibility || 1) < 0.35 || (b.visibility || 1) < 0.35) continue;
      ctx.beginPath();
      ctx.moveTo(a.x * width, a.y * height);
      ctx.lineTo(b.x * width, b.y * height);
      ctx.strokeStyle = color;
      ctx.stroke();
    }

    const pointGroups = {
      0: colors.head,
      11: colors.upper,
      12: colors.upper,
      13: colors.upper,
      14: colors.upper,
      15: colors.upper,
      16: colors.upper,
      23: colors.middle,
      24: colors.middle,
      25: colors.lower,
      26: colors.lower,
      27: colors.lower,
      28: colors.lower
    };

    Object.entries(pointGroups).forEach(([index, color]) => {
      const point = lm[Number(index)];
      if (!point || (point.visibility || 1) < 0.35) return;
      ctx.beginPath();
      ctx.arc(point.x * width, point.y * height, Number(index) === 0 ? 7 : 5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });
    ctx.restore();
  }

  function analyze(lm, options = {}) {
    const mode = normalizeMode(options.mode);
    const metrics = getMetricSnapshot(lm);
    getOrCreateBaseline(metrics);
    updateTemporalState(metrics);
    const checks = buildChecks(metrics, mode);
    const accuracy = calcAccuracy(checks, mode);
    const feedback = generateFeedback(checks, mode);
    return {
      mode,
      checks,
      accuracy,
      feedback,
      profile: getProfile(mode)
    };
  }

  function reset(mode = DEFAULT_MODE) {
    normalizeMode(mode);
    state.leadSide = 'left';
    state.lastTimestamp = 0;
    state.baseline = null;
    state.lastMetrics = null;
    state.jabPhase = 'idle';
    state.jabExtendedAt = 0;
    state.comboEvents = [];
    state.headTravel = 0;
  }

  return {
    analyze,
    drawColoredSkeleton,
    calcAccuracy,
    generateFeedback,
    getProfile,
    reset
  };
})();

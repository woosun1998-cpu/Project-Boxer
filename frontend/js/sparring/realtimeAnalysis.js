/**
 * 플레이/분석 MVP — 지표·기준선·실시간 유사도(룰 기반)·피드백 템플릿
 * 문서: 정리/07_프로젝트계획/Boxer_플레이_분석탭_구현순서서.md
 */
(function (global) {
  const METRICS_VERSION = 1;

  /** 최종 점수 가중치 (고정): overall = 0.5*pose + 0.3*timing + 0.2*stability */
  const SCORE_WEIGHTS = Object.freeze({
    pose: 0.5,
    timing: 0.3,
    stability: 0.2,
  });

  /**
   * 프로필별 타이밍 기준 (ms). 초급은 허용 폭 넓게, 프로는 좁게.
   */
  const PROFILE_BASELINES = Object.freeze({
    beginner: {
      timingIdealMs: 340,
      timingSigmaMs: 220,
      hitTimingFloor: 22,
      stabilityGuardBonus: 26,
      stabilityDisplacementBonus: 18,
    },
    intermediate: {
      timingIdealMs: 300,
      timingSigmaMs: 180,
      hitTimingFloor: 28,
      stabilityGuardBonus: 24,
      stabilityDisplacementBonus: 20,
    },
    advanced: {
      timingIdealMs: 260,
      timingSigmaMs: 140,
      hitTimingFloor: 32,
      stabilityGuardBonus: 22,
      stabilityDisplacementBonus: 22,
    },
    pro: {
      timingIdealMs: 220,
      timingSigmaMs: 110,
      hitTimingFloor: 38,
      stabilityGuardBonus: 20,
      stabilityDisplacementBonus: 24,
    },
  });

  const POSITIVE_TEMPLATES = Object.freeze([
    {
      id: "pos-pose-strong",
      text: "자세·가드 응답이 목표 범위 안에서 잘 유지되었습니다. 이 리듬을 다음 라운드에도 이어가 보세요.",
    },
    {
      id: "pos-timing-strong",
      text: "공격 타이밍에 대한 반응이 안정적입니다. 한 박자 빠른 초기 움직임을 유지해 보세요.",
    },
    {
      id: "pos-stability-strong",
      text: "큰 흔들림 없이 플레이했습니다. 실전에서는 이 안정감으로 거리만 조금씩 좁혀 가면 됩니다.",
    },
  ]);

  const IMPROVE_TEMPLATES = Object.freeze([
    {
      id: "imp-timing-dodge",
      text: "공격이 보인 직후 0.2초 안쪽으로 회피 동작이 들어가도록, 짧고 확실한 스텝을 반복해 보세요.",
    },
    {
      id: "imp-pose-guard",
      text: "가드 높이와 어깨 라인을 일정하게 유지하는 연습(미러 또는 슬로우 모션)을 권장합니다.",
    },
    {
      id: "imp-stability-reset",
      text: "회피 후 바로 원 포지션으로 복귀하는 리셋을 의식하면 안정성 점수가 함께 오릅니다.",
    },
  ]);

  const NEXT_TRAINING = Object.freeze({
    timing: "다음 훈련: 메트로놈·박자 음에 맞춰 ‘보이는 순간’ 발을 먼저 뺀 뒤 상체를 따라가는 스텝만 3세트.",
    pose: "다음 훈련: 잽 incoming만 보고 슬립/덕 중 한 가지로만 응답하는 단일 패턴 반복 5분.",
    stability: "다음 훈련: 라인 위에서 좌우 슬립 후 정면으로 복귀 — 발 소리가 나지 않게 가볍게 10회×3.",
    balanced: "다음 훈련: 1라운드는 타이밍만, 다음 라운드는 자세만 의식하는 ‘한 가지 집중’ 스위칭 연습.",
  });

  function normalizeProfile(level) {
    const k = String(level || "intermediate").toLowerCase();
    if (k === "easy") return "beginner";
    if (k === "medium") return "intermediate";
    if (k === "hard") return "advanced";
    return PROFILE_BASELINES[k] ? k : "intermediate";
  }

  function clamp100(n) {
    return Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
  }

  /**
   * 룰 기반 실시간 유사도. 누락 값은 기본값으로 메움. 반환 0~100.
   * @param {object} input
   * @param {string} input.profileLevel beginner|intermediate|advanced|pro
   * @param {number} input.reactionMs
   * @param {string} input.dodgeResult dodge|hit (대소문자 무관)
   * @param {number} [input.accuracyScore] GameEngine accuracy 0-100
   * @param {object} [input.judgeMeta] guardOk, displacementSatisfied, directionMatched
   */
  function computeRealtimeSimilarity(input = {}) {
    const profileLevel = normalizeProfile(input.profileLevel);
    const base = PROFILE_BASELINES[profileLevel];
    const dodge =
      String(input.dodgeResult || "").toUpperCase() === "DODGE" ||
      String(input.dodgeResult || "").toLowerCase() === "dodge";

    const rawAcc = Number(input.accuracyScore);
    const pose_similarity = dodge
      ? clamp100(Number.isFinite(rawAcc) ? rawAcc : 55)
      : clamp100(Number.isFinite(rawAcc) ? rawAcc * 0.35 : 25);

    const reactionMs = Math.max(0, Number(input.reactionMs) || 0);
    let timing_similarity;
    if (dodge) {
      const diff = Math.abs(reactionMs - base.timingIdealMs);
      const sigma = Math.max(80, base.timingSigmaMs);
      timing_similarity = clamp100(100 - (diff / sigma) * 55);
    } else {
      timing_similarity = clamp100(base.hitTimingFloor);
    }

    const jm = input.judgeMeta || {};
    let stability_score = 48;
    if (dodge) {
      stability_score += jm.guardOk ? base.stabilityGuardBonus : 4;
      stability_score += jm.displacementSatisfied ? base.stabilityDisplacementBonus : 6;
      stability_score += jm.directionMatched ? 12 : 0;
    } else {
      stability_score = clamp100(28 + (jm.guardOk ? 12 : 0));
    }
    stability_score = clamp100(stability_score);

    const overall_score = clamp100(
      SCORE_WEIGHTS.pose * pose_similarity +
        SCORE_WEIGHTS.timing * timing_similarity +
        SCORE_WEIGHTS.stability * stability_score
    );

    return {
      pose_similarity,
      timing_similarity,
      stability_score,
      overall_score,
    };
  }

  function buildLogEntry(fields) {
    const metrics = computeRealtimeSimilarity({
      profileLevel: fields.profileLevel,
      reactionMs: fields.reactionMs,
      dodgeResult: fields.dodgeResult,
      accuracyScore: fields.accuracyScore,
      judgeMeta: fields.judgeMeta,
    });

    const dodge_result =
      String(fields.dodgeResult || "").toLowerCase() === "hit" ? "hit" : "dodge";

    return {
      session_id: fields.sessionId ?? null,
      user_id: fields.userId ?? null,
      profile_level: normalizeProfile(fields.profileLevel),
      video_id: fields.videoId ?? null,
      event_time: new Date().toISOString(),
      pose_similarity: metrics.pose_similarity,
      reaction_ms: Math.max(0, Number(fields.reactionMs) || 0),
      dodge_result,
      stability_score: metrics.stability_score,
      timing_similarity: metrics.timing_similarity,
      overall_round_score: metrics.overall_score,
      metrics_version: METRICS_VERSION,
    };
  }

  function mean(arr) {
    if (!arr.length) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  function positiveTpl(key) {
    if (key === "pose") return POSITIVE_TEMPLATES[0];
    if (key === "timing") return POSITIVE_TEMPLATES[1];
    return POSITIVE_TEMPLATES[2];
  }

  function improveTpl(key) {
    if (key === "timing") return IMPROVE_TEMPLATES[0];
    if (key === "pose") return IMPROVE_TEMPLATES[1];
    return IMPROVE_TEMPLATES[2];
  }

  function pickFeedback({ avgPose, avgTiming, avgStability }) {
    const scores = [
      { key: "pose", value: avgPose },
      { key: "timing", value: avgTiming },
      { key: "stability", value: avgStability },
    ];
    const asc = [...scores].sort((a, b) => a.value - b.value);
    const desc = [...scores].sort((a, b) => b.value - a.value);
    const weakest = asc[0];
    const strongest = desc[0];

    const strengths = [];
    const seen = new Set();
    for (let i = 0; i < desc.length && strengths.length < 2; i++) {
      if (desc[i].value < 52) continue;
      const tpl = positiveTpl(desc[i].key);
      if (!seen.has(tpl.id)) {
        strengths.push(tpl);
        seen.add(tpl.id);
      }
    }
    if (!strengths.length) strengths.push(positiveTpl(strongest.key));

    const improvements = [];
    seen.clear();
    for (let i = 0; i < asc.length && improvements.length < 2; i++) {
      if (asc[i].value >= 68) continue;
      const tpl = improveTpl(asc[i].key);
      if (!seen.has(tpl.id)) {
        improvements.push(tpl);
        seen.add(tpl.id);
      }
    }
    if (!improvements.length) improvements.push(improveTpl(weakest.key));

    let next_training = NEXT_TRAINING.balanced;
    if (weakest.key === "timing") next_training = NEXT_TRAINING.timing;
    else if (weakest.key === "pose") next_training = NEXT_TRAINING.pose;
    else if (weakest.key === "stability") next_training = NEXT_TRAINING.stability;

    return {
      strengths,
      improvements,
      next_training,
      highlight: { strongest: strongest.key, weakest: weakest.key },
    };
  }

  function finalizeSession(rounds, profileLevel, sessionMeta = {}) {
    const level = normalizeProfile(profileLevel);
    if (!Array.isArray(rounds) || rounds.length === 0) {
      return {
        profile_level: level,
        rounds: [],
        summary: {
          overall_score: 0,
          pose_similarity: 0,
          timing_similarity: 0,
          stability_score: 0,
          round_count: 0,
          total_score_game: sessionMeta.total_score ?? null,
          dodge_count: sessionMeta.dodge_count ?? 0,
          hit_count: sessionMeta.hit_count ?? 0,
        },
        feedback: {
          strengths: [POSITIVE_TEMPLATES[2]],
          improvements: [IMPROVE_TEMPLATES[1]],
          next_training: NEXT_TRAINING.balanced,
          highlight: { strongest: "stability", weakest: "pose" },
        },
        metrics_version: METRICS_VERSION,
        SCORE_WEIGHTS,
      };
    }

    const avgPose = mean(rounds.map((r) => r.pose_similarity));
    const avgTiming = mean(rounds.map((r) => r.timing_similarity));
    const avgStability = mean(rounds.map((r) => r.stability_score));
    const overall_score = clamp100(
      SCORE_WEIGHTS.pose * avgPose +
        SCORE_WEIGHTS.timing * avgTiming +
        SCORE_WEIGHTS.stability * avgStability
    );

    const feedback = pickFeedback({
      avgPose,
      avgTiming,
      avgStability,
    });

    return {
      profile_level: level,
      rounds,
      summary: {
        overall_score,
        pose_similarity: clamp100(avgPose),
        timing_similarity: clamp100(avgTiming),
        stability_score: clamp100(avgStability),
        round_count: rounds.length,
        total_score_game: sessionMeta.total_score ?? null,
        max_combo: sessionMeta.max_combo ?? null,
        dodge_count: sessionMeta.dodge_count ?? null,
        hit_count: sessionMeta.hit_count ?? null,
      },
      feedback,
      metrics_version: METRICS_VERSION,
      SCORE_WEIGHTS,
    };
  }

  const STORAGE_KEY = "boxer_play_analysis_mvp";

  /**
   * 무엇: 코치/CPU 공격으로 유저가 피격될 때 메인 컨테이너 흔들림 / 왜: 피격 피드백을 시각적으로 즉시 전달
   * @param {HTMLElement|null} rootEl #arena 등
   * @param {{ className?: string, durationMs?: number }} [opts]
   */
  function triggerScreenShake(rootEl, opts) {
    if (!rootEl || !rootEl.classList) return;
    const o = opts || {};
    const cls = o.className || "bx-screen-shake";
    const ms = Math.max(120, Math.min(1200, Number(o.durationMs) || 420));
    rootEl.classList.remove(cls);
    void rootEl.offsetWidth;
    rootEl.classList.add(cls);
    window.setTimeout(() => {
      rootEl.classList.remove(cls);
    }, ms);
  }

  /** 무엇: --hp-gauge-overscale 읽기 비용 줄임 / 왜: HP 갱신마다 getComputedStyle 반복 방지 */
  let _hpGaugeOverReadAt = 0;
  let _hpGaugeOverCached = 1.008;

  function readHpGaugeOverscale() {
    const now = Date.now();
    if (now - _hpGaugeOverReadAt < 500) return _hpGaugeOverCached;
    _hpGaugeOverReadAt = now;
    let over = 1.008;
    try {
      const raw = getComputedStyle(document.documentElement)
        .getPropertyValue("--hp-gauge-overscale")
        .trim();
      const p = parseFloat(raw);
      if (Number.isFinite(p) && p >= 1) over = p;
    } catch (e) {
      /* 문서 없을 때 기본값 */
    }
    _hpGaugeOverCached = over;
    return over;
  }

  /**
   * 무엇: HP 세그먼트 비율(0~1)을 scaleX에 쓸 값으로 / 왜: 1.0이면 클립·서브픽셀로 밑층(노랑)이 비칠 때 살짝 넘쳐 덮음 — :root --hp-gauge-overscale 과 동기
   * @param {number} ratio01
   * @returns {number}
   */
  function resolveHpGaugeScaleX(ratio01) {
    const x = Math.max(0, Math.min(1, Number(ratio01) || 0));
    if (x < 0.999) return x;
    return readHpGaugeOverscale();
  }

  global.BoxerRealtimeAnalysis = {
    METRICS_VERSION,
    SCORE_WEIGHTS,
    PROFILE_BASELINES,
    SESSION_LOG_FIELDS: [
      "session_id",
      "user_id",
      "profile_level",
      "video_id",
      "event_time",
      "pose_similarity",
      "reaction_ms",
      "dodge_result",
      "stability_score",
    ],
    POSITIVE_TEMPLATES,
    IMPROVE_TEMPLATES,
    NEXT_TRAINING,
    normalizeProfile,
    computeRealtimeSimilarity,
    buildLogEntry,
    finalizeSession,
    STORAGE_KEY,
    triggerScreenShake,
    resolveHpGaugeScaleX,
  };
})(typeof window !== "undefined" ? window : globalThis);

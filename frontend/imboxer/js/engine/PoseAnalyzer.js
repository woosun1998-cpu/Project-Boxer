const globalScope = typeof window !== "undefined" ? window : globalThis;

// 1차 더미 자세 분석기
// - 실제 MediaPipe가 없어도 training.js가 점수/정확도/HP/콤보/피드백을 갱신할 수 있게 만든다.
// - 이후 실제 PoseTracker가 들어오면 analyzePoseFrame() 내부만 바꿔도 된다.
const UPDATE_INTERVAL_MS = 1000;
const LANDMARK_INDEX = {
  nose: 0,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
};

const DEFAULT_FEEDBACK = [
  "무릎을 조금 더 굽혀주세요.",
  "양손을 눈높이로 유지하세요.",
];

const BEGINNER_BASIC_GUARD_RULES = {
  posture: {
    good: 78,
    warning: 60,
    leanWeightX: 120,
    leanWeightY: 82,
    chinWeight: 8,
  },
  guard: {
    good: 78,
    warning: 60,
    wristDropWeight: 125,
    elbowFlareWeight: 85,
    faceGapWeight: 95,
    tuckAllowance: 0.1,
  },
  balance: {
    good: 80,
    warning: 62,
    stanceIdeal: 0.22,
    stanceTolerance: 0.1,
    centerShiftWeight: 120,
  },
  reaction: {
    good: 72,
    warning: 58,
  },
  floors: {
    posture: 56,
    guard: 58,
    balance: 52,
    reaction: 56,
  },
};

const JAB_RULES = {
  posture: {
    good: 78,
    warning: 63,
    leanWeightX: 130,
    leanWeightY: 92,
    chinWeight: 11,
  },
  extension: {
    good: 80,
    warning: 65,
    reachTarget: 0.29,
    reachWeight: 200,
    elbowAngleWeight: 0.95,
    wristLiftWeight: 120,
  },
  guard: {
    good: 75,
    warning: 60,
    wristDropWeight: 175,
    elbowFlareWeight: 115,
    faceGapWeight: 135,
    tuckAllowance: 0.08,
  },
  balance: {
    good: 76,
    warning: 60,
    stanceIdeal: 0.23,
    centerShiftWeight: 135,
  },
  reaction: {
    good: 76,
    warning: 62,
  },
};

const CROSS_RULES = {
  posture: {
    good: 78,
    warning: 63,
    leanWeightX: 125,
    leanWeightY: 98,
    chinWeight: 11,
  },
  strike: {
    good: 82,
    warning: 66,
    reachTarget: 0.32,
    reachWeight: 205,
    elbowAngleWeight: 0.95,
    wristLiftWeight: 115,
  },
  rotation: {
    good: 80,
    warning: 64,
    torsoWeight: 190,
    hipWeight: 140,
    shoulderWeight: 125,
  },
  balance: {
    good: 76,
    warning: 60,
    stanceIdeal: 0.23,
    centerShiftWeight: 145,
  },
  reaction: {
    good: 76,
    warning: 62,
  },
};

const LEFT_HOOK_RULES = {
  posture: {
    good: 82,
    warning: 68,
    leanWeightX: 150,
    leanWeightY: 112,
    chinWeight: 13,
  },
  hook: {
    good: 86,
    warning: 72,
    elbowHeightWeight: 210,
    swingWidthWeight: 220,
    elbowAngleWeight: 1.05,
    wristLiftWeight: 145,
  },
  guard: {
    good: 80,
    warning: 65,
    wristDropWeight: 165,
    elbowFlareWeight: 110,
    faceGapWeight: 125,
    tuckAllowance: 0.08,
  },
  balance: {
    good: 80,
    warning: 66,
    stanceIdeal: 0.23,
    centerShiftWeight: 175,
  },
  reaction: {
    good: 82,
    warning: 68,
  },
};

const SLIP_RULES = {
  posture: {
    good: 82,
    warning: 68,
    leanWeightX: 145,
    leanWeightY: 125,
    chinWeight: 16,
  },
  evade: {
    good: 86,
    warning: 72,
    headShiftWeight: 280,
    torsoShiftWeight: 170,
    neckSafetyWeight: 150,
  },
  guard: {
    good: 80,
    warning: 65,
    wristDropWeight: 200,
    elbowFlareWeight: 130,
    faceGapWeight: 160,
    tuckAllowance: 0.08,
  },
  balance: {
    good: 82,
    warning: 68,
    stanceIdeal: 0.22,
    centerShiftWeight: 185,
    kneeWeight: 100,
  },
  reaction: {
    good: 82,
    warning: 68,
  },
};

const LESSON_PROFILES = {
  "beginner-basic-guard": {
    title: "초보 기본 가드",
    goal: "손을 얼굴 가까이에 두고 안정적으로 서는 기본 가드를 먼저 익혀보세요.",
    coachMessages: [
      "손을 먼저 얼굴 가까이 올려 기본 가드를 만들어보세요.",
      "초보 기본 가드는 손 높이와 발 간격이 가장 중요합니다.",
      "어깨 힘을 빼고 중심을 편안하게 유지하세요.",
      "지금은 디테일보다는 안정적으로 서는 것이 먼저입니다.",
    ],
    feedbackItems: [
      "양손을 얼굴 가까이 올려주세요.",
      "발 간격을 어깨너비 근처로 맞춰주세요.",
      "무릎을 아주 조금만 굽혀 중심을 안정적으로 잡아주세요.",
      "정면을 보며 기본 가드를 편하게 유지하세요.",
    ],
  },
  jab: {
    title: "잽",
    goal: "앞손을 빠르게 뻗고 바로 가드로 복귀하세요.",
    coachMessages: [
      "잽은 속도와 복귀가 핵심입니다.",
      "앞손만 빠르게 뻗고 즉시 돌아오세요.",
      "어깨가 과하게 열리지 않게 주의하세요.",
    ],
    feedbackItems: [
      "앞손이 너무 멀리 열리지 않게 해주세요.",
      "손목은 곧게 두고 복귀 속도를 더 빠르게 맞춰보세요.",
      "잽 후 가드를 즉시 회복하세요.",
    ],
  },
  cross: {
    title: "크로스",
    goal: "뒷손의 회전과 체중 이동을 안정적으로 맞춰보세요.",
    coachMessages: [
      "뒷발과 골반의 회전을 함께 맞춰보세요.",
      "크로스는 몸통 회전이 먼저입니다.",
      "가드가 너무 열리지 않도록 주의하세요.",
    ],
    feedbackItems: [
      "뒷발을 살짝 밀어 체중을 실어주세요.",
      "어깨와 골반 회전을 함께 사용하세요.",
      "타격 후 바로 중심을 복귀하세요.",
    ],
  },
  "left-hook": {
    title: "왼훅",
    goal: "팔꿈치 높이와 회전 반경을 작게 유지하세요.",
    coachMessages: [
      "왼훅은 짧고 강하게 붙여주세요.",
      "팔꿈치를 너무 크게 벌리지 마세요.",
      "상체 회전과 가드 회복을 함께 신경 써주세요.",
    ],
    feedbackItems: [
      "팔꿈치를 어깨 높이 근처에 유지하세요.",
      "회전 반경을 작게 가져가세요.",
      "훅 후 손을 빠르게 복귀시키세요.",
    ],
  },
  slip: {
    title: "슬립",
    goal: "머리를 크게 빼지 말고 짧게 피하면서 균형을 유지하세요.",
    coachMessages: [
      "슬립은 작고 빠른 움직임이 중요합니다.",
      "상체를 너무 많이 숙이지 말고 짧게 피하세요.",
      "균형을 잃지 않게 무게중심을 낮게 유지하세요.",
    ],
    feedbackItems: [
      "고개만 짧게 빼고 몸은 안정적으로 유지하세요.",
      "무릎을 약간 더 굽혀 균형을 잡아주세요.",
      "슬립 후 바로 원래 자세로 복귀하세요.",
    ],
  },
  uppercut: {
    title: "어퍼컷",
    goal: "무릎 반동과 짧은 상향 타격을 연결해보세요.",
    coachMessages: [
      "어퍼컷은 아래에서 위로 짧게 연결하는 타격입니다.",
      "무릎 반동과 상향 궤적을 함께 써보세요.",
      "팔을 크게 휘두르지 말고 몸 가까이에서 올리세요.",
    ],
    feedbackItems: [
      "무릎을 조금 굽혀 아래에서 위로 밀어 올리세요.",
      "팔꿈치를 몸 가까이에 두고 주먹 궤적을 짧게 유지하세요.",
      "타격 후에는 가드와 중심을 빠르게 회복하세요.",
    ],
  },
};

const state = {
  running: false,
  paused: false,
  sequence: 0,
  tickCount: 0,
  deliveredSequence: 0,
  currentMetrics: null,
  updateListeners: new Set(),
  feedbackListeners: new Set(),
  startedAt: 0,
  lastUpdateAt: 0,
  lastInvocationAt: 0,
  lessonKey: "beginner-basic-guard",
  lastPoseLandmarks: null,
  lastPoseAt: 0,
  recentFeatureSnapshots: [],
};

const ACTION_HISTORY_LIMIT = 5;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function smoothTowards(current, target, ratio, min, max) {
  const safeCurrent = Number.isFinite(current) ? current : 0;
  const safeTarget = Number.isFinite(target) ? target : safeCurrent;
  const safeRatio = clamp(Number.isFinite(ratio) ? ratio : 0.3, 0, 1);
  return clamp(Math.round(safeCurrent * (1 - safeRatio) + safeTarget * safeRatio), min, max);
}

function cloneArray(items) {
  return Array.isArray(items) ? items.slice() : [];
}

function getMonotonicNow() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }

  return Date.now();
}

function normalizeLessonKey(value) {
  const key = String(value || "").trim();
  if (key === "basic-guard" || key === "real-fight-guard") {
    return "beginner-basic-guard";
  }
  return LESSON_PROFILES[key] ? key : "beginner-basic-guard";
}

function getLessonProfile(value) {
  return LESSON_PROFILES[normalizeLessonKey(value)] || LESSON_PROFILES["beginner-basic-guard"];
}

function isBasicGuardFamily(lessonKey) {
  return lessonKey === "beginner-basic-guard";
}

function getBasicGuardRulesForLesson(lessonKey) {
  return BEGINNER_BASIC_GUARD_RULES;
}

function getProfileText(items, index, fallback) {
  if (!Array.isArray(items) || items.length === 0) {
    return fallback;
  }

  const entry = items[index] ?? items[items.length - 1] ?? fallback;
  return typeof entry === "string" && entry.trim() ? entry : fallback;
}

function getThresholdManager() {
  const manager = globalScope.IM_BOXER_THRESHOLD_MANAGER;
  if (manager && typeof manager.getThresholds === "function") {
    return manager;
  }

  return null;
}

function getLessonThresholds(lessonKey) {
  const manager = getThresholdManager();
  if (!manager) {
    return {};
  }

  try {
    const thresholds = manager.getThresholds(normalizeLessonKey(lessonKey));
    return thresholds && typeof thresholds === "object" ? { ...thresholds } : {};
  } catch (error) {
    console.warn("PoseAnalyzer threshold lookup failed:", error);
    return {};
  }
}

function clonePlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return { ...value };
}

function clonePoseLandmarks(source) {
  if (Array.isArray(source)) {
    return source.map((item) => (isLikelyPoint(item) ? normalizePoint(item) : item));
  }

  if (source && typeof source === "object") {
    return Object.keys(source).reduce((accumulator, key) => {
      const value = source[key];
      accumulator[key] = isLikelyPoint(value) ? normalizePoint(value) : value;
      return accumulator;
    }, {});
  }

  return null;
}

function distance2D(a, b) {
  if (!a || !b) {
    return 0;
  }

  return Math.hypot(a.x - b.x, a.y - b.y);
}

function lineAngleDegrees(a, b) {
  if (!a || !b) {
    return 0;
  }

  const rawAngle = Math.abs((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI);
  const foldedAngle = rawAngle > 180 ? rawAngle % 180 : rawAngle;
  return foldedAngle > 90 ? 180 - foldedAngle : foldedAngle;
}

function normalizeRatio(value, scale = 1) {
  if (!Number.isFinite(value) || !Number.isFinite(scale) || scale === 0) {
    return 0;
  }

  return value / scale;
}

function createThresholdCheck(key, matched, actual, expectation, message) {
  return {
    key,
    matched: Boolean(matched),
    actual: Number.isFinite(actual) ? actual : null,
    expectation,
    message,
  };
}

function finalizeLessonAccuracy(rawAccuracy, thresholdSummary, minScore = 50) {
  const quality = toNumber(thresholdSummary?.quality, 0);
  if (thresholdSummary?.canPass && quality >= 0.98) {
    return 100;
  }
  return clamp(Math.round(rawAccuracy), minScore, 99);
}

function finalizeLessonScore(rawScore, thresholdSummary) {
  const quality = toNumber(thresholdSummary?.quality, 0);
  if (thresholdSummary?.canPass && quality >= 0.98) {
    return 1000;
  }
  return clamp(Math.round(rawScore), 0, 1000);
}

function getPointVisibility(point) {
  if (!point || typeof point.visibility !== "number") {
    return 1;
  }
  return clamp(point.visibility, 0, 1);
}

function getVisibilityRelaxFactor(points, minFactor = 0.35) {
  const values = points
    .map((point) => getPointVisibility(point))
    .filter((value) => Number.isFinite(value));

  if (values.length === 0) {
    return 1;
  }

  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  return clamp(average, minFactor, 1);
}

function buildThresholdChecks(lessonKey, featureValues, thresholds) {
  const checks = [];
  const pushCheck = (key, matched, actual, expectation, message) => {
    checks.push(createThresholdCheck(key, matched, actual, expectation, message));
  };

  if (isBasicGuardFamily(lessonKey)) {
    pushCheck(
      "leftHandUp",
      featureValues.leftGuardGap <= thresholds.guardWristToFaceMax,
      featureValues.leftGuardGap,
      `<= ${thresholds.guardWristToFaceMax}`,
      "왼손을 얼굴 가까이 올려주세요.",
    );
    pushCheck(
      "rightHandUp",
      featureValues.rightGuardGap <= thresholds.guardWristToFaceMax,
      featureValues.rightGuardGap,
      `<= ${thresholds.guardWristToFaceMax}`,
      "오른손을 얼굴 가까이 올려주세요.",
    );
    pushCheck(
      "guardWristToFaceMax",
      featureValues.guardWristToFace <= thresholds.guardWristToFaceMax,
      featureValues.guardWristToFace,
      `<= ${thresholds.guardWristToFaceMax}`,
      "양손을 광대 라인 가까이 올려서 가드를 더 높게 유지하세요.",
    );
    pushCheck(
      "shoulderLevelDiffMax",
      featureValues.shoulderLevelDiff <= thresholds.shoulderLevelDiffMax,
      featureValues.shoulderLevelDiff,
      `<= ${thresholds.shoulderLevelDiffMax}`,
      "어깨 높이를 맞춰 상체가 한쪽으로 기울지 않게 서보세요.",
    );
    pushCheck(
      "kneeAngleRange",
      featureValues.kneeAngle >= thresholds.kneeAngleMin && featureValues.kneeAngle <= thresholds.kneeAngleMax,
      featureValues.kneeAngle,
      `${thresholds.kneeAngleMin} - ${thresholds.kneeAngleMax}`,
      featureValues.kneeAngle < thresholds.kneeAngleMin
        ? "무릎을 조금만 더 굽혀 중심을 낮춰보세요."
        : "무릎이 너무 많이 굽혀졌어요. 살짝 펴서 안정적으로 서보세요.",
    );
    pushCheck(
      "stanceWidthRatio",
      featureValues.stanceWidthRatio >= thresholds.stanceWidthMinRatio && featureValues.stanceWidthRatio <= thresholds.stanceWidthMaxRatio,
      featureValues.stanceWidthRatio,
      `${thresholds.stanceWidthMinRatio} - ${thresholds.stanceWidthMaxRatio}`,
      featureValues.stanceWidthRatio < thresholds.stanceWidthMinRatio
        ? "발 간격이 너무 좁아요. 어깨너비보다 약간 넓게 벌려보세요."
        : "발 간격이 너무 넓어요. 한 걸음 모으듯 안정 범위로 줄여보세요.",
    );
    pushCheck(
      "balanceOffsetMax",
      featureValues.balanceOffset <= thresholds.balanceOffsetMax,
      featureValues.balanceOffset,
      `<= ${thresholds.balanceOffsetMax}`,
      "머리, 골반, 발 중심이 한 줄에 오도록 체중을 가운데로 다시 맞춰보세요.",
    );
    return checks;
  }

  return checks;
}

function evaluateBasicGuardBeginnerPass(featureValues, thresholds, detailedChecks) {
  const leftHandCheck = createThresholdCheck(
    "leftHandUp",
    featureValues.leftGuardGap <= thresholds.guardWristToFaceMax,
    featureValues.leftGuardGap,
    `<= ${thresholds.guardWristToFaceMax}`,
    "왼손을 얼굴 가까이 올려주세요.",
  );
  const rightHandCheck = createThresholdCheck(
    "rightHandUp",
    featureValues.rightGuardGap <= thresholds.guardWristToFaceMax,
    featureValues.rightGuardGap,
    `<= ${thresholds.guardWristToFaceMax}`,
    "오른손을 얼굴 가까이 올려주세요.",
  );
  const bothHandsCheck = createThresholdCheck(
    "bothHandsUp",
    leftHandCheck.matched && rightHandCheck.matched,
    featureValues.guardWristToFace,
    "왼손과 오른손 모두 얼굴 가까이",
    "한 손만 올리면 안 되고, 양손이 모두 얼굴 가까이에 있어야 합니다.",
  );
  const stanceCheck = createThresholdCheck(
    "stanceWidth",
    featureValues.stanceWidthRatio >= thresholds.stanceWidthMinRatio && featureValues.stanceWidthRatio <= thresholds.stanceWidthMaxRatio,
    featureValues.stanceWidthRatio,
    `${thresholds.stanceWidthMinRatio} - ${thresholds.stanceWidthMaxRatio}`,
    featureValues.stanceWidthRatio < thresholds.stanceWidthMinRatio
      ? "발 간격이 너무 좁아요. 어깨너비보다 조금 넓게 벌려주세요."
      : "발 간격이 너무 넓어요. 조금만 모아서 기본 가드 폭을 맞춰주세요.",
  );
  const baseCheck = createThresholdCheck(
    "baseStable",
    (featureValues.kneeAngle >= thresholds.kneeAngleMin && featureValues.kneeAngle <= thresholds.kneeAngleMax)
      || featureValues.balanceOffset <= thresholds.balanceOffsetMax,
    featureValues.balanceOffset <= thresholds.balanceOffsetMax ? featureValues.balanceOffset : featureValues.kneeAngle,
    `knee ${thresholds.kneeAngleMin}-${thresholds.kneeAngleMax} or balance <= ${thresholds.balanceOffsetMax}`,
    "무릎을 살짝 굽히고 중심을 가운데에 두어 안정적으로 서보세요.",
  );

  const essentialChecks = [leftHandCheck, rightHandCheck, stanceCheck, baseCheck];
  const essentialMatched = essentialChecks.filter((item) => item.matched).length;
  const canPass =
    bothHandsCheck.matched &&
    (stanceCheck.matched || baseCheck.matched);
  const failedKeys = new Set(
    [...essentialChecks, bothHandsCheck]
      .filter((item) => !item.matched)
      .map((item) => item.key),
  );
  const failedChecks = [
    ...essentialChecks.filter((item) => !item.matched),
    ...(bothHandsCheck.matched ? [] : [bothHandsCheck]),
    ...detailedChecks.filter((item) => !item.matched && !failedKeys.has(item.key)),
  ];

  return {
    canPass,
    quality: essentialChecks.length > 0 ? Math.max(essentialMatched / essentialChecks.length, canPass ? 0.72 : 0) : 0,
    matched: essentialMatched,
    total: essentialChecks.length,
    checks: [leftHandCheck, rightHandCheck, bothHandsCheck, stanceCheck, baseCheck],
    failedChecks,
    detailedChecks,
  };
}

function evaluateJabBeginnerPass(featureValues, thresholds, detailedChecks) {
  const extensionCheck = createThresholdCheck(
    "elbowExtension",
    featureValues.elbowExtension >= thresholds.elbowExtensionMin,
    featureValues.elbowExtension,
    `>= ${thresholds.elbowExtensionMin}`,
    "앞손 팔꿈치를 조금 더 곧게 뻗어주세요.",
  );
  const speedCheck = createThresholdCheck(
    "wristSpeed",
    featureValues.wristSpeed >= thresholds.wristSpeedMin,
    featureValues.wristSpeed,
    `>= ${thresholds.wristSpeedMin}`,
    "잽은 더 짧고 빠르게 뻗어보세요.",
  );
  const travelCheck = createThresholdCheck(
    "wristTravelRatio",
    featureValues.wristTravelRatio >= thresholds.wristTravelMinRatio,
    featureValues.wristTravelRatio,
    `>= ${thresholds.wristTravelMinRatio}`,
    "앞손 이동량이 너무 작아요. 조금 더 분명하게 뻗어주세요.",
  );
  const shoulderCheck = createThresholdCheck(
    "shoulderForward",
    featureValues.shoulderForward >= thresholds.shoulderForwardMin,
    featureValues.shoulderForward,
    `>= ${thresholds.shoulderForwardMin}`,
    "어깨가 조금 더 자연스럽게 따라 나가도록 연결해보세요.",
  );
  const returnCheck = createThresholdCheck(
    "returnTime",
    featureValues.returnTime <= thresholds.returnTimeMax,
    featureValues.returnTime,
    `<= ${thresholds.returnTimeMax}`,
    "잽 후 복귀를 조금 더 빠르게 해보세요.",
  );
  const oppositeGuardCheck = createThresholdCheck(
    "oppositeGuardDistance",
    featureValues.oppositeGuardDistance <= thresholds.oppositeGuardMaxDistance,
    featureValues.oppositeGuardDistance,
    `<= ${thresholds.oppositeGuardMaxDistance}`,
    "잽을 칠 때 반대손을 얼굴 가까이 올려 가드를 유지하세요.",
  );

  const essentialChecks = [extensionCheck, speedCheck, travelCheck, shoulderCheck, returnCheck, oppositeGuardCheck];
  const matched = essentialChecks.filter((item) => item.matched).length;
  const strikeShapeOk = extensionCheck.matched && (travelCheck.matched || shoulderCheck.matched);
  const motionOk = speedCheck.matched || returnCheck.matched;
  const canPass =
    oppositeGuardCheck.matched &&
    matched >= 3 &&
    strikeShapeOk &&
    (motionOk || matched >= 4);
  const failedKeys = new Set(essentialChecks.filter((item) => !item.matched).map((item) => item.key));
  const failedChecks = [
    ...essentialChecks.filter((item) => !item.matched),
    ...detailedChecks.filter((item) => !item.matched && !failedKeys.has(item.key)),
  ];

  return {
    canPass,
    quality: essentialChecks.length > 0 ? Math.max(matched / essentialChecks.length, canPass ? 0.7 : 0) : 0,
    matched,
    total: essentialChecks.length,
    checks: essentialChecks,
    failedChecks,
    detailedChecks,
  };
}

function evaluateCrossBeginnerPass(featureValues, thresholds, detailedChecks) {
  const extensionCheck = createThresholdCheck(
    "elbowExtension",
    featureValues.elbowExtension >= thresholds.elbowExtensionMin,
    featureValues.elbowExtension,
    `>= ${thresholds.elbowExtensionMin}`,
    "뒷손 팔꿈치를 조금 더 곧게 뻗어주세요.",
  );
  const speedCheck = createThresholdCheck(
    "wristSpeed",
    featureValues.wristSpeed >= thresholds.wristSpeedMin,
    featureValues.wristSpeed,
    `>= ${thresholds.wristSpeedMin}`,
    "크로스는 더 짧고 강하게 뻗어보세요.",
  );
  const shoulderRotationCheck = createThresholdCheck(
    "shoulderRotation",
    featureValues.shoulderRotation >= thresholds.shoulderRotationMin,
    featureValues.shoulderRotation,
    `>= ${thresholds.shoulderRotationMin}`,
    "어깨를 살짝 더 돌려 주먹이 자연스럽게 나가게 해보세요.",
  );
  const hipRotationCheck = createThresholdCheck(
    "hipRotation",
    featureValues.hipRotation >= thresholds.hipRotationMin,
    featureValues.hipRotation,
    `>= ${thresholds.hipRotationMin}`,
    "골반을 살짝 더 따라 돌리면 힘이 더 잘 실립니다.",
  );
  const balanceCheck = createThresholdCheck(
    "balanceOffset",
    featureValues.balanceOffset <= thresholds.balanceOffsetMax,
    featureValues.balanceOffset,
    `<= ${thresholds.balanceOffsetMax}`,
    "몸이 한쪽으로 쏠리지 않게 중심을 편하게 잡아주세요.",
  );

  const essentialChecks = [extensionCheck, speedCheck, shoulderRotationCheck, hipRotationCheck, balanceCheck];
  const matched = essentialChecks.filter((item) => item.matched).length;
  const rotationOk = shoulderRotationCheck.matched || hipRotationCheck.matched;
  const canPass =
    matched >= 3 &&
    extensionCheck.matched &&
    rotationOk;
  const failedKeys = new Set(essentialChecks.filter((item) => !item.matched).map((item) => item.key));
  const failedChecks = [
    ...essentialChecks.filter((item) => !item.matched),
    ...detailedChecks.filter((item) => !item.matched && !failedKeys.has(item.key)),
  ];

  return {
    canPass,
    quality: essentialChecks.length > 0 ? Math.max(matched / essentialChecks.length, canPass ? 0.7 : 0) : 0,
    matched,
    total: essentialChecks.length,
    checks: essentialChecks,
    failedChecks,
    detailedChecks,
  };
}

function evaluateLeftHookBeginnerPass(featureValues, thresholds, detailedChecks) {
  const handsUpCheck = createThresholdCheck(
    "rearGuardGap",
    featureValues.rearGuardGap <= thresholds.rearGuardGapMax,
    featureValues.rearGuardGap,
    `<= ${thresholds.rearGuardGapMax}`,
    "반대손을 얼굴 가까이에 올려 가드를 유지해주세요.",
  );
  const elbowAngleCheck = createThresholdCheck(
    "elbowAngle",
    featureValues.elbowAngle >= thresholds.elbowAngleMin && featureValues.elbowAngle <= thresholds.elbowAngleMax,
    featureValues.elbowAngle,
    `${thresholds.elbowAngleMin} - ${thresholds.elbowAngleMax}`,
    featureValues.elbowAngle < thresholds.elbowAngleMin
      ? "팔꿈치를 너무 접지 말고 조금 더 열어주세요."
      : "팔꿈치가 너무 펴졌어요. 왼훅은 더 짧게 접어주세요.",
  );
  const wristHeightCheck = createThresholdCheck(
    "wristHeightDiff",
    featureValues.wristHeightDiff <= thresholds.wristHeightDiffMax,
    featureValues.wristHeightDiff,
    `<= ${thresholds.wristHeightDiffMax}`,
    "두 손 높이 차이가 너무 커요. 훅 손 높이를 조금 더 맞춰주세요.",
  );
  const elbowHeightCheck = createThresholdCheck(
    "elbowHeightRatio",
    featureValues.elbowHeightRatio >= thresholds.elbowHeightMinRatio,
    featureValues.elbowHeightRatio,
    `>= ${thresholds.elbowHeightMinRatio}`,
    "팔꿈치를 어깨 높이 쪽으로 조금 더 들어 올려주세요.",
  );
  const horizontalMoveCheck = createThresholdCheck(
    "horizontalMoveRatio",
    featureValues.horizontalMoveRatio >= thresholds.horizontalMoveMinRatio,
    featureValues.horizontalMoveRatio,
    `>= ${thresholds.horizontalMoveMinRatio}`,
    "손목이 어깨 기준으로 옆으로 휘는 훅 궤도를 더 분명하게 만들어주세요.",
  );
  const wristSpeedCheck = createThresholdCheck(
    "wristSpeed",
    featureValues.wristSpeed >= thresholds.wristSpeedMin,
    featureValues.wristSpeed,
    `>= ${thresholds.wristSpeedMin}`,
    "가만히 멈춰 있기보다 훅을 짧고 빠르게 휘둘러 주세요.",
  );
  const wristTravelCheck = createThresholdCheck(
    "wristTravelRatio",
    featureValues.wristTravelRatio >= thresholds.wristTravelMinRatio,
    featureValues.wristTravelRatio,
    `>= ${thresholds.wristTravelMinRatio}`,
    "손이 실제로 움직인 거리가 아직 부족해요. 훅을 더 분명하게 휘둘러 주세요.",
  );
  const torsoRotationCheck = createThresholdCheck(
    "torsoRotation",
    featureValues.torsoRotation >= thresholds.torsoRotationMin,
    featureValues.torsoRotation,
    `>= ${thresholds.torsoRotationMin}`,
    "상체를 살짝 더 돌려 훅의 회전을 연결해보세요.",
  );

  const essentialChecks = [handsUpCheck, elbowAngleCheck, wristHeightCheck, elbowHeightCheck, horizontalMoveCheck, wristSpeedCheck, wristTravelCheck, torsoRotationCheck];
  const matched = essentialChecks.filter((item) => item.matched).length;
  const shapeOk = elbowAngleCheck.matched && wristHeightCheck.matched;
  const supportShapeOk = handsUpCheck.matched || elbowHeightCheck.matched;
  const motionTraceOk = wristSpeedCheck.matched || wristTravelCheck.matched;
  const motionOk = horizontalMoveCheck.matched && motionTraceOk;
  const compactHookShapeOk = elbowAngleCheck.matched && wristHeightCheck.matched && elbowHeightCheck.matched;
  const canPass =
    (
      matched >= 4 &&
      elbowAngleCheck.matched &&
      shapeOk &&
      motionOk &&
      supportShapeOk
    ) ||
    (
      matched >= 3 &&
      compactHookShapeOk &&
      motionOk
    );
  const failedKeys = new Set(essentialChecks.filter((item) => !item.matched).map((item) => item.key));
  const failedChecks = [
    ...essentialChecks.filter((item) => !item.matched),
    ...detailedChecks.filter((item) => !item.matched && !failedKeys.has(item.key)),
  ];

  return {
    canPass,
    quality: essentialChecks.length > 0 ? Math.max(matched / essentialChecks.length, canPass ? 0.64 : 0) : 0,
    matched,
    total: essentialChecks.length,
    checks: essentialChecks,
    failedChecks,
    detailedChecks,
  };
}

function evaluateSlipBeginnerPass(featureValues, thresholds, detailedChecks) {
  const headMoveCheck = createThresholdCheck(
    "headMoveRatio",
    featureValues.headMoveRatio >= thresholds.headMoveMinRatio,
    featureValues.headMoveRatio,
    `>= ${thresholds.headMoveMinRatio}`,
    "머리를 너무 크게 말고 짧게 옆으로 빼주세요.",
  );
  const heightChangeCheck = createThresholdCheck(
    "heightChange",
    featureValues.heightChange <= thresholds.heightChangeMax,
    featureValues.heightChange,
    `<= ${thresholds.heightChangeMax}`,
    "슬립할 때 위아래로 너무 크게 출렁이지 않게 해주세요.",
  );
  const balanceCheck = createThresholdCheck(
    "balanceOffset",
    featureValues.balanceOffset <= thresholds.balanceOffsetMax,
    featureValues.balanceOffset,
    `<= ${thresholds.balanceOffsetMax}`,
    "슬립 후 몸이 한쪽으로 너무 쏠리지 않게 중심을 잡아주세요.",
  );
  const kneeAngleCheck = createThresholdCheck(
    "kneeAngle",
    featureValues.kneeAngle >= thresholds.kneeAngleMin && featureValues.kneeAngle <= thresholds.kneeAngleMax,
    featureValues.kneeAngle,
    `${thresholds.kneeAngleMin} - ${thresholds.kneeAngleMax}`,
    featureValues.kneeAngle < thresholds.kneeAngleMin
      ? "무릎을 너무 많이 굽히지 말고 살짝만 써주세요."
      : "무릎이 너무 펴졌어요. 아주 조금만 더 힘을 풀어주세요.",
  );

  const essentialChecks = [headMoveCheck, heightChangeCheck, balanceCheck, kneeAngleCheck];
  const matched = essentialChecks.filter((item) => item.matched).length;
  const movementOk = headMoveCheck.matched;
  const stabilityOk = heightChangeCheck.matched || balanceCheck.matched;
  const canPass =
    matched >= 2 &&
    movementOk &&
    stabilityOk;
  const failedKeys = new Set(essentialChecks.filter((item) => !item.matched).map((item) => item.key));
  const failedChecks = [
    ...essentialChecks.filter((item) => !item.matched),
    ...detailedChecks.filter((item) => !item.matched && !failedKeys.has(item.key)),
  ];

  return {
    canPass,
    quality: essentialChecks.length > 0 ? Math.max(matched / essentialChecks.length, canPass ? 0.68 : 0) : 0,
    matched,
    total: essentialChecks.length,
    checks: essentialChecks,
    failedChecks,
    detailedChecks,
  };
}

function evaluateUppercutBeginnerPass(featureValues, thresholds, detailedChecks) {
  const verticalMoveCheck = createThresholdCheck(
    "verticalMoveRatio",
    featureValues.verticalMoveRatio >= thresholds.verticalMoveMinRatio,
    featureValues.verticalMoveRatio,
    `>= ${thresholds.verticalMoveMinRatio}`,
    "주먹 궤적을 아래에서 위로 더 분명하게 올려주세요.",
  );
  const wristSpeedCheck = createThresholdCheck(
    "wristSpeed",
    featureValues.wristSpeed >= thresholds.wristSpeedMin,
    featureValues.wristSpeed,
    `>= ${thresholds.wristSpeedMin}`,
    "어퍼컷이 너무 느려요. 아래에서 위로 조금 더 빠르게 올려주세요.",
  );
  const elbowAngleCheck = createThresholdCheck(
    "elbowAngle",
    featureValues.elbowAngle >= thresholds.elbowAngleMin && featureValues.elbowAngle <= thresholds.elbowAngleMax,
    featureValues.elbowAngle,
    `${thresholds.elbowAngleMin} - ${thresholds.elbowAngleMax}`,
    featureValues.elbowAngle < thresholds.elbowAngleMin
      ? "팔을 너무 접지 말고 조금 더 자연스럽게 올려주세요."
      : "팔이 너무 펴졌어요. 어퍼컷은 더 짧고 컴팩트하게 올려주세요.",
  );
  const kneeBendMinCheck = createThresholdCheck(
    "kneeBend",
    featureValues.kneeBend >= thresholds.kneeBendMin,
    featureValues.kneeBend,
    `>= ${thresholds.kneeBendMin}`,
    "무릎 반동을 조금 더 써서 아래에서 힘을 만들어주세요.",
  );
  const kneeBendMaxCheck = createThresholdCheck(
    "kneeBend",
    featureValues.kneeBend <= thresholds.kneeBendMax,
    featureValues.kneeBend,
    `<= ${thresholds.kneeBendMax}`,
    "무릎을 너무 깊게 앉지 말고 짧게 반동만 사용해주세요.",
  );
  const torsoRiseCheck = createThresholdCheck(
    "torsoRise",
    featureValues.torsoRise >= thresholds.torsoRiseMin,
    featureValues.torsoRise,
    `>= ${thresholds.torsoRiseMin}`,
    "상체가 주먹과 함께 아래에서 위로 조금 더 따라와야 합니다.",
  );

  const essentialChecks = [
    verticalMoveCheck,
    wristSpeedCheck,
    elbowAngleCheck,
    kneeBendMinCheck,
    kneeBendMaxCheck,
    torsoRiseCheck,
  ];
  const matched = essentialChecks.filter((item) => item.matched).length;
  const liftOk = verticalMoveCheck.matched || torsoRiseCheck.matched;
  const bendOk = kneeBendMinCheck.matched && kneeBendMaxCheck.matched;
  const canPass =
    matched >= 3 &&
    liftOk &&
    wristSpeedCheck.matched &&
    (elbowAngleCheck.matched || bendOk);
  const failedKeys = new Set(essentialChecks.filter((item) => !item.matched).map((item) => item.key));
  const failedChecks = [
    ...essentialChecks.filter((item) => !item.matched),
    ...detailedChecks.filter((item) => !item.matched && !failedKeys.has(item.key)),
  ];

  return {
    canPass,
    quality: essentialChecks.length > 0 ? Math.max(matched / essentialChecks.length, canPass ? 0.68 : 0) : 0,
    matched,
    total: essentialChecks.length,
    checks: essentialChecks,
    failedChecks,
    detailedChecks,
  };
}

function reconcileBasicGuardPassSummary(thresholdSummary, scores) {
  const current = thresholdSummary || {
    canPass: false,
    quality: 0,
    matched: 0,
    total: 0,
    checks: [],
    failedChecks: [],
    detailedChecks: [],
  };

  const postureScore = toNumber(scores?.postureScore, 0);
  const guardScore = toNumber(scores?.guardScore, 0);
  const balanceScore = toNumber(scores?.balanceScore, 0);
  const reactionScore = toNumber(scores?.reactionScore, 0);

  const scoreBasedPass =
    (guardScore >= 78 && balanceScore >= 78 && postureScore >= 52) ||
    (guardScore >= 82 && balanceScore >= 88) ||
    (guardScore >= 75 && balanceScore >= 84 && reactionScore >= 62);

  const scoreQuality = clamp(
    (
      (guardScore / 100) * 0.4 +
      (balanceScore / 100) * 0.3 +
      (postureScore / 100) * 0.2 +
      (reactionScore / 100) * 0.1
    ),
    0,
    1,
  );

  if (!scoreBasedPass) {
    return {
      ...current,
      quality: Math.max(current.quality || 0, scoreQuality * 0.85),
    };
  }

  return {
    ...current,
    canPass: true,
    quality: Math.max(current.quality || 0, scoreQuality),
    failedChecks: [],
  };
}

function createGuardTargetPoint(faceCenter, shoulderWidth, side = "left") {
  if (!faceCenter || !Number.isFinite(shoulderWidth) || shoulderWidth <= 0) {
    return null;
  }

  const horizontalOffset = shoulderWidth * 0.18;
  const verticalOffset = shoulderWidth * 0.1;
  const direction = side === "right" ? 1 : -1;

  return {
    x: faceCenter.x + horizontalOffset * direction,
    y: faceCenter.y + verticalOffset,
  };
}

function getLandmarkGroup(poseLandmarks, now = getMonotonicNow()) {
  const nose = getLandmark(poseLandmarks, "nose", LANDMARK_INDEX.nose);
  const leftShoulder = getLandmark(poseLandmarks, "leftShoulder", LANDMARK_INDEX.leftShoulder);
  const rightShoulder = getLandmark(poseLandmarks, "rightShoulder", LANDMARK_INDEX.rightShoulder);
  const leftElbow = getLandmark(poseLandmarks, "leftElbow", LANDMARK_INDEX.leftElbow);
  const rightElbow = getLandmark(poseLandmarks, "rightElbow", LANDMARK_INDEX.rightElbow);
  const leftWrist = getLandmark(poseLandmarks, "leftWrist", LANDMARK_INDEX.leftWrist);
  const rightWrist = getLandmark(poseLandmarks, "rightWrist", LANDMARK_INDEX.rightWrist);
  const leftHip = getLandmark(poseLandmarks, "leftHip", LANDMARK_INDEX.leftHip);
  const rightHip = getLandmark(poseLandmarks, "rightHip", LANDMARK_INDEX.rightHip);
  const leftKnee = getLandmark(poseLandmarks, "leftKnee", LANDMARK_INDEX.leftKnee);
  const rightKnee = getLandmark(poseLandmarks, "rightKnee", LANDMARK_INDEX.rightKnee);
  const leftAnkle = getLandmark(poseLandmarks, "leftAnkle", LANDMARK_INDEX.leftAnkle);
  const rightAnkle = getLandmark(poseLandmarks, "rightAnkle", LANDMARK_INDEX.rightAnkle);

  const shoulderMid = midpoint(leftShoulder, rightShoulder);
  const hipMid = midpoint(leftHip, rightHip);
  const kneeMid = midpoint(leftKnee, rightKnee);
  const ankleMid = midpoint(leftAnkle, rightAnkle);
  const shoulderWidth = Math.max(distance2D(leftShoulder, rightShoulder), 0.12);
  const hipWidth = Math.max(distance2D(leftHip, rightHip), 0.12);
  const stanceWidth = distance2D(leftAnkle, rightAnkle);
  const torsoWidth = Math.max(distance2D(shoulderMid, hipMid), 0.08);

  const previous = state.lastPoseLandmarks || null;
  const previousAt = Number.isFinite(state.lastPoseAt) && state.lastPoseAt > 0 ? state.lastPoseAt : 0;
  const dtMs = previousAt > 0 ? Math.max(16, Math.min(1000, now - previousAt)) : 33;
  const dtSeconds = dtMs / 1000;

  const prevNose = previous ? getLandmark(previous, "nose", LANDMARK_INDEX.nose) : null;
  const prevLeftWrist = previous ? getLandmark(previous, "leftWrist", LANDMARK_INDEX.leftWrist) : null;
  const prevRightWrist = previous ? getLandmark(previous, "rightWrist", LANDMARK_INDEX.rightWrist) : null;
  const prevLeftShoulder = previous ? getLandmark(previous, "leftShoulder", LANDMARK_INDEX.leftShoulder) : null;
  const prevRightShoulder = previous ? getLandmark(previous, "rightShoulder", LANDMARK_INDEX.rightShoulder) : null;
  const prevLeftHip = previous ? getLandmark(previous, "leftHip", LANDMARK_INDEX.leftHip) : null;
  const prevRightHip = previous ? getLandmark(previous, "rightHip", LANDMARK_INDEX.rightHip) : null;
  const prevLeftElbow = previous ? getLandmark(previous, "leftElbow", LANDMARK_INDEX.leftElbow) : null;
  const prevRightElbow = previous ? getLandmark(previous, "rightElbow", LANDMARK_INDEX.rightElbow) : null;
  const prevShoulderMid = midpoint(prevLeftShoulder, prevRightShoulder);
  const prevHipMid = midpoint(prevLeftHip, prevRightHip);

  const leftWristSpeed = prevLeftWrist ? normalizeRatio(distance2D(leftWrist, prevLeftWrist) / dtSeconds, shoulderWidth) : 0;
  const rightWristSpeed = prevRightWrist ? normalizeRatio(distance2D(rightWrist, prevRightWrist) / dtSeconds, shoulderWidth) : 0;
  const leftWristTravelRatio = prevLeftWrist ? normalizeRatio(distance2D(leftWrist, prevLeftWrist), shoulderWidth) : 0;
  const rightWristTravelRatio = prevRightWrist ? normalizeRatio(distance2D(rightWrist, prevRightWrist), shoulderWidth) : 0;
  const headMoveRatio = prevNose ? normalizeRatio(distance2D(nose, prevNose), shoulderWidth) : 0;
  const heightChange = prevNose ? Math.abs(nose.y - prevNose.y) : 0;
  const shoulderRotation = lineAngleDegrees(leftShoulder, rightShoulder);
  const hipRotation = lineAngleDegrees(leftHip, rightHip);
  const torsoRotation = shoulderMid && hipMid ? Math.abs(Math.atan2(shoulderMid.y - hipMid.y, shoulderMid.x - hipMid.x) * (180 / Math.PI) - 90) : 0;
  const torsoCenterOffset = shoulderMid && hipMid ? normalizeRatio(Math.abs(shoulderMid.x - hipMid.x), shoulderWidth) : 0;
  const baseCenterOffset = hipMid && ankleMid ? normalizeRatio(Math.abs(hipMid.x - ankleMid.x), shoulderWidth) : torsoCenterOffset;
  const balanceOffset = Number(((torsoCenterOffset * 0.55) + (baseCenterOffset * 0.45)).toFixed(4));
  const shoulderLevelDiff = leftShoulder && rightShoulder ? Math.abs(leftShoulder.y - rightShoulder.y) : 0;
  const faceCenter = nose || shoulderMid;
  const leftGuardTarget = createGuardTargetPoint(faceCenter, shoulderWidth, "left");
  const rightGuardTarget = createGuardTargetPoint(faceCenter, shoulderWidth, "right");
  const leftGuardGap = leftWrist && leftGuardTarget ? distance2D(leftWrist, leftGuardTarget) / shoulderWidth : 0;
  const rightGuardGap = rightWrist && rightGuardTarget ? distance2D(rightWrist, rightGuardTarget) / shoulderWidth : 0;
  const guardWristToFace = (leftGuardGap + rightGuardGap) / 2;
  const leftElbowAngle = angle(leftShoulder, leftElbow, leftWrist);
  const rightElbowAngle = angle(rightShoulder, rightElbow, rightWrist);
  const kneeAngleLeft = angle(leftHip, leftKnee, leftAnkle);
  const kneeAngleRight = angle(rightHip, rightKnee, rightAnkle);
  const kneeAngle = (kneeAngleLeft + kneeAngleRight) / 2;
  const kneeBend = 180 - kneeAngle;
  const stanceWidthRatio = normalizeRatio(stanceWidth, shoulderWidth);
  const wristHeightDiff = leftWrist && rightWrist ? Math.abs(leftWrist.y - rightWrist.y) : 0;
  const verticalMoveRatio = prevLeftWrist && prevRightWrist
    ? Math.max(Math.abs(leftWrist.y - prevLeftWrist.y), Math.abs(rightWrist.y - prevRightWrist.y)) / shoulderWidth
    : 0;
  const shoulderRiseRatio = prevShoulderMid && shoulderMid
    ? normalizeRatio(Math.max(0, prevShoulderMid.y - shoulderMid.y), shoulderWidth)
    : 0;
  const hipRiseRatio = prevHipMid && hipMid
    ? normalizeRatio(Math.max(0, prevHipMid.y - hipMid.y), shoulderWidth)
    : 0;
  const torsoRise = Number(((shoulderRiseRatio * 0.65) + (hipRiseRatio * 0.35)).toFixed(4));

  return {
    nose,
    leftShoulder,
    rightShoulder,
    leftElbow,
    rightElbow,
    leftWrist,
    rightWrist,
    leftHip,
    rightHip,
    leftKnee,
    rightKnee,
    leftAnkle,
    rightAnkle,
    shoulderMid,
    hipMid,
    kneeMid,
    ankleMid,
    shoulderWidth,
    hipWidth,
    stanceWidth,
    torsoWidth,
    leftWristSpeed,
    rightWristSpeed,
    leftWristTravelRatio,
    rightWristTravelRatio,
    headMoveRatio,
    heightChange,
    shoulderRotation,
    hipRotation,
    torsoRotation,
    balanceOffset,
    shoulderLevelDiff,
    faceCenter,
    leftGuardTarget,
    rightGuardTarget,
    leftGuardGap,
    rightGuardGap,
    guardWristToFace,
    leftElbowAngle,
    rightElbowAngle,
    kneeAngle,
    kneeAngleLeft,
    kneeAngleRight,
    kneeBend,
    stanceWidthRatio,
    wristHeightDiff,
    verticalMoveRatio,
    torsoRise,
    dtSeconds,
    prevNose,
    prevLeftWrist,
    prevRightWrist,
    prevLeftShoulder,
    prevRightShoulder,
    prevShoulderMid,
    prevLeftHip,
    prevRightHip,
    prevHipMid,
    prevLeftElbow,
    prevRightElbow,
  };
}

function getLessonFeatureSummary(lessonKey, featureSnapshot) {
  if (!featureSnapshot) {
    return {};
  }

  const shared = {
    // balanceOffset is normalized to shoulder width and represents lateral center drift.
    balanceOffset: clamp(Number(featureSnapshot.balanceOffset.toFixed(3)), 0, 2),
  };

  if (isBasicGuardFamily(lessonKey)) {
    return {
      ...shared,
      leftGuardGap: clamp(Number(featureSnapshot.leftGuardGap.toFixed(3)), 0, 2),
      rightGuardGap: clamp(Number(featureSnapshot.rightGuardGap.toFixed(3)), 0, 2),
      guardWristToFace: clamp(Number(featureSnapshot.guardWristToFace.toFixed(3)), 0, 2),
      shoulderLevelDiff: clamp(Number(featureSnapshot.shoulderLevelDiff.toFixed(3)), 0, 1),
      kneeAngle: clamp(Math.round(featureSnapshot.kneeAngle), 0, 180),
      stanceWidthRatio: clamp(Number(featureSnapshot.stanceWidthRatio.toFixed(3)), 0, 4),
    };
  }

  if (lessonKey === "jab") {
    const activeSide = featureSnapshot.leftElbowAngle >= featureSnapshot.rightElbowAngle ? "left" : "right";
    const oppositeGuardDistance = activeSide === "left"
      ? featureSnapshot.rightGuardGap
      : featureSnapshot.leftGuardGap;
    return {
      ...shared,
      elbowExtension: clamp(Math.round(featureSnapshot.leftElbowAngle >= featureSnapshot.rightElbowAngle ? featureSnapshot.leftElbowAngle : featureSnapshot.rightElbowAngle), 0, 180),
      wristSpeed: clamp(Number(Math.max(featureSnapshot.leftWristSpeed, featureSnapshot.rightWristSpeed).toFixed(3)), 0, 5),
      wristTravelRatio: clamp(Number(Math.max(featureSnapshot.leftWristTravelRatio, featureSnapshot.rightWristTravelRatio).toFixed(3)), 0, 4),
      shoulderForward: clamp(Number((featureSnapshot.leftShoulder && featureSnapshot.rightShoulder ? Math.abs(featureSnapshot.leftShoulder.x - featureSnapshot.rightShoulder.x) / featureSnapshot.shoulderWidth : 0).toFixed(3)), 0, 4),
      oppositeGuardDistance: clamp(Number(oppositeGuardDistance.toFixed(3)), 0, 2),
      returnTime: clamp(Number(featureSnapshot.dtSeconds.toFixed(3)), 0, 2),
    };
  }

  if (lessonKey === "cross") {
    return {
      ...shared,
      elbowExtension: clamp(Math.round(featureSnapshot.rightElbowAngle >= featureSnapshot.leftElbowAngle ? featureSnapshot.rightElbowAngle : featureSnapshot.leftElbowAngle), 0, 180),
      wristSpeed: clamp(Number(Math.max(featureSnapshot.leftWristSpeed, featureSnapshot.rightWristSpeed).toFixed(3)), 0, 5),
      shoulderRotation: clamp(Number(featureSnapshot.shoulderRotation.toFixed(3)), 0, 90),
      hipRotation: clamp(Number(featureSnapshot.hipRotation.toFixed(3)), 0, 90),
    };
  }

  if (lessonKey === "left-hook") {
    return {
      ...shared,
      elbowAngle: clamp(Math.round(featureSnapshot.leftElbowAngle), 0, 180),
      elbowHeightRatio: clamp(Number((featureSnapshot.leftShoulder && featureSnapshot.leftElbow
        ? Math.max(0, featureSnapshot.leftShoulder.y - featureSnapshot.leftElbow.y) / featureSnapshot.shoulderWidth
        : 0).toFixed(3)), 0, 2),
      wristHeightDiff: clamp(Number(featureSnapshot.wristHeightDiff.toFixed(3)), 0, 1),
      horizontalMoveRatio: clamp(Number((featureSnapshot.leftWrist && featureSnapshot.leftShoulder ? Math.abs(featureSnapshot.leftWrist.x - featureSnapshot.leftShoulder.x) / featureSnapshot.shoulderWidth : 0).toFixed(3)), 0, 4),
      wristSpeed: clamp(Number(featureSnapshot.leftWristSpeed.toFixed(3)), 0, 5),
      wristTravelRatio: clamp(Number(featureSnapshot.leftWristTravelRatio.toFixed(3)), 0, 4),
      torsoRotation: clamp(Math.round(featureSnapshot.torsoRotation), 0, 90),
      rearGuardGap: clamp(Number(featureSnapshot.rightGuardGap.toFixed(3)), 0, 2),
    };
  }

  if (lessonKey === "slip") {
    return {
      ...shared,
      headMoveRatio: clamp(Number(featureSnapshot.headMoveRatio.toFixed(3)), 0, 4),
      heightChange: clamp(Number(featureSnapshot.heightChange.toFixed(3)), 0, 1),
      kneeAngle: clamp(Math.round(featureSnapshot.kneeAngle), 0, 180),
    };
  }

  if (lessonKey === "uppercut") {
    return {
      ...shared,
      verticalMoveRatio: clamp(Number(featureSnapshot.verticalMoveRatio.toFixed(3)), 0, 4),
      wristSpeed: clamp(Number(Math.max(featureSnapshot.leftWristSpeed, featureSnapshot.rightWristSpeed).toFixed(3)), 0, 5),
      elbowAngle: clamp(Math.round(Math.min(featureSnapshot.leftElbowAngle, featureSnapshot.rightElbowAngle)), 0, 180),
      kneeBend: clamp(Math.round(featureSnapshot.kneeBend), 0, 180),
      torsoRise: clamp(Number(featureSnapshot.torsoRise.toFixed(3)), 0, 2),
    };
  }

  return shared;
}

function evaluateThresholdSummary(lessonKey, featureValues) {
  const thresholds = getLessonThresholds(lessonKey);
  const keys = Object.keys(thresholds || {});
  if (keys.length === 0) {
    return {
      canPass: false,
      quality: 0,
      matched: 0,
      total: 0,
      checks: [],
      failedChecks: [],
    };
  }

  const detailedChecks = buildThresholdChecks(lessonKey, featureValues, thresholds);
  if (lessonKey === "beginner-basic-guard" || lessonKey === "basic-guard" || lessonKey === "real-fight-guard") {
    return evaluateBasicGuardBeginnerPass(featureValues, thresholds, detailedChecks);
  }
  if (lessonKey === "jab") {
    return evaluateJabBeginnerPass(featureValues, thresholds, detailedChecks);
  }
  if (lessonKey === "cross") {
    return evaluateCrossBeginnerPass(featureValues, thresholds, detailedChecks);
  }
  if (lessonKey === "left-hook") {
    return evaluateLeftHookBeginnerPass(featureValues, thresholds, detailedChecks);
  }
  if (lessonKey === "slip") {
    return evaluateSlipBeginnerPass(featureValues, thresholds, detailedChecks);
  }
  if (lessonKey === "uppercut") {
    return evaluateUppercutBeginnerPass(featureValues, thresholds, detailedChecks);
  }
  const checks = detailedChecks.length > 0 ? detailedChecks.map((item) => item.matched) : [];
  const addCheck = (matched) => checks.push(Boolean(matched));

  if (detailedChecks.length === 0) {
    if (lessonKey === "jab") {
      addCheck(featureValues.elbowExtension >= thresholds.elbowExtensionMin);
      addCheck(featureValues.wristSpeed >= thresholds.wristSpeedMin);
      addCheck(featureValues.wristTravelRatio >= thresholds.wristTravelMinRatio);
      addCheck(featureValues.shoulderForward >= thresholds.shoulderForwardMin);
      addCheck(featureValues.returnTime <= thresholds.returnTimeMax);
    } else if (lessonKey === "cross") {
      addCheck(featureValues.elbowExtension >= thresholds.elbowExtensionMin);
      addCheck(featureValues.wristSpeed >= thresholds.wristSpeedMin);
      addCheck(featureValues.shoulderRotation >= thresholds.shoulderRotationMin);
      addCheck(featureValues.hipRotation >= thresholds.hipRotationMin);
      addCheck(featureValues.balanceOffset <= thresholds.balanceOffsetMax);
    } else if (lessonKey === "left-hook") {
      addCheck(featureValues.elbowAngle >= thresholds.elbowAngleMin && featureValues.elbowAngle <= thresholds.elbowAngleMax);
      addCheck(featureValues.wristHeightDiff <= thresholds.wristHeightDiffMax);
      addCheck(featureValues.horizontalMoveRatio >= thresholds.horizontalMoveMinRatio);
      addCheck(featureValues.torsoRotation >= thresholds.torsoRotationMin);
    } else if (lessonKey === "slip") {
      addCheck(featureValues.headMoveRatio >= thresholds.headMoveMinRatio);
      addCheck(featureValues.heightChange <= thresholds.heightChangeMax);
      addCheck(featureValues.balanceOffset <= thresholds.balanceOffsetMax);
      addCheck(featureValues.kneeAngle >= thresholds.kneeAngleMin && featureValues.kneeAngle <= thresholds.kneeAngleMax);
    } else if (lessonKey === "uppercut") {
      addCheck(featureValues.verticalMoveRatio >= thresholds.verticalMoveMinRatio);
      addCheck(featureValues.wristSpeed >= thresholds.wristSpeedMin);
      addCheck(featureValues.elbowAngle >= thresholds.elbowAngleMin && featureValues.elbowAngle <= thresholds.elbowAngleMax);
      if (typeof thresholds.kneeBendMin === "number") {
        addCheck(featureValues.kneeBend >= thresholds.kneeBendMin);
      }
      addCheck(featureValues.kneeBend <= thresholds.kneeBendMax);
      addCheck(featureValues.torsoRise >= thresholds.torsoRiseMin);
    }
  }

  const matched = checks.filter(Boolean).length;
  const total = checks.length;
  return {
    canPass: total > 0 && matched / total >= 0.8,
    quality: total > 0 ? matched / total : 0,
    matched,
    total,
    checks: detailedChecks,
    failedChecks: detailedChecks.filter((item) => !item.matched),
  };
}

const ACTION_CLASSIFIER_KEYS = ["jab", "cross", "left-hook", "uppercut", "slip"];

function createUnknownActionClassification(reason = "insufficient-signal") {
  return {
    detectedAction: "unknown",
    detectedActionLabel: "unknown",
    actionConfidence: 0,
    actionReason: reason,
    actionScores: {},
    actionCandidates: [],
    classificationSnapshot: null,
    currentFrameFeatures: {},
    currentFrameThresholdSummary: null,
    peakActionFeatures: {},
    peakActionThresholdSummaries: {},
  };
}

function getActionDisplayLabel(actionKey) {
  if (!actionKey || actionKey === "unknown") {
    return "unknown";
  }

  return getLessonProfile(actionKey)?.title || actionKey;
}

function buildActionMotionProfile(featureSnapshot) {
  const shoulderWidth = Math.max(toNumber(featureSnapshot?.shoulderWidth, 0.12), 0.12);
  const leftDx = featureSnapshot?.leftWrist && featureSnapshot?.prevLeftWrist
    ? Math.abs(featureSnapshot.leftWrist.x - featureSnapshot.prevLeftWrist.x) / shoulderWidth
    : 0;
  const rightDx = featureSnapshot?.rightWrist && featureSnapshot?.prevRightWrist
    ? Math.abs(featureSnapshot.rightWrist.x - featureSnapshot.prevRightWrist.x) / shoulderWidth
    : 0;
  const leftDy = featureSnapshot?.leftWrist && featureSnapshot?.prevLeftWrist
    ? Math.abs(featureSnapshot.leftWrist.y - featureSnapshot.prevLeftWrist.y) / shoulderWidth
    : 0;
  const rightDy = featureSnapshot?.rightWrist && featureSnapshot?.prevRightWrist
    ? Math.abs(featureSnapshot.rightWrist.y - featureSnapshot.prevRightWrist.y) / shoulderWidth
    : 0;
  const upwardLeft = featureSnapshot?.leftWrist && featureSnapshot?.prevLeftWrist
    ? Math.max(0, featureSnapshot.prevLeftWrist.y - featureSnapshot.leftWrist.y) / shoulderWidth
    : 0;
  const upwardRight = featureSnapshot?.rightWrist && featureSnapshot?.prevRightWrist
    ? Math.max(0, featureSnapshot.prevRightWrist.y - featureSnapshot.rightWrist.y) / shoulderWidth
    : 0;
  const handHorizontalRatio = Math.max(leftDx, rightDx);
  const handVerticalRatio = Math.max(leftDy, rightDy);
  const handUpwardRatio = Math.max(upwardLeft, upwardRight);
  const handTravelRatio = Math.max(
    toNumber(featureSnapshot?.leftWristTravelRatio, 0),
    toNumber(featureSnapshot?.rightWristTravelRatio, 0),
  );
  const leftHandDrive = (
    toNumber(featureSnapshot?.leftWristTravelRatio, 0) * 0.6 +
    toNumber(featureSnapshot?.leftWristSpeed, 0) * 0.4
  );
  const rightHandDrive = (
    toNumber(featureSnapshot?.rightWristTravelRatio, 0) * 0.6 +
    toNumber(featureSnapshot?.rightWristSpeed, 0) * 0.4
  );
  const headMoveRatio = toNumber(featureSnapshot?.headMoveRatio, 0);
  const jabLineRatio = clamp(
    handTravelRatio - (handVerticalRatio * 0.55) - (headMoveRatio * 0.45),
    0,
    4,
  );
  const uppercutLiftRatio = clamp(
    handUpwardRatio - (handHorizontalRatio * 0.45),
    0,
    4,
  );
  const slipIsolationRatio = clamp(
    headMoveRatio - (handTravelRatio * 0.3),
    0,
    4,
  );
  const dominantHand = rightHandDrive > leftHandDrive ? "right" : "left";
  const handDriveGap = Math.abs(rightHandDrive - leftHandDrive);

  return {
    handHorizontalRatio: Number(handHorizontalRatio.toFixed(3)),
    handVerticalRatio: Number(handVerticalRatio.toFixed(3)),
    handUpwardRatio: Number(handUpwardRatio.toFixed(3)),
    handTravelRatio: Number(handTravelRatio.toFixed(3)),
    leftHandDrive: Number(leftHandDrive.toFixed(3)),
    rightHandDrive: Number(rightHandDrive.toFixed(3)),
    dominantHand,
    handDriveGap: Number(handDriveGap.toFixed(3)),
    headMoveRatio: Number(headMoveRatio.toFixed(3)),
    jabLineRatio: Number(jabLineRatio.toFixed(3)),
    uppercutLiftRatio: Number(uppercutLiftRatio.toFixed(3)),
    slipIsolationRatio: Number(slipIsolationRatio.toFixed(3)),
  };
}

function buildPeakActionFeatureSnapshot(featureSnapshot) {
  const current = featureSnapshot && typeof featureSnapshot === "object" ? featureSnapshot : null;
  if (!current) {
    return null;
  }

  const history = Array.isArray(state.recentFeatureSnapshots)
    ? state.recentFeatureSnapshots.slice(-(ACTION_HISTORY_LIMIT - 1))
    : [];
  const samples = [...history, current].filter((item) => item && typeof item === "object");
  if (samples.length === 0) {
    return current;
  }

  const peak = {
    ...current,
  };

  const maxKeys = [
    "leftWristSpeed",
    "rightWristSpeed",
    "leftWristTravelRatio",
    "rightWristTravelRatio",
    "leftElbowAngle",
    "rightElbowAngle",
    "headMoveRatio",
    "verticalMoveRatio",
    "torsoRise",
    "shoulderRotation",
    "hipRotation",
    "torsoRotation",
    "kneeBend",
  ];

  maxKeys.forEach((key) => {
    peak[key] = samples.reduce((best, sample) => Math.max(best, toNumber(sample?.[key], 0)), toNumber(current[key], 0));
  });

  return peak;
}

function computeActionSpecificityBonus(lessonKey, features, context = {}) {
  const crossFeatures = context.crossFeatures || {};
  const motionProfile = context.motionProfile || {};
  const currentLessonKey = context.currentLessonKey || "";
  const currentFrameThresholdSummary = context.currentFrameThresholdSummary || null;

  if (lessonKey === "jab") {
    return clamp(
      clamp((toNumber(features.wristTravelRatio, 0) - 0.03) * 1.4, 0, 0.12) +
      clamp((toNumber(features.wristSpeed, 0) - 0.15) * 0.18, 0, 0.08) -
      clamp(((toNumber(crossFeatures.shoulderRotation, 0) + toNumber(crossFeatures.hipRotation, 0)) - 20) * 0.003, 0, 0.08) +
      clamp((toNumber(features.elbowExtension, 0) - 138) * 0.0025, 0, 0.06) +
      clamp((toNumber(motionProfile.jabLineRatio, 0) - 0.08) * 0.28, 0, 0.12) +
      clamp((toNumber(features.wristSpeed, 0) - 0.22) * 0.08, 0, 0.07) +
      clamp((toNumber(features.wristTravelRatio, 0) - 0.05) * 0.05, 0, 0.07) +
      (motionProfile.dominantHand === "left"
        ? clamp(toNumber(motionProfile.handDriveGap, 0) * 0.12, 0, 0.1)
        : 0),
      -0.08,
      0.44,
    );
  }

  if (lessonKey === "cross") {
    const jabLessonCrossRotationDampen =
      currentLessonKey === "jab" && currentFrameThresholdSummary?.canPass
        ? 0.45
        : 1;
    return clamp(
      (clamp((toNumber(features.shoulderRotation, 0) + toNumber(features.hipRotation, 0)) / 180, 0, 0.18) * jabLessonCrossRotationDampen) +
      clamp((toNumber(features.wristSpeed, 0) - 0.18) * 0.16, 0, 0.06) +
      clamp((toNumber(features.elbowExtension, 0) - 145) * 0.003, 0, 0.04) +
      (clamp((toNumber(features.shoulderRotation, 0) + toNumber(features.hipRotation, 0) - 8) * 0.012, 0, 0.12) * jabLessonCrossRotationDampen) +
      (motionProfile.dominantHand === "right"
        ? clamp(toNumber(motionProfile.handDriveGap, 0) * 0.14, 0, 0.12)
        : 0),
      0,
      0.36,
    );
  }

  if (lessonKey === "left-hook") {
    return clamp(
      clamp((toNumber(features.horizontalMoveRatio, 0) - 0.04) * 1.8, 0, 0.16) +
      clamp(toNumber(features.torsoRotation, 0) / 120, 0, 0.08) +
      clamp((toNumber(features.wristSpeed, 0) - 0.12) * 0.14, 0, 0.04) +
      clamp((toNumber(features.wristTravelRatio, 0) - 0.08) * 0.22, 0, 0.04) +
      clamp((0.12 - toNumber(features.wristHeightDiff, 0)) * 0.5, 0, 0.06) +
      clamp((toNumber(motionProfile.handHorizontalRatio, 0) - 0.08) * 0.16, 0, 0.04),
      0,
      0.28,
    );
  }

  if (lessonKey === "uppercut") {
    return clamp(
      clamp((toNumber(features.verticalMoveRatio, 0) - 0.08) * 1.9, 0, 0.16) +
      clamp(toNumber(features.torsoRise, 0) * 1.8, 0, 0.08) +
      clamp(toNumber(features.kneeBend, 0) / 90, 0, 0.05) +
      clamp((toNumber(motionProfile.uppercutLiftRatio, 0) - 0.05) * 0.35, 0, 0.1),
      0,
      0.26,
    );
  }

  if (lessonKey === "slip") {
    return clamp(
      clamp((toNumber(features.headMoveRatio, 0) - 0.08) * 1.6, 0, 0.18) +
      clamp((0.18 - toNumber(features.heightChange, 0)) * 0.35, 0, 0.05) +
      clamp((toNumber(motionProfile.slipIsolationRatio, 0) - 0.04) * 0.36, 0, 0.12),
      0,
      0.27,
    );
  }

  return 0;
}

function computeActionSpecificityPenalty(lessonKey, features, context = {}) {
  const jabFeatures = context.jabFeatures || {};
  const crossFeatures = context.crossFeatures || {};
  const hookFeatures = context.hookFeatures || {};
  const uppercutFeatures = context.uppercutFeatures || {};
  const slipFeatures = context.slipFeatures || {};
  const motionProfile = context.motionProfile || {};

  if (lessonKey === "jab") {
    return clamp(
      clamp(((toNumber(crossFeatures.shoulderRotation, 0) + toNumber(crossFeatures.hipRotation, 0)) - 35) * 0.006, 0, 0.16) +
      clamp((toNumber(uppercutFeatures.verticalMoveRatio, 0) - 0.16) * 0.9, 0, 0.08) +
      clamp((toNumber(slipFeatures.headMoveRatio, 0) - 0.16) * 0.7, 0, 0.06) +
      clamp((toNumber(motionProfile.handUpwardRatio, 0) - 0.14) * 0.38, 0, 0.08) +
      clamp((toNumber(motionProfile.headMoveRatio, 0) - 0.14) * 0.32, 0, 0.06) +
      (motionProfile.dominantHand === "right"
        ? clamp((toNumber(motionProfile.handDriveGap, 0) - 0.05) * 0.22, 0, 0.14)
        : 0) +
      clamp((toNumber(crossFeatures.shoulderRotation, 0) + toNumber(crossFeatures.hipRotation, 0) - 8) * 0.01, 0, 0.12),
      0,
      0.42,
    );
  }

  if (lessonKey === "cross") {
    return clamp(
      clamp((24 - (toNumber(features.shoulderRotation, 0) + toNumber(features.hipRotation, 0))) * 0.008, 0, 0.18) +
      clamp((0.16 - toNumber(features.wristSpeed, 0)) * 0.5, 0, 0.05) +
      (motionProfile.dominantHand === "left"
        ? clamp((toNumber(motionProfile.handDriveGap, 0) - 0.05) * 0.24, 0, 0.16)
        : 0) +
      clamp((8 - (toNumber(features.shoulderRotation, 0) + toNumber(features.hipRotation, 0))) * 0.02, 0, 0.16),
      0,
      0.38,
    );
  }

  if (lessonKey === "left-hook") {
    return clamp(
      clamp((0.09 - toNumber(features.horizontalMoveRatio, 0)) * 1.8, 0, 0.22) +
      clamp((toNumber(features.wristHeightDiff, 0) - 0.1) * 0.65, 0, 0.18) +
      clamp((Math.abs(toNumber(features.elbowAngle, 0) - 105) - 20) * 0.0045, 0, 0.1) +
      clamp((toNumber(jabFeatures.elbowExtension, 0) - 145) * 0.0065, 0, 0.16) +
      clamp((toNumber(jabFeatures.wristTravelRatio, 0) - 0.12) * 0.28, 0, 0.08) +
      clamp((0.12 - toNumber(features.horizontalMoveRatio, 0)) * 1.9, 0, 0.2) +
      clamp((toNumber(features.elbowAngle, 0) - 140) * 0.005, 0, 0.12) +
      clamp((0.12 - toNumber(features.wristSpeed, 0)) * 0.55, 0, 0.12) +
      clamp((0.09 - toNumber(features.wristTravelRatio, 0)) * 0.65, 0, 0.12) +
      clamp((toNumber(jabFeatures.shoulderForward, 0) - 0.75) * 0.14, 0, 0.08) +
      clamp((toNumber(motionProfile.jabLineRatio, 0) - 0.1) * 0.46, 0, 0.2) +
      clamp((toNumber(motionProfile.handHorizontalRatio, 0) < 0.08 ? 0.08 - toNumber(motionProfile.handHorizontalRatio, 0) : 0) * 0.9, 0, 0.08),
      0,
      0.68,
    );
  }

  if (lessonKey === "uppercut") {
    return clamp(
      clamp((0.12 - toNumber(features.verticalMoveRatio, 0)) * 1.7, 0, 0.16) +
      clamp((0.02 - toNumber(features.torsoRise, 0)) * 3.5, 0, 0.06) +
      clamp((4 - toNumber(features.kneeBend, 0)) * 0.01, 0, 0.05) +
      clamp((toNumber(motionProfile.handHorizontalRatio, 0) - toNumber(motionProfile.handUpwardRatio, 0) - 0.06) * 0.42, 0, 0.12) +
      clamp((toNumber(motionProfile.jabLineRatio, 0) - 0.12) * 0.34, 0, 0.14) +
      clamp((toNumber(jabFeatures.shoulderForward, 0) - 0.75) * 0.18, 0, 0.12) +
      clamp((0.1 - toNumber(features.verticalMoveRatio, 0)) * 1.1, 0, 0.12) +
      clamp((0.02 - toNumber(features.torsoRise, 0)) * 2.5, 0, 0.06),
      0,
      0.48,
    );
  }

  if (lessonKey === "slip") {
    return clamp(
      clamp((0.14 - toNumber(features.headMoveRatio, 0)) * 1.4, 0, 0.18) +
      clamp((toNumber(jabFeatures.wristTravelRatio, 0) - 0.12) * 0.35, 0, 0.06) +
      clamp((toNumber(hookFeatures.horizontalMoveRatio, 0) - 0.1) * 0.4, 0, 0.05) +
      clamp((toNumber(motionProfile.handTravelRatio, 0) - toNumber(motionProfile.headMoveRatio, 0) - 0.08) * 0.32, 0, 0.14) +
      clamp((toNumber(motionProfile.jabLineRatio, 0) - 0.1) * 0.3, 0, 0.14),
      0,
      0.4,
    );
  }

  return 0;
}

function buildActionClassification(featureSnapshot) {
  if (!featureSnapshot || typeof featureSnapshot !== "object") {
    return createUnknownActionClassification("no-feature-snapshot");
  }

  const classificationSnapshot = buildPeakActionFeatureSnapshot(featureSnapshot) || featureSnapshot;

  const motionSnapshot = {
    wristSpeed: Math.max(toNumber(classificationSnapshot.leftWristSpeed, 0), toNumber(classificationSnapshot.rightWristSpeed, 0)),
    wristTravelRatio: Math.max(toNumber(classificationSnapshot.leftWristTravelRatio, 0), toNumber(classificationSnapshot.rightWristTravelRatio, 0)),
    headMoveRatio: toNumber(classificationSnapshot.headMoveRatio, 0),
    verticalMoveRatio: toNumber(classificationSnapshot.verticalMoveRatio, 0),
  };
  const motionProfile = buildActionMotionProfile(classificationSnapshot);

  const punchMotionReady =
    motionSnapshot.wristSpeed >= 0.12 ||
    motionSnapshot.wristTravelRatio >= 0.09 ||
    motionSnapshot.verticalMoveRatio >= 0.11;
  const slipMotionReady = motionSnapshot.headMoveRatio >= 0.12;

  const cachedFeatures = {};
  ACTION_CLASSIFIER_KEYS.forEach((lessonKey) => {
    cachedFeatures[lessonKey] = getLessonFeatureSummary(lessonKey, classificationSnapshot);
  });
  const currentLessonKey = normalizeLessonKey(state.lessonKey);
  const currentFrameFeatures = getLessonFeatureSummary(currentLessonKey, featureSnapshot);
  const currentFrameThresholdSummary = evaluateThresholdSummary(currentLessonKey, currentFrameFeatures);

  const candidates = ACTION_CLASSIFIER_KEYS.map((lessonKey) => {
    const features = cachedFeatures[lessonKey] || {};
    const summary = evaluateThresholdSummary(lessonKey, features);
    const quality = clamp(summary.quality, 0, 1);
    const matchedRatio = toNumber(summary.total, 0) > 0
      ? clamp(toNumber(summary.matched, 0) / toNumber(summary.total, 1), 0, 1)
      : quality;
    const baseScore = (quality * 0.52) + (matchedRatio * 0.22) + (summary.canPass ? 0.12 : 0);
    const jabPassBoost = lessonKey === "jab" && summary.canPass
      ? clamp(
          (quality - 0.65) * 0.22 +
          (toNumber(features.elbowExtension, 0) >= 138 ? 0.04 : 0) +
          (toNumber(features.wristSpeed, 0) >= 0.22 ? 0.05 : 0) +
          (toNumber(features.wristTravelRatio, 0) >= 0.05 ? 0.04 : 0),
          0,
          0.18,
        )
      : 0;
    const bonus = computeActionSpecificityBonus(lessonKey, features, {
      jabFeatures: cachedFeatures.jab,
      crossFeatures: cachedFeatures.cross,
      hookFeatures: cachedFeatures["left-hook"],
      uppercutFeatures: cachedFeatures.uppercut,
      slipFeatures: cachedFeatures.slip,
      motionProfile,
      currentLessonKey,
      currentFrameThresholdSummary,
    });
    const penalty = computeActionSpecificityPenalty(lessonKey, features, {
      jabFeatures: cachedFeatures.jab,
      crossFeatures: cachedFeatures.cross,
      hookFeatures: cachedFeatures["left-hook"],
      uppercutFeatures: cachedFeatures.uppercut,
      slipFeatures: cachedFeatures.slip,
      motionProfile,
    });
    const rawScore = clamp(baseScore + jabPassBoost + bonus - penalty, 0.01, 1);

    return {
      key: lessonKey,
      label: getActionDisplayLabel(lessonKey),
      rawScore: Number(rawScore.toFixed(3)),
      score: 0,
      quality: Number(quality.toFixed(3)),
      canPass: Boolean(summary.canPass),
      matched: toNumber(summary.matched, 0),
      total: toNumber(summary.total, 0),
      features,
    };
  });

  const totalRawScore = candidates.reduce((sum, candidate) => sum + candidate.rawScore, 0) || 1;
  candidates.forEach((candidate) => {
    candidate.score = Number((candidate.rawScore / totalRawScore).toFixed(3));
  });
  candidates.sort((left, right) => right.score - left.score);

  const top = candidates[0];
  const second = candidates[1];
  const margin = top && second ? top.score - second.score : top ? top.score : 0;
  const topIsPunch = top && top.key !== "slip";
  const jabFeatures = cachedFeatures.jab || {};
  const crossFeatures = cachedFeatures.cross || {};
  const leftHookFeatures = cachedFeatures["left-hook"] || {};
  const uppercutFeatures = cachedFeatures.uppercut || {};
  const jabSummary = evaluateThresholdSummary("jab", jabFeatures);
  const crossSummary = evaluateThresholdSummary("cross", crossFeatures);
  const leftHookSummary = evaluateThresholdSummary("left-hook", leftHookFeatures);
  const uppercutSummary = evaluateThresholdSummary("uppercut", uppercutFeatures);
  const jabCandidate = candidates.find((candidate) => candidate.key === "jab") || null;
  const crossCandidate = candidates.find((candidate) => candidate.key === "cross") || null;
  const leftHookCandidate = candidates.find((candidate) => candidate.key === "left-hook") || null;
  const uppercutCandidate = candidates.find((candidate) => candidate.key === "uppercut") || null;
  const currentFrameChecks = Array.isArray(currentFrameThresholdSummary?.checks)
    ? currentFrameThresholdSummary.checks
    : [];
  const currentFrameMotionMatched = currentFrameChecks.some((item) => (
    item &&
    (item.key === "wristSpeed" || item.key === "wristTravelRatio") &&
    item.matched
  ));
  const currentFrameJabActionPass =
    currentLessonKey === "jab" &&
    currentFrameThresholdSummary?.canPass &&
    toNumber(currentFrameThresholdSummary?.quality, 0) >= 0.7 &&
    toNumber(currentFrameFeatures.elbowExtension, 0) >= 130 &&
    (
      toNumber(currentFrameFeatures.wristSpeed, 0) >= 0.17 ||
      toNumber(currentFrameFeatures.wristTravelRatio, 0) >= 0.05 ||
      currentFrameMotionMatched
    ) &&
    Boolean(jabCandidate);
  const jabLessonConfidence = currentFrameJabActionPass
    ? Math.max(
        toNumber(jabCandidate?.score, 0),
        toNumber(currentFrameThresholdSummary?.quality, 0) * 0.45,
      )
    : toNumber(jabCandidate?.score, 0);
  const currentFrameLeftHookMotionReady =
    toNumber(currentFrameFeatures.horizontalMoveRatio, 0) >= 0.08 &&
    (
      toNumber(currentFrameFeatures.wristSpeed, 0) >= 0.12 ||
      toNumber(currentFrameFeatures.wristTravelRatio, 0) >= 0.02 ||
      currentFrameMotionMatched
    );
  const currentFrameLeftHookActionPass =
    currentLessonKey === "left-hook" &&
    (
      (
        currentFrameThresholdSummary?.canPass &&
        toNumber(currentFrameThresholdSummary?.quality, 0) >= 0.7 &&
        toNumber(currentFrameFeatures.elbowAngle, 0) >= 80 &&
        toNumber(currentFrameFeatures.elbowAngle, 0) <= 150 &&
        currentFrameLeftHookMotionReady
      ) ||
      (
        toNumber(currentFrameThresholdSummary?.quality, 0) >= 0.55 &&
        toNumber(currentFrameFeatures.elbowAngle, 0) >= 35 &&
        toNumber(currentFrameFeatures.elbowAngle, 0) <= 170 &&
        currentFrameLeftHookMotionReady
      )
    ) &&
    Boolean(leftHookCandidate);
  const leftHookLessonConfidence = currentFrameLeftHookActionPass
    ? Math.max(
        toNumber(leftHookCandidate?.score, 0),
        toNumber(currentFrameThresholdSummary?.quality, 0) * (currentFrameThresholdSummary?.canPass ? 0.45 : 0.36),
      )
    : toNumber(leftHookCandidate?.score, 0);
  const jabStrongPass =
    currentLessonKey === "jab" &&
    top?.key === "jab" &&
    jabSummary.canPass &&
    toNumber(jabFeatures.elbowExtension, 0) >= 138 &&
    toNumber(jabFeatures.wristSpeed, 0) >= 0.22 &&
    toNumber(jabFeatures.wristTravelRatio, 0) >= 0.05;
  const crossStrongPass =
    currentLessonKey === "cross" &&
    top?.key === "cross" &&
    crossSummary.canPass &&
    toNumber(crossFeatures.elbowExtension, 0) >= 142 &&
    toNumber(crossFeatures.wristSpeed, 0) >= 0.28 &&
    (
      toNumber(crossFeatures.shoulderRotation, 0) >= 6 ||
      toNumber(crossFeatures.hipRotation, 0) >= 4
    );
  const leftHookStrongPass =
    currentLessonKey === "left-hook" &&
    top?.key === "left-hook" &&
    leftHookSummary.canPass &&
    toNumber(leftHookFeatures.wristHeightDiff, 1) <= 0.1 &&
    toNumber(leftHookFeatures.horizontalMoveRatio, 0) >= 0.08 &&
    toNumber(leftHookFeatures.wristSpeed, 0) >= 0.12 &&
    toNumber(leftHookFeatures.torsoRotation, 0) >= 3;
  const uppercutStrongPass =
    currentLessonKey === "uppercut" &&
    top?.key === "uppercut" &&
    uppercutSummary.canPass &&
    toNumber(uppercutFeatures.verticalMoveRatio, 0) >= 0.12 &&
    toNumber(uppercutFeatures.wristSpeed, 0) >= 0.16 &&
    toNumber(uppercutFeatures.torsoRise, 0) >= 0.02;
  const jabLessonPriorityPass =
    currentLessonKey === "jab" &&
    (
      (
        jabSummary.canPass &&
        toNumber(jabFeatures.elbowExtension, 0) >= 130 &&
        toNumber(jabFeatures.wristSpeed, 0) >= 0.17 &&
        toNumber(jabFeatures.wristTravelRatio, 0) >= 0.05 &&
        jabCandidate &&
        top &&
        jabCandidate.score >= top.score - 0.02
      ) ||
      currentFrameJabActionPass
    );
  const crossLessonPriorityPass =
    currentLessonKey === "cross" &&
    crossSummary.canPass &&
    toNumber(crossFeatures.elbowExtension, 0) >= 142 &&
    toNumber(crossFeatures.wristSpeed, 0) >= 0.28 &&
    (
      toNumber(crossFeatures.shoulderRotation, 0) >= 6 ||
      toNumber(crossFeatures.hipRotation, 0) >= 4
    ) &&
    crossCandidate &&
    top &&
    crossCandidate.score >= top.score - 0.01;
  const leftHookLessonPriorityPass =
    currentLessonKey === "left-hook" &&
    (
      (
        leftHookSummary.canPass &&
        toNumber(leftHookFeatures.horizontalMoveRatio, 0) >= 0.08 &&
        toNumber(leftHookFeatures.wristSpeed, 0) >= 0.12 &&
        leftHookCandidate &&
        top &&
        leftHookCandidate.score >= top.score - 0.01
      ) ||
      currentFrameLeftHookActionPass
    );
  const uppercutLessonPriorityPass =
    currentLessonKey === "uppercut" &&
    uppercutSummary.canPass &&
    toNumber(uppercutFeatures.verticalMoveRatio, 0) >= 0.12 &&
    toNumber(uppercutFeatures.wristSpeed, 0) >= 0.16 &&
    toNumber(uppercutFeatures.torsoRise, 0) >= 0.02 &&
    uppercutCandidate &&
    top &&
    uppercutCandidate.score >= top.score - 0.01;
  const lessonPriorityPass =
    jabLessonPriorityPass ||
    crossLessonPriorityPass ||
    leftHookLessonPriorityPass ||
    uppercutLessonPriorityPass;
  const strongPriorityPass =
    jabStrongPass ||
    crossStrongPass ||
    leftHookStrongPass ||
    uppercutStrongPass;
  const allowDetection =
    top &&
    ((topIsPunch && punchMotionReady) || (!topIsPunch && slipMotionReady)) &&
    (
      (top.canPass && top.score >= 0.34) ||
      (jabStrongPass && top.score >= 0.24 && margin >= 0.01) ||
      (crossStrongPass && top.score >= 0.24 && margin >= 0.005) ||
      (leftHookStrongPass && top.score >= 0.24 && margin >= 0.01) ||
      (uppercutStrongPass && top.score >= 0.24 && margin >= 0.01) ||
      lessonPriorityPass ||
      (top.score >= 0.4 && margin >= 0.1)
    ) &&
    (
      jabStrongPass ||
      crossStrongPass ||
      leftHookStrongPass ||
      uppercutStrongPass ||
      lessonPriorityPass ||
      margin >= 0.05
    );

  const detectedAction = allowDetection
    ? (
        jabLessonPriorityPass ? "jab"
          : crossLessonPriorityPass ? "cross"
            : leftHookLessonPriorityPass ? "left-hook"
              : uppercutLessonPriorityPass ? "uppercut"
                : top.key
      )
    : "unknown";
  const actionScores = candidates.reduce((accumulator, candidate) => {
    accumulator[candidate.key] = candidate.score;
    return accumulator;
  }, {});
  const topCandidateKey = top?.key || "";
  const actionFeatureKey = detectedAction !== "unknown" ? detectedAction : topCandidateKey;
  const peakActionThresholdSummaries = ACTION_CLASSIFIER_KEYS.reduce((accumulator, lessonKey) => {
    accumulator[lessonKey] = evaluateThresholdSummary(lessonKey, cachedFeatures[lessonKey] || {});
    return accumulator;
  }, {});

  return {
    detectedAction,
    detectedActionLabel: getActionDisplayLabel(detectedAction),
    actionConfidence: Number(clamp((
      detectedAction === "jab" ? jabLessonConfidence
        : detectedAction === "cross" ? crossCandidate?.score
          : detectedAction === "left-hook" ? leftHookLessonConfidence
            : detectedAction === "uppercut" ? uppercutCandidate?.score
              : top?.score
    ) || 0, 0, 1).toFixed(3)),
    actionReason: allowDetection
      ? (
          jabLessonPriorityPass ? "jab-lesson-priority-pass"
            : crossLessonPriorityPass ? "cross-lesson-priority-pass"
              : leftHookLessonPriorityPass ? "left-hook-lesson-priority-pass"
                : uppercutLessonPriorityPass ? "uppercut-lesson-priority-pass"
                  : jabStrongPass ? "jab-priority-pass"
                    : crossStrongPass ? "cross-priority-pass"
                      : leftHookStrongPass ? "left-hook-priority-pass"
                        : uppercutStrongPass ? "uppercut-priority-pass"
                          : "top-candidate"
        )
      : (!((topIsPunch && punchMotionReady) || (!topIsPunch && slipMotionReady)) ? "low-motion" : "low-confidence"),
    actionScores,
    actionCandidates: candidates.map((candidate) => ({
      key: candidate.key,
      label: candidate.label,
      score: candidate.score,
      rawScore: candidate.rawScore,
      quality: candidate.quality,
      canPass: candidate.canPass,
      matched: candidate.matched,
      total: candidate.total,
    })),
    classificationSnapshot: clonePlainObject(classificationSnapshot),
    currentFrameFeatures,
    currentFrameThresholdSummary,
    peakActionFeatures: cachedFeatures[actionFeatureKey] || {},
    peakActionThresholdSummaries,
  };
}

function classifyScoreBand(score) {
  if (score >= 85) {
    return "good";
  }
  if (score >= 70) {
    return "normal";
  }
  return "warning";
}

function createBaselineMetrics() {
  const profile = getLessonProfile(state.lessonKey);
  const actionClassification = createUnknownActionClassification("idle");
  return {
    sequence: 0,
    updatedAt: Date.now(),
    source: "idle",
    mode: "idle",
    isRealPose: false,
    lessonKey: normalizeLessonKey(state.lessonKey),
    lessonTitle: profile.title,
    lessonGoal: profile.goal,
    scoreDelta: 0,
    score: 0,
    accuracy: 80,
    hp: 100,
    combo: 0,
    postureScore: 80,
    guardScore: 80,
    balanceScore: 80,
    reactionScore: 80,
    metrics: {},
    features: {},
    message: profile.coachMessages[0] || "훈련을 시작하면 자세 분석이 표시됩니다.",
    feedbackItems: cloneArray(profile.feedbackItems.length ? profile.feedbackItems : DEFAULT_FEEDBACK),
    feedback: cloneArray(profile.feedbackItems.length ? profile.feedbackItems : DEFAULT_FEEDBACK),
    poseReady: false,
    ...actionClassification,
  };
}

function ensureCurrentMetrics() {
  if (!state.currentMetrics) {
    state.currentMetrics = createBaselineMetrics();
  }
  return state.currentMetrics;
}

function cloneMetrics(metrics) {
  const current = metrics || createBaselineMetrics();
  return {
    ...current,
    metrics: clonePlainObject(current.metrics),
    features: clonePlainObject(current.features),
    actionScores: clonePlainObject(current.actionScores),
    actionCandidates: cloneArray(current.actionCandidates).map((item) => clonePlainObject(item)),
    classificationSnapshot: clonePlainObject(current.classificationSnapshot),
    currentFrameFeatures: clonePlainObject(current.currentFrameFeatures),
    currentFrameThresholdSummary: clonePlainObject(current.currentFrameThresholdSummary),
    peakActionFeatures: clonePlainObject(current.peakActionFeatures),
    peakActionThresholdSummaries: clonePlainObject(current.peakActionThresholdSummaries),
    feedbackItems: cloneArray(current.feedbackItems),
    feedback: cloneArray(current.feedback),
  };
}

function isLikelyPoint(value) {
  return Boolean(value) && typeof value === "object" && typeof value.x === "number" && typeof value.y === "number";
}

function normalizePoint(value) {
  if (!isLikelyPoint(value)) {
    return null;
  }

  return {
    x: Number(value.x) || 0,
    y: Number(value.y) || 0,
    z: Number(value.z) || 0,
    visibility: typeof value.visibility === "number" ? value.visibility : 1,
  };
}

function getLandmark(source, key, index) {
  if (Array.isArray(source)) {
    return normalizePoint(source[index]);
  }

  if (source && typeof source === "object") {
    if (isLikelyPoint(source[key])) {
      return normalizePoint(source[key]);
    }

    if (isLikelyPoint(source[index])) {
      return normalizePoint(source[index]);
    }
  }

  return null;
}

function midpoint(a, b) {
  if (!a || !b) {
    return null;
  }

  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: (a.z + b.z) / 2,
    visibility: Math.min(a.visibility, b.visibility),
  };
}

function angle(a, b, c) {
  if (!a || !b || !c) {
    return 180;
  }

  const ab = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  const cb = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };
  const dot = ab.x * cb.x + ab.y * cb.y + ab.z * cb.z;
  const magnitude = Math.hypot(ab.x, ab.y, ab.z) * Math.hypot(cb.x, cb.y, cb.z);

  if (!magnitude) {
    return 180;
  }

  const cosine = clamp(dot / magnitude, -1, 1);
  return (Math.acos(cosine) * 180) / Math.PI;
}

function makeFeedbackItems(postureScore, guardScore, balanceScore, reactionScore, profile) {
  const feedbackCandidates = [
    { score: postureScore, message: getProfileText(profile.feedbackItems, 0, "상체를 조금 더 세워주세요.") },
    { score: guardScore, message: getProfileText(profile.feedbackItems, 1, "양손을 눈높이에 가깝게 유지하세요.") },
    { score: balanceScore, message: getProfileText(profile.feedbackItems, 2, "발바닥 전체로 균형을 잡아주세요.") },
    { score: reactionScore, message: getProfileText(profile.feedbackItems, 3, "리듬을 살짝 더 빠르게 맞춰보세요.") },
  ];

  return feedbackCandidates
    .sort((left, right) => left.score - right.score)
    .slice(0, 2)
    .map((entry) => entry.message);
}

function makeMessage(postureScore, guardScore, balanceScore, reactionScore, profile) {
  const weakest = [
    { score: postureScore, message: getProfileText(profile.coachMessages, 0, "자세가 조금 무너지고 있어요.") },
    { score: guardScore, message: getProfileText(profile.coachMessages, 1, "가드가 조금 내려가고 있어요.") },
    { score: balanceScore, message: getProfileText(profile.coachMessages, 2, "균형을 조금 더 안정적으로 잡아주세요.") },
    { score: reactionScore, message: getProfileText(profile.coachMessages, 3, "리듬을 조금 더 빠르게 맞춰보세요.") },
  ].sort((left, right) => left.score - right.score);

  return weakest[0]?.message || "좋습니다. 자세가 안정적입니다.";
}

function createBasicGuardMetrics(lessonKey, poseLandmarks, now = getMonotonicNow()) {
  const profile = getLessonProfile(lessonKey);
  const ruleSet = getBasicGuardRulesForLesson(lessonKey);
  const featureSnapshot = getLandmarkGroup(poseLandmarks, now);
  const thresholds = getLessonThresholds(lessonKey);
  const nose = featureSnapshot.nose;
  const leftShoulder = featureSnapshot.leftShoulder;
  const rightShoulder = featureSnapshot.rightShoulder;
  const leftElbow = featureSnapshot.leftElbow;
  const rightElbow = featureSnapshot.rightElbow;
  const leftWrist = featureSnapshot.leftWrist;
  const rightWrist = featureSnapshot.rightWrist;
  const leftHip = featureSnapshot.leftHip;
  const rightHip = featureSnapshot.rightHip;
  const leftKnee = featureSnapshot.leftKnee;
  const rightKnee = featureSnapshot.rightKnee;
  const leftAnkle = featureSnapshot.leftAnkle;
  const rightAnkle = featureSnapshot.rightAnkle;

  const shoulderMid = midpoint(leftShoulder, rightShoulder);
  const hipMid = midpoint(leftHip, rightHip);
  const kneeMid = midpoint(leftKnee, rightKnee);
  const ankleMid = midpoint(leftAnkle, rightAnkle);

  const torsoLeanX = shoulderMid && hipMid ? Math.abs(shoulderMid.x - hipMid.x) : 0.1;
  const torsoLeanY = shoulderMid && hipMid ? Math.abs(shoulderMid.y - hipMid.y) : 0.08;
  const chinLift = nose && shoulderMid ? clamp((shoulderMid.y - nose.y - 0.04) * 100, 0, 12) : 7;
  const postureScore = clamp(
    Math.round(100 - torsoLeanX * ruleSet.posture.leanWeightX - torsoLeanY * ruleSet.posture.leanWeightY - chinLift * ruleSet.posture.chinWeight),
    ruleSet.floors.posture,
    98,
  );

  const wristVisibilityFactor = getVisibilityRelaxFactor([leftWrist, rightWrist], 0.4);
  const elbowVisibilityFactor = getVisibilityRelaxFactor([leftElbow, rightElbow], 0.45);
  const faceVisibilityFactor = getVisibilityRelaxFactor([nose, leftWrist, rightWrist], 0.45);
  const leftWristDrop = leftWrist && leftShoulder ? Math.max(0, leftWrist.y - leftShoulder.y) : 0.12;
  const rightWristDrop = rightWrist && rightShoulder ? Math.max(0, rightWrist.y - rightShoulder.y) : 0.12;
  const leftElbowFlare = leftElbow && leftShoulder ? Math.max(0, Math.abs(leftElbow.x - leftShoulder.x) - ruleSet.guard.tuckAllowance) : 0.12;
  const rightElbowFlare = rightElbow && rightShoulder ? Math.max(0, Math.abs(rightElbow.x - rightShoulder.x) - ruleSet.guard.tuckAllowance) : 0.12;
  const faceGap = nose && leftWrist && rightWrist ? Math.max(0, Math.min(leftWrist.y, rightWrist.y) - nose.y - 0.02) : 0.12;
  const guardPenalty =
    (((leftWristDrop + rightWristDrop) / 2) * ruleSet.guard.wristDropWeight * wristVisibilityFactor) +
    (((leftElbowFlare + rightElbowFlare) / 2) * ruleSet.guard.elbowFlareWeight * elbowVisibilityFactor) +
    (faceGap * ruleSet.guard.faceGapWeight * faceVisibilityFactor);
  const guardScore = clamp(Math.round(100 - guardPenalty), ruleSet.floors.guard, 98);

  const stanceWidth = leftAnkle && rightAnkle ? Math.abs(leftAnkle.x - rightAnkle.x) : ruleSet.balance.stanceIdeal;
  const stancePenalty = Math.abs(stanceWidth - ruleSet.balance.stanceIdeal) * 240;
  const centerShift = shoulderMid && hipMid ? Math.abs(shoulderMid.x - hipMid.x) : 0.05;
  const centerPenalty = centerShift * ruleSet.balance.centerShiftWeight;
  const kneeStability = kneeMid && hipMid ? Math.abs(kneeMid.x - hipMid.x) * 80 : 4;
  const balanceScore = clamp(Math.round(100 - stancePenalty - centerPenalty - kneeStability), ruleSet.floors.balance, 98);

  const readiness = (guardScore + postureScore + balanceScore) / 3;
  const reactionScore = clamp(
    Math.round(70 + ((guardScore - ruleSet.reaction.good) * 0.45) + ((postureScore - ruleSet.reaction.good) * 0.25) + ((balanceScore - ruleSet.reaction.good) * 0.2)),
    ruleSet.floors.reaction,
    98,
  );

  const lessonFeatures = getLessonFeatureSummary(lessonKey, featureSnapshot);
  const thresholdSummary = reconcileBasicGuardPassSummary(
    evaluateThresholdSummary(lessonKey, lessonFeatures),
    {
      postureScore,
      guardScore,
      balanceScore,
      reactionScore,
    },
  );
  const averageScore = (postureScore + guardScore + balanceScore + reactionScore) / 4;
  const targetScore = finalizeLessonScore(averageScore * 10, thresholdSummary);
  const beginnerPassFloor = thresholdSummary.canPass
    ? 78 + Math.round(thresholdSummary.quality * 10)
    : 0;
  const targetAccuracyBase =
    (averageScore * 0.42) +
    (guardScore * 0.08) +
    (balanceScore * 0.08) +
    (thresholdSummary.quality * 32);
  const targetAccuracy = finalizeLessonAccuracy(
    Math.max(targetAccuracyBase, beginnerPassFloor),
    thresholdSummary,
    50,
  );
  const targetHp = clamp(Math.round(96 - Math.max(0, 86 - averageScore) * 0.7), 45, 100);
  const targetCombo = clamp(Math.round((guardScore + reactionScore + readiness) / 45), 0, 9);

  const primaryBand =
    guardScore < ruleSet.guard.warning
      ? "guard"
      : postureScore < ruleSet.posture.warning
        ? "posture"
        : balanceScore < ruleSet.balance.warning
          ? "balance"
          : reactionScore < ruleSet.reaction.warning
            ? "reaction"
            : "ready";

  const messageMap = {
    guard: "양손을 광대 라인에 더 가깝게 올려주세요.",
    posture: "턱을 내리고 상체를 조금 더 세워주세요.",
    balance: "발 간격과 무게중심을 더 안정적으로 잡아주세요.",
    reaction: "준비 자세를 조금 더 일정하게 유지해보세요.",
    ready: "기본 가드가 안정적입니다. 자세를 유지하세요.",
  };

  const feedbackMap = {
    guard: "팔꿈치를 몸통 쪽으로 모아 가드를 높게 유지하세요.",
    posture: "상체를 세우고 턱이 들리지 않게 정면을 보세요.",
    balance: "발바닥 전체로 중심을 잡고 흔들림을 줄여보세요.",
    reaction: "리듬을 유지하면서 준비 자세를 일정하게 맞춰보세요.",
    ready: "기본 가드가 안정적으로 유지되고 있습니다.",
  };

  const coachMessage = messageMap[primaryBand];
  const feedbackItems = [
    feedbackMap[primaryBand],
    postureScore < ruleSet.posture.warning
      ? "상체를 조금 더 세워주세요."
      : "손 높이와 턱 위치가 잘 맞고 있습니다.",
  ];
  if (thresholdSummary.failedChecks.length > 0) {
    thresholdSummary.failedChecks.slice(0, 2).forEach((item) => {
      if (item?.message && !feedbackItems.includes(item.message)) {
        feedbackItems.push(item.message);
      }
    });
  }

  const baseMetrics = createMetricsFromScores({
    score: targetScore,
    accuracy: targetAccuracy,
    hp: targetHp,
    combo: targetCombo,
    postureScore,
    guardScore,
    balanceScore,
    reactionScore,
    message: coachMessage,
    source: "pose",
    lessonKey,
    lessonTitle: profile.title,
    lessonGoal: profile.goal,
    features: lessonFeatures,
    rawFeatureSnapshot: featureSnapshot,
    poseReady: true,
  });

  return {
    ...baseMetrics,
    features: lessonFeatures,
    thresholds,
    thresholdSummary,
    coachMessage,
    message: coachMessage,
    feedbackItems,
    feedback: cloneArray(feedbackItems),
    tipLevel:
      postureScore >= ruleSet.posture.good &&
      guardScore >= ruleSet.guard.good &&
      balanceScore >= ruleSet.balance.good &&
      reactionScore >= ruleSet.reaction.good
        ? "excellent"
        : baseMetrics.tipLevel,
  };
}

function scoreJabExtension(shoulder, elbow, wrist) {
  if (!shoulder || !elbow || !wrist) {
    return 45;
  }

  const reach = Math.hypot(wrist.x - shoulder.x, wrist.y - shoulder.y);
  const elbowAngle = angle(shoulder, elbow, wrist);
  const reachScore = clamp(Math.round(100 - Math.abs(reach - JAB_RULES.extension.reachTarget) * JAB_RULES.extension.reachWeight), 40, 98);
  const elbowScore = clamp(Math.round((elbowAngle - 90) * JAB_RULES.extension.elbowAngleWeight), 0, 100);
  const wristLiftScore = clamp(Math.round(100 - Math.abs(wrist.y - shoulder.y) * JAB_RULES.extension.wristLiftWeight), 40, 98);

  return clamp(Math.round(reachScore * 0.4 + elbowScore * 0.35 + wristLiftScore * 0.25 + 3), 40, 98);
}

function scoreCrossStrike(shoulder, elbow, wrist, hipMid, shoulderMid) {
  if (!shoulder || !elbow || !wrist) {
    return 45;
  }

  const reach = Math.hypot(wrist.x - shoulder.x, wrist.y - shoulder.y);
  const elbowAngle = angle(shoulder, elbow, wrist);
  const shoulderShift = shoulderMid ? Math.abs(shoulder.x - shoulderMid.x) : 0.04;
  const hipShift = hipMid ? Math.abs(shoulder.x - hipMid.x) : 0.04;
  const reachScore = clamp(Math.round(100 - Math.abs(reach - CROSS_RULES.strike.reachTarget) * CROSS_RULES.strike.reachWeight), 40, 98);
  const elbowScore = clamp(Math.round((elbowAngle - 95) * CROSS_RULES.strike.elbowAngleWeight), 0, 100);
  const wristLiftScore = clamp(Math.round(100 - Math.abs(wrist.y - shoulder.y) * CROSS_RULES.strike.wristLiftWeight), 40, 98);
  const rotationScore = clamp(Math.round(100 - (shoulderShift * CROSS_RULES.rotation.shoulderWeight + hipShift * CROSS_RULES.rotation.hipWeight)), 40, 98);

  return clamp(Math.round(reachScore * 0.33 + elbowScore * 0.22 + wristLiftScore * 0.15 + rotationScore * 0.30 + 3), 40, 98);
}

function createCrossMetrics(poseLandmarks, now = getMonotonicNow()) {
  const profile = getLessonProfile("cross");
  const featureSnapshot = getLandmarkGroup(poseLandmarks, now);
  const thresholds = getLessonThresholds("cross");
  const nose = featureSnapshot.nose;
  const leftShoulder = featureSnapshot.leftShoulder;
  const rightShoulder = featureSnapshot.rightShoulder;
  const leftElbow = featureSnapshot.leftElbow;
  const rightElbow = featureSnapshot.rightElbow;
  const leftWrist = featureSnapshot.leftWrist;
  const rightWrist = featureSnapshot.rightWrist;
  const leftHip = featureSnapshot.leftHip;
  const rightHip = featureSnapshot.rightHip;
  const leftKnee = featureSnapshot.leftKnee;
  const rightKnee = featureSnapshot.rightKnee;
  const leftAnkle = featureSnapshot.leftAnkle;
  const rightAnkle = featureSnapshot.rightAnkle;

  const shoulderMid = midpoint(leftShoulder, rightShoulder);
  const hipMid = midpoint(leftHip, rightHip);
  const kneeMid = midpoint(leftKnee, rightKnee);

  const leftStrikeScore = scoreCrossStrike(leftShoulder, leftElbow, leftWrist, hipMid, shoulderMid);
  const rightStrikeScore = scoreCrossStrike(rightShoulder, rightElbow, rightWrist, hipMid, shoulderMid);
  const activeSide = rightStrikeScore >= leftStrikeScore ? "right" : "left";
  const activeShoulder = activeSide === "right" ? rightShoulder : leftShoulder;
  const activeElbow = activeSide === "right" ? rightElbow : leftElbow;
  const activeWrist = activeSide === "right" ? rightWrist : leftWrist;
  const supportShoulder = activeSide === "right" ? leftShoulder : rightShoulder;
  const supportElbow = activeSide === "right" ? leftElbow : rightElbow;
  const supportWrist = activeSide === "right" ? leftWrist : rightWrist;
  const activeStrikeScore = activeSide === "right" ? rightStrikeScore : leftStrikeScore;

  const torsoLeanX = shoulderMid && hipMid ? Math.abs(shoulderMid.x - hipMid.x) : 0.1;
  const torsoLeanY = shoulderMid && hipMid ? Math.abs(shoulderMid.y - hipMid.y) : 0.08;
  const chinLift = nose && shoulderMid ? clamp((shoulderMid.y - nose.y - 0.035) * 100, 0, 12) : 6;
  const postureScore = clamp(
    Math.round(100 - torsoLeanX * CROSS_RULES.posture.leanWeightX - torsoLeanY * CROSS_RULES.posture.leanWeightY - chinLift * CROSS_RULES.posture.chinWeight),
    46,
    98,
  );

  const supportWristDrop = supportWrist && supportShoulder ? Math.max(0, supportWrist.y - supportShoulder.y) : 0.1;
  const supportElbowFlare =
    supportElbow && supportShoulder ? Math.max(0, Math.abs(supportElbow.x - supportShoulder.x) - 0.08) : 0.1;
  const faceLine = nose ? nose.y : shoulderMid?.y ?? 0.3;
  const supportFaceGap = supportWrist ? Math.max(0, supportWrist.y - faceLine - 0.02) : 0.1;
  const guardScore = clamp(
    Math.round(100 - supportWristDrop * 170 - supportElbowFlare * 115 - supportFaceGap * 135),
    44,
    98,
  );

  const stanceWidth = leftAnkle && rightAnkle ? Math.abs(leftAnkle.x - rightAnkle.x) : CROSS_RULES.balance.stanceIdeal;
  const stancePenalty = Math.abs(stanceWidth - CROSS_RULES.balance.stanceIdeal) * 170;
  const centerShift = shoulderMid && hipMid ? Math.abs(shoulderMid.x - hipMid.x) : 0.05;
  const centerPenalty = centerShift * CROSS_RULES.balance.centerShiftWeight;
  const kneeStability = kneeMid && hipMid ? Math.abs(kneeMid.x - hipMid.x) * 55 : 3;
  const balanceScore = clamp(Math.round(100 - stancePenalty - centerPenalty - kneeStability), 46, 98);

  const supportGuardLift = supportWrist && faceLine !== null ? Math.max(0, supportWrist.y - faceLine - 0.015) : 0.08;
  const activeElbowAngle = angle(activeShoulder, activeElbow, activeWrist);
  const rotationFocus = shoulderMid && hipMid ? Math.max(0, Math.abs(shoulderMid.x - hipMid.x) * 140 + Math.abs(shoulderMid.y - hipMid.y) * 100) : 10;
  const reactionScore = clamp(
    Math.round(
      70 +
        ((activeStrikeScore - CROSS_RULES.reaction.good) * 0.28) +
        ((activeElbowAngle - 140) * 0.14) +
        ((balanceScore - CROSS_RULES.reaction.good) * 0.12) +
        ((postureScore - CROSS_RULES.reaction.good) * 0.1),
    ),
    50,
    98,
  );

  const averageScore = (postureScore + guardScore + balanceScore + reactionScore + activeStrikeScore * 1.15 + clamp(100 - rotationFocus, 40, 98) * 0.9) / 5.95;
  const rawTargetScore = averageScore * 10;
  const rawTargetAccuracy = (averageScore * 0.45) + (activeStrikeScore * 0.35) + (balanceScore * 0.2);
  const targetHp = clamp(Math.round(98 - Math.max(0, 84 - averageScore) * 0.55 - Math.max(0, 76 - balanceScore) * 0.12), 45, 100);
  const targetCombo = clamp(Math.round((activeStrikeScore + reactionScore + balanceScore) / 42), 0, 9);

  const primaryBand =
    activeStrikeScore < CROSS_RULES.strike.warning
      ? "strike"
      : balanceScore < CROSS_RULES.balance.warning
        ? "balance"
        : guardScore < 70
          ? "guard"
          : postureScore < CROSS_RULES.posture.warning
            ? "posture"
            : reactionScore < CROSS_RULES.reaction.warning
              ? "reaction"
              : "ready";

  const messageMap = {
    strike: "크로스는 뒷손 회전과 몸통 연결이 중요합니다.",
    balance: "체중 이동 후 중심을 안정적으로 회복하세요.",
    guard: "반대손 가드를 높게 유지하며 타격하세요.",
    posture: "상체를 너무 앞으로 쏟지 말고 자세를 세워주세요.",
    reaction: "회전 후 바로 가드 복귀를 빠르게 맞춰보세요.",
    ready: "크로스가 안정적입니다. 회전과 복귀를 유지하세요.",
  };

  const feedbackMap = {
    strike: "뒷손을 더 자연스럽게 회전시켜 짧게 뻗어주세요.",
    balance: "체중을 실은 뒤 발바닥 전체로 중심을 회복하세요.",
    guard: "반대손은 광대 높이에서 유지하세요.",
    posture: "상체를 세우고 턱이 들리지 않게 정면을 보세요.",
    reaction: "타격 후 가드 복귀를 더 빠르게 맞춰보세요.",
    ready: "크로스의 회전과 복귀가 잘 연결되고 있습니다.",
  };

  const coachMessage = messageMap[primaryBand];
  const feedbackItems = [
    feedbackMap[primaryBand],
    activeStrikeScore < CROSS_RULES.strike.warning
      ? "뒷발을 밀어 골반 회전을 먼저 연결해보세요."
      : supportGuardLift > 0.03
        ? "가드를 더 높게 고정하고 타격하세요."
        : "가드 유지와 복귀가 안정적입니다.",
  ];
  const lessonFeatures = getLessonFeatureSummary("cross", featureSnapshot);
  const thresholdSummary = reconcileCrossThresholdSummary(
    evaluateThresholdSummary("cross", lessonFeatures),
    {
      postureScore,
      guardScore,
      balanceScore,
      reactionScore,
      activeStrikeScore,
    },
  );
  const targetScore = finalizeLessonScore(rawTargetScore, thresholdSummary);
  const targetAccuracy = finalizeLessonAccuracy(rawTargetAccuracy, thresholdSummary, 50);

  const baseMetrics = createMetricsFromScores({
    score: targetScore,
    accuracy: targetAccuracy,
    hp: targetHp,
    combo: targetCombo,
    postureScore,
    guardScore,
    balanceScore,
    reactionScore,
    message: coachMessage,
    source: "pose",
    lessonKey: state.lessonKey,
    lessonTitle: profile.title,
    lessonGoal: profile.goal,
    features: lessonFeatures,
    rawFeatureSnapshot: featureSnapshot,
    poseReady: true,
  });

  return {
    ...baseMetrics,
    features: lessonFeatures,
    thresholds,
    thresholdSummary,
    coachMessage,
    message: coachMessage,
    feedbackItems,
    feedback: cloneArray(feedbackItems),
    activeSide,
    activeStrikeScore,
    rotationFocus: clamp(Math.round(100 - rotationFocus), 40, 98),
    tipLevel:
      activeStrikeScore >= CROSS_RULES.strike.good &&
      balanceScore >= CROSS_RULES.balance.good &&
      postureScore >= CROSS_RULES.posture.good &&
      reactionScore >= CROSS_RULES.reaction.good
        ? "excellent"
        : baseMetrics.tipLevel,
    analysisLabel: `${profile.title} 분석`,
  };
}

function reconcileCrossThresholdSummary(thresholdSummary, scores) {
  const current = thresholdSummary || {
    canPass: false,
    quality: 0,
    matched: 0,
    total: 0,
    checks: [],
    failedChecks: [],
    detailedChecks: [],
  };

  const postureScore = toNumber(scores?.postureScore, 0);
  const guardScore = toNumber(scores?.guardScore, 0);
  const balanceScore = toNumber(scores?.balanceScore, 0);
  const reactionScore = toNumber(scores?.reactionScore, 0);
  const activeStrikeScore = toNumber(scores?.activeStrikeScore, 0);

  const scoreBasedPass =
    (activeStrikeScore >= 76 && balanceScore >= 76 && postureScore >= 58) ||
    (activeStrikeScore >= 72 && guardScore >= 78 && balanceScore >= 80) ||
    (activeStrikeScore >= 74 && reactionScore >= 68 && guardScore >= 74);

  const scoreQuality = clamp(
    (
      (activeStrikeScore / 100) * 0.35 +
      (balanceScore / 100) * 0.22 +
      (guardScore / 100) * 0.16 +
      (postureScore / 100) * 0.12 +
      (reactionScore / 100) * 0.15
    ),
    0,
    1,
  );

  if (!scoreBasedPass) {
    return {
      ...current,
      quality: Math.max(current.quality || 0, scoreQuality * 0.85),
    };
  }

  return {
    ...current,
    canPass: true,
    quality: Math.max(current.quality || 0, scoreQuality),
    failedChecks: [],
  };
}

function createLeftHookMetrics(poseLandmarks, now = getMonotonicNow()) {
  const profile = getLessonProfile("left-hook");
  const featureSnapshot = getLandmarkGroup(poseLandmarks, now);
  const thresholds = getLessonThresholds("left-hook");
  const nose = featureSnapshot.nose;
  const leftShoulder = featureSnapshot.leftShoulder;
  const rightShoulder = featureSnapshot.rightShoulder;
  const leftElbow = featureSnapshot.leftElbow;
  const rightElbow = featureSnapshot.rightElbow;
  const leftWrist = featureSnapshot.leftWrist;
  const rightWrist = featureSnapshot.rightWrist;
  const leftHip = featureSnapshot.leftHip;
  const rightHip = featureSnapshot.rightHip;
  const leftKnee = featureSnapshot.leftKnee;
  const rightKnee = featureSnapshot.rightKnee;
  const leftAnkle = featureSnapshot.leftAnkle;
  const rightAnkle = featureSnapshot.rightAnkle;

  const shoulderMid = midpoint(leftShoulder, rightShoulder);
  const hipMid = midpoint(leftHip, rightHip);
  const kneeMid = midpoint(leftKnee, rightKnee);

  const leftElbowAngle = angle(leftShoulder, leftElbow, leftWrist);
  const hookReach = leftShoulder && leftElbow && leftWrist ? Math.hypot(leftWrist.x - leftShoulder.x, leftWrist.y - leftShoulder.y) : 0.18;
  const elbowHeight = leftElbow && leftShoulder ? Math.max(0, leftShoulder.y - leftElbow.y) : 0.05;
  const wristLift = leftWrist && leftShoulder ? Math.max(0, leftShoulder.y - leftWrist.y) : 0.06;
  const swingWidthScore = clamp(Math.round(100 - Math.abs(hookReach - 0.22) * LEFT_HOOK_RULES.hook.swingWidthWeight), 40, 98);
  const elbowHeightScore = clamp(Math.round(100 - Math.abs(elbowHeight - 0.02) * LEFT_HOOK_RULES.hook.elbowHeightWeight), 40, 98);
  const wristLiftScore = clamp(Math.round(100 - Math.abs(wristLift - 0.03) * LEFT_HOOK_RULES.hook.wristLiftWeight), 40, 98);
  const hookScore = clamp(
    Math.round(
      swingWidthScore * 0.35 +
      elbowHeightScore * 0.3 +
      wristLiftScore * 0.15 +
      clamp((leftElbowAngle - 90) * LEFT_HOOK_RULES.hook.elbowAngleWeight, 0, 100) * 0.2,
    ),
    40,
    98,
  );

  const torsoLeanX = shoulderMid && hipMid ? Math.abs(shoulderMid.x - hipMid.x) : 0.1;
  const torsoLeanY = shoulderMid && hipMid ? Math.abs(shoulderMid.y - hipMid.y) : 0.08;
  const chinLift = nose && shoulderMid ? clamp((shoulderMid.y - nose.y - 0.035) * 100, 0, 12) : 6;
  const postureScore = clamp(
    Math.round(100 - torsoLeanX * LEFT_HOOK_RULES.posture.leanWeightX - torsoLeanY * LEFT_HOOK_RULES.posture.leanWeightY - chinLift * LEFT_HOOK_RULES.posture.chinWeight),
    46,
    98,
  );

  const rightWristDrop = rightWrist && rightShoulder ? Math.max(0, rightWrist.y - rightShoulder.y) : 0.1;
  const rightElbowFlare =
    rightElbow && rightShoulder ? Math.max(0, Math.abs(rightElbow.x - rightShoulder.x) - LEFT_HOOK_RULES.guard.tuckAllowance) : 0.1;
  const faceLine = nose ? nose.y : shoulderMid?.y ?? 0.3;
  const rightFaceGap = rightWrist ? Math.max(0, rightWrist.y - faceLine - 0.02) : 0.1;
  const wristVisibilityFactor = getVisibilityRelaxFactor([rightWrist, nose], 0.45);
  const elbowVisibilityFactor = getVisibilityRelaxFactor([rightElbow, rightShoulder], 0.45);
  const faceVisibilityFactor = getVisibilityRelaxFactor([nose, rightWrist], 0.45);
  const guardScore = clamp(
    Math.round(
      100 -
        rightWristDrop * LEFT_HOOK_RULES.guard.wristDropWeight * wristVisibilityFactor -
        rightElbowFlare * LEFT_HOOK_RULES.guard.elbowFlareWeight * elbowVisibilityFactor -
        rightFaceGap * LEFT_HOOK_RULES.guard.faceGapWeight * faceVisibilityFactor
    ),
    44,
    98,
  );

  const stanceWidth = leftAnkle && rightAnkle ? Math.abs(leftAnkle.x - rightAnkle.x) : LEFT_HOOK_RULES.balance.stanceIdeal;
  const stancePenalty = Math.abs(stanceWidth - LEFT_HOOK_RULES.balance.stanceIdeal) * 220;
  const centerShift = shoulderMid && hipMid ? Math.abs(shoulderMid.x - hipMid.x) : 0.05;
  const centerPenalty = centerShift * LEFT_HOOK_RULES.balance.centerShiftWeight;
  const kneeStability = kneeMid && hipMid ? Math.abs(kneeMid.x - hipMid.x) * 70 : 4;
  const balanceScore = clamp(Math.round(100 - stancePenalty - centerPenalty - kneeStability), 46, 98);

  const activeElbowAngle = angle(leftShoulder, leftElbow, leftWrist);
  const rotationFocus = shoulderMid && hipMid ? Math.max(0, Math.abs(shoulderMid.x - hipMid.x) * 130 + Math.abs(shoulderMid.y - hipMid.y) * 105) : 10;
  const reactionScore = clamp(
    Math.round(
      66 +
        ((hookScore - LEFT_HOOK_RULES.reaction.good) * 0.36) +
        ((activeElbowAngle - 105) * 0.18) +
        ((balanceScore - LEFT_HOOK_RULES.reaction.good) * 0.16) +
        ((postureScore - LEFT_HOOK_RULES.reaction.good) * 0.12),
    ),
    50,
    98,
  );

  const lessonFeatures = getLessonFeatureSummary("left-hook", featureSnapshot);
  const thresholdSummary = reconcileLeftHookThresholdSummary(
    evaluateThresholdSummary("left-hook", lessonFeatures),
    {
      postureScore,
      guardScore,
      balanceScore,
      reactionScore,
      hookScore,
    },
  );

  const averageScore = (postureScore + guardScore + balanceScore + reactionScore + hookScore + clamp(100 - rotationFocus, 40, 98)) / 6;
  const targetScore = finalizeLessonScore(averageScore * 10, thresholdSummary);
  const leftHookPassFloor = thresholdSummary.canPass
    ? 70 + Math.round(thresholdSummary.quality * 10)
    : 0;
  const rawTargetAccuracy = Math.round(Math.max(
      (averageScore * 0.48) + (hookScore * 0.32) + (balanceScore * 0.2),
      leftHookPassFloor,
    ));
  const targetAccuracy = thresholdSummary.canPass
    ? finalizeLessonAccuracy(rawTargetAccuracy, thresholdSummary, 50)
    : clamp(Math.min(rawTargetAccuracy, 69), 50, 99);
  const targetHp = clamp(Math.round(98 - Math.max(0, 88 - averageScore) * 0.6 - Math.max(0, 80 - balanceScore) * 0.15), 45, 100);
  const targetCombo = clamp(Math.round((hookScore + reactionScore + balanceScore) / 48), 0, 9);

  const failedCheckKeys = new Set(
    Array.isArray(thresholdSummary.failedChecks)
      ? thresholdSummary.failedChecks.map((item) => item?.key).filter(Boolean)
      : [],
  );
  const primaryBand =
    !thresholdSummary.canPass && (failedCheckKeys.has("rearGuardGap") || failedCheckKeys.has("wristHeightDiff"))
      ? "guard"
      : !thresholdSummary.canPass && (
          failedCheckKeys.has("elbowAngle") ||
          failedCheckKeys.has("elbowHeightRatio") ||
          failedCheckKeys.has("horizontalMoveRatio") ||
          hookScore < LEFT_HOOK_RULES.hook.warning
        )
      ? "hook"
      : balanceScore < LEFT_HOOK_RULES.balance.warning
        ? "balance"
        : guardScore < LEFT_HOOK_RULES.guard.warning
          ? "guard"
          : postureScore < LEFT_HOOK_RULES.posture.warning
            ? "posture"
            : reactionScore < LEFT_HOOK_RULES.reaction.warning
              ? "reaction"
              : "ready";

  const messageMap = {
    hook: "왼훅은 팔꿈치를 크게 벌리지 말고 짧게 회전하세요.",
    balance: "회전 후 중심을 빠르게 회복하세요.",
    guard: "반대손 가드를 높게 유지하세요.",
    posture: "상체를 너무 앞으로 쏟지 말고 자세를 세워주세요.",
    reaction: "훅 후 가드 복귀를 더 빠르게 맞춰보세요.",
    ready: "왼훅이 안정적입니다. 짧은 회전과 복귀를 유지하세요.",
  };

  const feedbackMap = {
    hook: "팔꿈치를 어깨 높이 근처에서 짧게 회전시켜 주세요.",
    balance: "체중을 실은 뒤 발바닥 전체로 중심을 회복하세요.",
    guard: "반대손은 광대 높이에서 유지하세요.",
    posture: "상체를 세우고 턱이 들리지 않게 정면을 보세요.",
    reaction: "타격 후 가드 복귀를 더 빠르게 맞춰보세요.",
    ready: "왼훅의 회전과 복귀가 잘 연결되고 있습니다.",
  };

  const coachMessage = messageMap[primaryBand];
  const failedFeedbackItems = Array.isArray(thresholdSummary.failedChecks)
    ? thresholdSummary.failedChecks
        .map((item) => item?.message)
        .filter(Boolean)
    : [];
  const feedbackItems = thresholdSummary.canPass
    ? [
        feedbackMap[primaryBand],
        "팔꿈치 높이와 가드 복귀가 안정적입니다.",
      ]
    : [
        feedbackMap[primaryBand],
        ...(failedFeedbackItems.length > 0 ? failedFeedbackItems.slice(0, 2) : ["가드 높이와 팔꿈치 각도를 다시 맞춰주세요."]),
      ];
  failedFeedbackItems.slice(2, 3).forEach((message) => {
    if (!feedbackItems.includes(message)) {
      feedbackItems.push(message);
    }
  });

  const baseMetrics = createMetricsFromScores({
    score: targetScore,
    accuracy: targetAccuracy,
    hp: targetHp,
    combo: targetCombo,
    postureScore,
    guardScore,
    balanceScore,
    reactionScore,
    message: coachMessage,
    source: "pose",
    lessonKey: state.lessonKey,
    lessonTitle: profile.title,
    lessonGoal: profile.goal,
    features: lessonFeatures,
    rawFeatureSnapshot: featureSnapshot,
    poseReady: true,
  });

  return {
    ...baseMetrics,
    features: lessonFeatures,
    thresholds,
    thresholdSummary,
    coachMessage,
    message: coachMessage,
    feedbackItems,
    feedback: cloneArray(feedbackItems),
    hookScore,
    rotationFocus: clamp(Math.round(100 - rotationFocus), 40, 98),
    tipLevel:
      hookScore >= LEFT_HOOK_RULES.hook.good &&
      balanceScore >= LEFT_HOOK_RULES.balance.good &&
      postureScore >= LEFT_HOOK_RULES.posture.good &&
      reactionScore >= LEFT_HOOK_RULES.reaction.good
        ? "excellent"
        : baseMetrics.tipLevel,
    analysisLabel: `${profile.title} 분석`,
  };
}

function reconcileLeftHookThresholdSummary(thresholdSummary, scores) {
  const current = thresholdSummary || {
    canPass: false,
    quality: 0,
    matched: 0,
    total: 0,
    checks: [],
    failedChecks: [],
    detailedChecks: [],
  };

  const postureScore = toNumber(scores?.postureScore, 0);
  const guardScore = toNumber(scores?.guardScore, 0);
  const balanceScore = toNumber(scores?.balanceScore, 0);
  const reactionScore = toNumber(scores?.reactionScore, 0);
  const hookScore = toNumber(scores?.hookScore, 0);

  const scoreQuality = clamp(
    (
      (hookScore / 100) * 0.36 +
      (balanceScore / 100) * 0.2 +
      (guardScore / 100) * 0.16 +
      (postureScore / 100) * 0.12 +
      (reactionScore / 100) * 0.16
    ),
    0,
    1,
  );
  const motionMatched = Array.isArray(current.checks)
    ? current.checks.some((item) => item && (item.key === "wristSpeed" || item.key === "wristTravelRatio") && item.matched)
    : false;
  const failedCheckKeys = new Set(
    Array.isArray(current.failedChecks)
      ? current.failedChecks.map((item) => item?.key).filter(Boolean)
      : [],
  );
  const criticalShapeFailed =
    failedCheckKeys.has("elbowAngle") ||
    failedCheckKeys.has("wristHeightDiff") ||
    failedCheckKeys.has("horizontalMoveRatio");

  const scoreBasedPass =
    !criticalShapeFailed &&
    motionMatched && (
      (hookScore >= 72 && reactionScore >= 60 && current.matched >= 3) ||
      (hookScore >= 76 && guardScore >= 52) ||
      (hookScore >= 68 && guardScore >= 44 && reactionScore >= 58 && current.matched >= 4) ||
      (hookScore >= 74 && (postureScore >= 46 || balanceScore >= 46))
    );

  if (!current.canPass && !scoreBasedPass) {
    return {
      ...current,
      quality: Math.max(current.quality || 0, scoreQuality * 0.9),
    };
  }

  return {
    ...current,
    canPass: true,
    quality: Math.max(current.quality || 0, scoreQuality, scoreBasedPass ? 0.72 : 0),
    failedChecks: [],
  };
}

function createSlipMetrics(poseLandmarks, now = getMonotonicNow()) {
  const profile = getLessonProfile("slip");
  const featureSnapshot = getLandmarkGroup(poseLandmarks, now);
  const thresholds = getLessonThresholds("slip");
  const nose = featureSnapshot.nose;
  const leftShoulder = featureSnapshot.leftShoulder;
  const rightShoulder = featureSnapshot.rightShoulder;
  const leftElbow = featureSnapshot.leftElbow;
  const rightElbow = featureSnapshot.rightElbow;
  const leftWrist = featureSnapshot.leftWrist;
  const rightWrist = featureSnapshot.rightWrist;
  const leftHip = featureSnapshot.leftHip;
  const rightHip = featureSnapshot.rightHip;
  const leftKnee = featureSnapshot.leftKnee;
  const rightKnee = featureSnapshot.rightKnee;
  const leftAnkle = featureSnapshot.leftAnkle;
  const rightAnkle = featureSnapshot.rightAnkle;

  const shoulderMid = midpoint(leftShoulder, rightShoulder);
  const hipMid = midpoint(leftHip, rightHip);
  const kneeMid = midpoint(leftKnee, rightKnee);
  const ankleMid = midpoint(leftAnkle, rightAnkle);

  const headShift = nose && shoulderMid ? Math.abs(nose.x - shoulderMid.x) * 300 + Math.abs(nose.y - shoulderMid.y) * 180 : 14;
  const torsoShift = shoulderMid && hipMid ? Math.abs(shoulderMid.x - hipMid.x) * 180 + Math.abs(shoulderMid.y - hipMid.y) * 120 : 12;
  const neckSafety = nose && shoulderMid ? clamp((shoulderMid.y - nose.y - 0.015) * 100, 0, 14) : 5;
  const evadeScore = clamp(Math.round(100 - headShift - torsoShift - neckSafety), 40, 98);

  const torsoLeanX = shoulderMid && hipMid ? Math.abs(shoulderMid.x - hipMid.x) : 0.1;
  const torsoLeanY = shoulderMid && hipMid ? Math.abs(shoulderMid.y - hipMid.y) : 0.08;
  const chinLift = nose && shoulderMid ? clamp((shoulderMid.y - nose.y - 0.035) * 100, 0, 12) : 6;
  const postureScore = clamp(
    Math.round(100 - torsoLeanX * SLIP_RULES.posture.leanWeightX - torsoLeanY * SLIP_RULES.posture.leanWeightY - chinLift * SLIP_RULES.posture.chinWeight),
    46,
    98,
  );

  const leftWristDrop = leftWrist && leftShoulder ? Math.max(0, leftWrist.y - leftShoulder.y) : 0.1;
  const rightWristDrop = rightWrist && rightShoulder ? Math.max(0, rightWrist.y - rightShoulder.y) : 0.1;
  const leftElbowFlare = leftElbow && leftShoulder ? Math.max(0, Math.abs(leftElbow.x - leftShoulder.x) - SLIP_RULES.guard.tuckAllowance) : 0.1;
  const rightElbowFlare = rightElbow && rightShoulder ? Math.max(0, Math.abs(rightElbow.x - rightShoulder.x) - SLIP_RULES.guard.tuckAllowance) : 0.1;
  const faceLine = nose ? nose.y : shoulderMid?.y ?? 0.3;
  const faceGap = nose && leftWrist && rightWrist ? Math.max(0, Math.min(leftWrist.y, rightWrist.y) - faceLine - 0.02) : 0.1;
  const guardScore = clamp(
    Math.round(100 - ((leftWristDrop + rightWristDrop) / 2) * SLIP_RULES.guard.wristDropWeight - ((leftElbowFlare + rightElbowFlare) / 2) * SLIP_RULES.guard.elbowFlareWeight - faceGap * SLIP_RULES.guard.faceGapWeight),
    44,
    98,
  );

  const stanceWidth = leftAnkle && rightAnkle ? Math.abs(leftAnkle.x - rightAnkle.x) : SLIP_RULES.balance.stanceIdeal;
  const stancePenalty = Math.abs(stanceWidth - SLIP_RULES.balance.stanceIdeal) * 220;
  const centerShift = shoulderMid && hipMid ? Math.abs(shoulderMid.x - hipMid.x) : 0.05;
  const centerPenalty = centerShift * SLIP_RULES.balance.centerShiftWeight;
  const kneeStability = kneeMid && hipMid ? Math.abs(kneeMid.x - hipMid.x) * SLIP_RULES.balance.kneeWeight : 4;
  const balanceScore = clamp(Math.round(100 - stancePenalty - centerPenalty - kneeStability), 46, 98);

  const evadeFocus = clamp(Math.round(evadeScore * 0.8 + balanceScore * 0.2), 40, 98);
  const reactionScore = clamp(
    Math.round(
      66 +
        ((evadeFocus - SLIP_RULES.reaction.good) * 0.38) +
        ((balanceScore - SLIP_RULES.reaction.good) * 0.2) +
        ((postureScore - SLIP_RULES.reaction.good) * 0.12),
    ),
    50,
    98,
  );

  const averageScore = (postureScore + guardScore + balanceScore + reactionScore + evadeScore) / 5;
  const rawTargetScore = averageScore * 10;
  const rawTargetAccuracy = (averageScore * 0.52) + (evadeFocus * 0.28) + (guardScore * 0.2);
  const targetHp = clamp(Math.round(98 - Math.max(0, 88 - averageScore) * 0.6 - Math.max(0, 80 - balanceScore) * 0.16), 45, 100);
  const targetCombo = clamp(Math.round((evadeFocus + reactionScore + balanceScore) / 48), 0, 9);

  const primaryBand =
    evadeScore < SLIP_RULES.evade.warning
      ? "evade"
      : balanceScore < SLIP_RULES.balance.warning
        ? "balance"
        : guardScore < SLIP_RULES.guard.warning
          ? "guard"
          : postureScore < SLIP_RULES.posture.warning
            ? "posture"
            : reactionScore < SLIP_RULES.reaction.warning
              ? "reaction"
              : "ready";

  const messageMap = {
    evade: "슬립은 머리를 크게 빼지 말고 짧게 피하세요.",
    balance: "피한 뒤에는 중심을 빠르게 회복하세요.",
    guard: "반대손 가드를 유지한 채 움직이세요.",
    posture: "상체를 너무 많이 흔들지 말고 자세를 세워주세요.",
    reaction: "슬립 후 바로 원래 자세로 복귀하세요.",
    ready: "슬립이 안정적입니다. 짧은 회피와 복귀를 유지하세요.",
  };

  const feedbackMap = {
    evade: "고개만 짧게 빼고 몸은 과하게 젖히지 마세요.",
    balance: "무릎을 약간 더 굽혀 중심을 안정적으로 잡아주세요.",
    guard: "반대손은 광대 높이에서 유지하세요.",
    posture: "상체를 세우고 턱이 들리지 않게 정면을 보세요.",
    reaction: "슬립 후 바로 원래 자세로 복귀하세요.",
    ready: "슬립의 회피와 복귀가 잘 연결되고 있습니다.",
  };

  const coachMessage = messageMap[primaryBand];
  const feedbackItems = [
    feedbackMap[primaryBand],
    evadeScore < SLIP_RULES.evade.warning
      ? "머리를 크게 빼지 말고 짧게 피해주세요."
      : "짧은 회피와 복귀가 안정적입니다.",
  ];
  const lessonFeatures = getLessonFeatureSummary("slip", featureSnapshot);
  const thresholdSummary = reconcileSlipThresholdSummary(
    evaluateThresholdSummary("slip", lessonFeatures),
    {
      postureScore,
      guardScore,
      balanceScore,
      reactionScore,
      evadeScore,
    },
  );
  const targetScore = finalizeLessonScore(rawTargetScore, thresholdSummary);
  const targetAccuracy = finalizeLessonAccuracy(rawTargetAccuracy, thresholdSummary, 50);

  const baseMetrics = createMetricsFromScores({
    score: targetScore,
    accuracy: targetAccuracy,
    hp: targetHp,
    combo: targetCombo,
    postureScore,
    guardScore,
    balanceScore,
    reactionScore,
    message: coachMessage,
    source: "pose",
    lessonKey: state.lessonKey,
    lessonTitle: profile.title,
    lessonGoal: profile.goal,
    features: lessonFeatures,
    rawFeatureSnapshot: featureSnapshot,
    poseReady: true,
  });

  return {
    ...baseMetrics,
    features: lessonFeatures,
    thresholds,
    thresholdSummary,
    coachMessage,
    message: coachMessage,
    feedbackItems,
    feedback: cloneArray(feedbackItems),
    evadeScore,
    rotationFocus: clamp(Math.round(100 - Math.max(0, headShift + torsoShift)), 40, 98),
    tipLevel:
      evadeScore >= SLIP_RULES.evade.good &&
      balanceScore >= SLIP_RULES.balance.good &&
      postureScore >= SLIP_RULES.posture.good &&
      reactionScore >= SLIP_RULES.reaction.good
        ? "excellent"
        : baseMetrics.tipLevel,
    analysisLabel: `${profile.title} 분석`,
  };
}

function reconcileSlipThresholdSummary(thresholdSummary, scores) {
  const current = thresholdSummary || {
    canPass: false,
    quality: 0,
    matched: 0,
    total: 0,
    checks: [],
    failedChecks: [],
    detailedChecks: [],
  };

  const postureScore = toNumber(scores?.postureScore, 0);
  const guardScore = toNumber(scores?.guardScore, 0);
  const balanceScore = toNumber(scores?.balanceScore, 0);
  const reactionScore = toNumber(scores?.reactionScore, 0);
  const evadeScore = toNumber(scores?.evadeScore, 0);

  const scoreQuality = clamp(
    (
      (evadeScore / 100) * 0.36 +
      (balanceScore / 100) * 0.22 +
      (reactionScore / 100) * 0.2 +
      (guardScore / 100) * 0.12 +
      (postureScore / 100) * 0.1
    ),
    0,
    1,
  );

  const movementMatched = Array.isArray(current.checks)
    ? current.checks.some((item) => item && item.key === "headMoveRatio" && item.matched)
    : false;

  const scoreBasedPass =
    movementMatched && (
      (evadeScore >= 70 && balanceScore >= 60 && reactionScore >= 60) ||
      (evadeScore >= 74 && guardScore >= 64) ||
      (evadeScore >= 68 && current.matched >= 3)
    );

  if (!current.canPass && !scoreBasedPass) {
    return {
      ...current,
      quality: Math.max(current.quality || 0, scoreQuality * 0.88),
    };
  }

  return {
    ...current,
    canPass: true,
    quality: Math.max(current.quality || 0, scoreQuality, scoreBasedPass ? 0.72 : 0),
    failedChecks: [],
  };
}

function createUppercutMetrics(poseLandmarks, now = getMonotonicNow()) {
  const profile = getLessonProfile("uppercut");
  const featureSnapshot = getLandmarkGroup(poseLandmarks, now);
  const thresholds = getLessonThresholds("uppercut");
  const nose = featureSnapshot.nose;
  const leftShoulder = featureSnapshot.leftShoulder;
  const rightShoulder = featureSnapshot.rightShoulder;
  const leftElbow = featureSnapshot.leftElbow;
  const rightElbow = featureSnapshot.rightElbow;
  const leftWrist = featureSnapshot.leftWrist;
  const rightWrist = featureSnapshot.rightWrist;
  const shoulderMid = featureSnapshot.shoulderMid;
  const hipMid = featureSnapshot.hipMid;

  const torsoLeanPenalty = shoulderMid && hipMid
    ? Math.abs(shoulderMid.x - hipMid.x) * 145 + Math.abs(shoulderMid.y - hipMid.y) * 102
    : 16;
  const postureScore = clamp(Math.round(100 - torsoLeanPenalty), 45, 98);

  const guardLiftPenalty = nose
    ? Math.max(0, Math.min((leftWrist?.y ?? nose.y), (rightWrist?.y ?? nose.y)) - nose.y) * 145
    : 8;
  const elbowSpreadPenalty = leftElbow && rightElbow && leftShoulder && rightShoulder
    ? (Math.max(0, Math.abs(leftElbow.x - leftShoulder.x)) + Math.max(0, Math.abs(rightElbow.x - rightShoulder.x))) * 88
    : 10;
  const guardScore = clamp(Math.round(100 - guardLiftPenalty - elbowSpreadPenalty), 45, 98);

  const kneeBend = featureSnapshot.kneeBend;
  const stanceStabilityPenalty = Math.abs(featureSnapshot.stanceWidthRatio - 1.45) * 42;
  const kneeBendPenalty = kneeBend < 10 ? (10 - kneeBend) * 2.8 : Math.max(0, kneeBend - 50) * 0.9;
  const balancePenalty = featureSnapshot.balanceOffset * 165 + stanceStabilityPenalty + kneeBendPenalty;
  const balanceScore = clamp(Math.round(100 - balancePenalty), 42, 98);

  const verticalMoveRatio = featureSnapshot.verticalMoveRatio;
  const wristSpeed = Math.max(featureSnapshot.leftWristSpeed, featureSnapshot.rightWristSpeed);
  const elbowAngle = Math.min(featureSnapshot.leftElbowAngle, featureSnapshot.rightElbowAngle);
  const torsoRise = clamp(featureSnapshot.torsoRise, 0, 2);

  const verticalScore = clamp(Math.round(58 + verticalMoveRatio * 62), 40, 98);
  const speedScore = clamp(Math.round(56 + wristSpeed * 24), 40, 98);
  const elbowCompactScore = clamp(Math.round(100 - Math.abs(elbowAngle - 88) * 1.05), 42, 98);
  const riseScore = clamp(Math.round(55 + torsoRise * 44), 40, 98);
  const reactionScore = clamp(
    Math.round(verticalScore * 0.34 + speedScore * 0.28 + elbowCompactScore * 0.22 + riseScore * 0.16),
    45,
    98,
  );

  const averageScore = (postureScore + guardScore + balanceScore + reactionScore) / 4;
  const rawTargetScore = averageScore * 10;
  const rawTargetAccuracy = (averageScore * 0.58) + (verticalScore * 0.22) + (elbowCompactScore * 0.2);
  const targetHp = clamp(Math.round(98 - Math.max(0, 82 - averageScore) * 0.55), 42, 100);
  const targetCombo = clamp(Math.round((reactionScore + verticalScore + speedScore) / 34), 0, 9);

  const lessonFeatures = getLessonFeatureSummary("uppercut", featureSnapshot);
  const thresholdSummary = reconcileUppercutThresholdSummary(
    evaluateThresholdSummary("uppercut", lessonFeatures),
    {
      postureScore,
      guardScore,
      balanceScore,
      reactionScore,
      verticalScore,
      speedScore,
      elbowCompactScore,
      riseScore,
    },
  );
  const targetScore = finalizeLessonScore(rawTargetScore, thresholdSummary);
  const targetAccuracy = finalizeLessonAccuracy(rawTargetAccuracy, thresholdSummary, 48);

  const primaryBand =
    verticalScore < 70
      ? "drive"
      : elbowCompactScore < 72
        ? "compact"
        : balanceScore < 68
          ? "balance"
          : guardScore < 70
            ? "guard"
            : "ready";

  const coachMessageMap = {
    drive: "무릎 반동을 더 쓰고 주먹을 아래에서 위로 짧게 올리세요.",
    compact: "팔을 크게 벌리지 말고 팔꿈치를 몸 가까이에 유지하세요.",
    balance: "상향 타격 후 중심이 흔들리지 않게 하체를 더 안정시키세요.",
    guard: "반대손 가드를 높게 유지한 채 어퍼컷을 연결하세요.",
    ready: "좋습니다. 짧고 빠른 어퍼컷 궤적을 유지하세요.",
  };

  const feedbackItems = [
    coachMessageMap[primaryBand],
    kneeBend < 12
      ? "무릎을 조금 더 굽혀 반동을 만들어주세요."
      : verticalMoveRatio < Math.max(0.24, thresholds.verticalMoveMinRatio * 1.7)
        ? "주먹 궤적을 더 분명하게 위로 올려보세요."
        : "타격 후 가드와 중심을 빠르게 회복하세요.",
  ];

  const baseMetrics = createMetricsFromScores({
    score: targetScore,
    accuracy: targetAccuracy,
    hp: targetHp,
    combo: targetCombo,
    postureScore,
    guardScore,
    balanceScore,
    reactionScore,
    message: coachMessageMap[primaryBand],
    source: "pose",
    lessonKey: "uppercut",
    lessonTitle: profile.title,
    lessonGoal: profile.goal,
    features: lessonFeatures,
    rawFeatureSnapshot: featureSnapshot,
    poseReady: true,
  });

  return {
    ...baseMetrics,
    features: lessonFeatures,
    thresholds,
    thresholdSummary,
    coachMessage: coachMessageMap[primaryBand],
    message: coachMessageMap[primaryBand],
    feedbackItems,
    feedback: cloneArray(feedbackItems),
    verticalScore,
    speedScore,
    elbowCompactScore,
    riseScore,
    tipLevel:
      verticalScore >= 78 &&
      elbowCompactScore >= 78 &&
      balanceScore >= 72 &&
      guardScore >= 72
        ? "excellent"
        : baseMetrics.tipLevel,
    analysisLabel: `${profile.title} 분석`,
  };
}

function reconcileUppercutThresholdSummary(thresholdSummary, scores) {
  const current = thresholdSummary || {
    canPass: false,
    quality: 0,
    matched: 0,
    total: 0,
    checks: [],
    failedChecks: [],
    detailedChecks: [],
  };

  const postureScore = toNumber(scores?.postureScore, 0);
  const guardScore = toNumber(scores?.guardScore, 0);
  const balanceScore = toNumber(scores?.balanceScore, 0);
  const reactionScore = toNumber(scores?.reactionScore, 0);
  const verticalScore = toNumber(scores?.verticalScore, 0);
  const speedScore = toNumber(scores?.speedScore, 0);
  const elbowCompactScore = toNumber(scores?.elbowCompactScore, 0);
  const riseScore = toNumber(scores?.riseScore, 0);

  const scoreQuality = clamp(
    (
      (verticalScore / 100) * 0.28 +
      (speedScore / 100) * 0.22 +
      (elbowCompactScore / 100) * 0.18 +
      (reactionScore / 100) * 0.14 +
      (balanceScore / 100) * 0.1 +
      (guardScore / 100) * 0.05 +
      (postureScore / 100) * 0.03
    ),
    0,
    1,
  );

  const liftMatched = Array.isArray(current.checks)
    ? current.checks.some((item) => item && (item.key === "verticalMoveRatio" || item.key === "torsoRise") && item.matched)
    : false;

  const scoreBasedPass =
    liftMatched && (
      (verticalScore >= 68 && speedScore >= 62 && reactionScore >= 60) ||
      (verticalScore >= 72 && elbowCompactScore >= 64) ||
      (verticalScore >= 66 && current.matched >= 4)
    );

  if (!current.canPass && !scoreBasedPass) {
    return {
      ...current,
      quality: Math.max(current.quality || 0, scoreQuality * 0.88),
    };
  }

  return {
    ...current,
    canPass: true,
    quality: Math.max(current.quality || 0, scoreQuality, scoreBasedPass ? 0.72 : 0),
    failedChecks: [],
  };
}

function createJabMetrics(poseLandmarks, now = getMonotonicNow()) {
  const profile = getLessonProfile("jab");
  const featureSnapshot = getLandmarkGroup(poseLandmarks, now);
  const thresholds = getLessonThresholds("jab");
  const nose = featureSnapshot.nose;
  const leftShoulder = featureSnapshot.leftShoulder;
  const rightShoulder = featureSnapshot.rightShoulder;
  const leftElbow = featureSnapshot.leftElbow;
  const rightElbow = featureSnapshot.rightElbow;
  const leftWrist = featureSnapshot.leftWrist;
  const rightWrist = featureSnapshot.rightWrist;
  const leftHip = featureSnapshot.leftHip;
  const rightHip = featureSnapshot.rightHip;
  const leftKnee = featureSnapshot.leftKnee;
  const rightKnee = featureSnapshot.rightKnee;
  const leftAnkle = featureSnapshot.leftAnkle;
  const rightAnkle = featureSnapshot.rightAnkle;

  const leftExtensionScore = scoreJabExtension(leftShoulder, leftElbow, leftWrist);
  const rightExtensionScore = scoreJabExtension(rightShoulder, rightElbow, rightWrist);
  const activeSide = leftExtensionScore >= rightExtensionScore ? "left" : "right";
  const activeShoulder = activeSide === "left" ? leftShoulder : rightShoulder;
  const activeElbow = activeSide === "left" ? leftElbow : rightElbow;
  const activeWrist = activeSide === "left" ? leftWrist : rightWrist;
  const supportShoulder = activeSide === "left" ? rightShoulder : leftShoulder;
  const supportElbow = activeSide === "left" ? rightElbow : leftElbow;
  const supportWrist = activeSide === "left" ? rightWrist : leftWrist;
  const activeExtensionScore = activeSide === "left" ? leftExtensionScore : rightExtensionScore;

  const shoulderMid = midpoint(leftShoulder, rightShoulder);
  const hipMid = midpoint(leftHip, rightHip);
  const kneeMid = midpoint(leftKnee, rightKnee);

  const torsoLeanX = shoulderMid && hipMid ? Math.abs(shoulderMid.x - hipMid.x) : 0.1;
  const torsoLeanY = shoulderMid && hipMid ? Math.abs(shoulderMid.y - hipMid.y) : 0.08;
  const chinLift = nose && shoulderMid ? clamp((shoulderMid.y - nose.y - 0.035) * 100, 0, 12) : 6;
  const postureScore = clamp(
    Math.round(100 - torsoLeanX * JAB_RULES.posture.leanWeightX - torsoLeanY * JAB_RULES.posture.leanWeightY - chinLift * JAB_RULES.posture.chinWeight),
    46,
    98,
  );

  const supportWristDrop = supportWrist && supportShoulder ? Math.max(0, supportWrist.y - supportShoulder.y) : 0.1;
  const supportElbowFlare =
    supportElbow && supportShoulder ? Math.max(0, Math.abs(supportElbow.x - supportShoulder.x) - JAB_RULES.guard.tuckAllowance) : 0.1;
  const faceLine = nose ? nose.y : shoulderMid?.y ?? 0.3;
  const supportFaceGap = supportWrist ? Math.max(0, supportWrist.y - faceLine - 0.02) : 0.1;
  const guardScore = clamp(
    Math.round(100 - supportWristDrop * JAB_RULES.guard.wristDropWeight - supportElbowFlare * JAB_RULES.guard.elbowFlareWeight - supportFaceGap * JAB_RULES.guard.faceGapWeight),
    44,
    98,
  );

  const stanceWidth = leftAnkle && rightAnkle ? Math.abs(leftAnkle.x - rightAnkle.x) : JAB_RULES.balance.stanceIdeal;
  const stancePenalty = Math.abs(stanceWidth - JAB_RULES.balance.stanceIdeal) * 170;
  const centerShift = shoulderMid && hipMid ? Math.abs(shoulderMid.x - hipMid.x) : 0.05;
  const centerPenalty = centerShift * JAB_RULES.balance.centerShiftWeight;
  const kneeStability = kneeMid && hipMid ? Math.abs(kneeMid.x - hipMid.x) * 55 : 3;
  const balanceScore = clamp(Math.round(100 - stancePenalty - centerPenalty - kneeStability), 46, 98);

  const supportGuardLift = supportWrist && faceLine !== null ? Math.max(0, supportWrist.y - faceLine - 0.015) : 0.08;
  const activeElbowAngle = angle(activeShoulder, activeElbow, activeWrist);
  const snapScore = clamp(Math.round((activeExtensionScore + guardScore + postureScore) / 3), 0, 100);
  const reactionScore = clamp(
    Math.round(
      70 +
        ((activeExtensionScore - JAB_RULES.reaction.good) * 0.28) +
        ((activeElbowAngle - 150) * 0.16) +
        ((guardScore - JAB_RULES.reaction.good) * 0.14) +
        ((postureScore - JAB_RULES.reaction.good) * 0.1),
    ),
    50,
    98,
  );

  const lessonFeatures = getLessonFeatureSummary("jab", featureSnapshot);
  const thresholdSummary = reconcileJabThresholdSummary(
    evaluateThresholdSummary("jab", lessonFeatures),
    {
      postureScore,
      guardScore,
      balanceScore,
      reactionScore,
      activeExtensionScore,
    },
  );

  const averageScore = (postureScore + guardScore + balanceScore + reactionScore + activeExtensionScore * 1.15) / 5.15;
  const targetScore = finalizeLessonScore(averageScore * 10, thresholdSummary);
  const jabPassFloor = thresholdSummary.canPass
    ? 76 + Math.round(thresholdSummary.quality * 12)
    : 0;
  const targetAccuracy = finalizeLessonAccuracy(
    Math.max(
      (averageScore * 0.5) + (snapScore * 0.5),
      jabPassFloor,
    ),
    thresholdSummary,
    50,
  );
  const targetHp = clamp(Math.round(98 - Math.max(0, 84 - averageScore) * 0.55 - Math.max(0, 76 - guardScore) * 0.1), 45, 100);
  const targetCombo = clamp(Math.round((activeExtensionScore + reactionScore + guardScore) / 42), 0, 9);

  const primaryBand =
    !thresholdSummary.canPass && activeExtensionScore < JAB_RULES.extension.warning
      ? "extension"
      : guardScore < JAB_RULES.guard.warning
        ? "guard"
        : postureScore < JAB_RULES.posture.warning
          ? "posture"
          : balanceScore < JAB_RULES.balance.warning
            ? "balance"
            : reactionScore < JAB_RULES.reaction.warning
              ? "reaction"
              : "ready";

  const messageMap = {
    extension: "앞손을 더 짧고 빠르게 뻗어주세요.",
    guard: "반대손 가드를 높게 유지하세요.",
    posture: "턱을 내리고 상체를 너무 앞으로 쏟지 마세요.",
    balance: "앞뒤 균형을 유지하며 중심을 흔들리지 않게 하세요.",
    reaction: "잽은 빠른 복귀가 핵심입니다. 리듬을 유지하세요.",
    ready: "잽이 깔끔합니다. 빠른 복귀를 유지하세요.",
  };

  const feedbackMap = {
    extension: "팔꿈치를 너무 크게 열지 말고 곧게 뻗어주세요.",
    guard: "반대손은 광대 높이에서 유지하세요.",
    posture: "상체를 세우고 턱이 들리지 않게 정면을 보세요.",
    balance: "발바닥 전체로 중심을 잡고 흔들림을 줄여보세요.",
    reaction: "앞손 복귀를 더 빠르고 짧게 맞춰보세요.",
    ready: "잽의 복귀와 가드 유지가 안정적입니다.",
  };

  const coachMessage = messageMap[primaryBand];
  const feedbackItems = [
    feedbackMap[primaryBand],
    !thresholdSummary.canPass && activeExtensionScore < JAB_RULES.extension.warning
      ? "앞손을 곧게 뻗은 뒤 즉시 복귀하세요."
      : supportGuardLift > 0.03
        ? "반대손 가드를 더 높게 고정하세요."
        : "가드와 복귀가 잘 맞고 있습니다.",
  ];
  const baseMetrics = createMetricsFromScores({
    score: targetScore,
    accuracy: targetAccuracy,
    hp: targetHp,
    combo: targetCombo,
    postureScore,
    guardScore,
    balanceScore,
    reactionScore,
    message: coachMessage,
    source: "pose",
    lessonKey: state.lessonKey,
    lessonTitle: profile.title,
    lessonGoal: profile.goal,
    features: lessonFeatures,
    rawFeatureSnapshot: featureSnapshot,
    poseReady: true,
  });

  return {
    ...baseMetrics,
    features: lessonFeatures,
    thresholds,
    thresholdSummary,
    coachMessage,
    message: coachMessage,
    feedbackItems,
    feedback: cloneArray(feedbackItems),
    activeSide,
    activeExtensionScore,
    snapScore,
    tipLevel:
      activeExtensionScore >= JAB_RULES.extension.good &&
      guardScore >= JAB_RULES.guard.good &&
      postureScore >= JAB_RULES.posture.good &&
      balanceScore >= JAB_RULES.balance.good &&
      reactionScore >= JAB_RULES.reaction.good
        ? "excellent"
        : thresholdSummary.canPass
          ? "warning"
        : baseMetrics.tipLevel,
    analysisLabel: `${profile.title} 분석`,
  };
}

function reconcileJabThresholdSummary(thresholdSummary, scores) {
  const current = thresholdSummary || {
    canPass: false,
    quality: 0,
    matched: 0,
    total: 0,
    checks: [],
    failedChecks: [],
    detailedChecks: [],
  };

  const postureScore = toNumber(scores?.postureScore, 0);
  const guardScore = toNumber(scores?.guardScore, 0);
  const balanceScore = toNumber(scores?.balanceScore, 0);
  const reactionScore = toNumber(scores?.reactionScore, 0);
  const activeExtensionScore = toNumber(scores?.activeExtensionScore, 0);
  const failedCheckKeys = new Set(
    Array.isArray(current.failedChecks)
      ? current.failedChecks.map((item) => item?.key).filter(Boolean)
      : [],
  );

  if (failedCheckKeys.has("oppositeGuardDistance")) {
    return {
      ...current,
      canPass: false,
      quality: Math.min(Math.max(current.quality || 0, 0.35), 0.62),
    };
  }

  const scoreBasedPass =
    (activeExtensionScore >= 76 && guardScore >= 78 && balanceScore >= 74) ||
    (activeExtensionScore >= 72 && guardScore >= 82 && balanceScore >= 82 && postureScore >= 58) ||
    (activeExtensionScore >= 74 && reactionScore >= 68 && guardScore >= 76);

  const scoreQuality = clamp(
    (
      (activeExtensionScore / 100) * 0.35 +
      (guardScore / 100) * 0.2 +
      (balanceScore / 100) * 0.2 +
      (postureScore / 100) * 0.1 +
      (reactionScore / 100) * 0.15
    ),
    0,
    1,
  );

  if (!scoreBasedPass) {
    return {
      ...current,
      quality: Math.max(current.quality || 0, scoreQuality * 0.85),
    };
  }

  return {
    ...current,
    canPass: true,
    quality: Math.max(current.quality || 0, scoreQuality),
    failedChecks: [],
  };
}

function createMetricsFromScores({
  scoreDelta,
  score,
  accuracy,
  hp,
  combo,
  postureScore,
  guardScore,
  balanceScore,
  reactionScore,
  message,
  source,
  lessonKey,
  lessonTitle,
  lessonGoal,
  features = {},
  rawFeatureSnapshot = null,
  poseReady = true,
}) {
  const profile = getLessonProfile(lessonKey);
  const feedbackItems = makeFeedbackItems(postureScore, guardScore, balanceScore, reactionScore, profile);

  const resolvedKey = normalizeLessonKey(lessonKey || state.lessonKey);
  const resolvedTitle = lessonTitle || profile.title;
  const avgScore = (postureScore + guardScore + balanceScore + reactionScore) / 4;
  const previous = ensureCurrentMetrics();
  const previousScore = Number.isFinite(previous.score) ? previous.score : 0;
  const previousAccuracy = Number.isFinite(previous.accuracy) ? previous.accuracy : 0;
  const previousHp = Number.isFinite(previous.hp) ? previous.hp : 0;
  const previousCombo = Number.isFinite(previous.combo) ? previous.combo : 0;
  const targetScore = clamp(toNumber(score, previousScore), 0, 1000);
  const targetAccuracy = clamp(toNumber(accuracy, previousAccuracy), 0, 100);
  const targetHp = clamp(toNumber(hp, previousHp), 0, 100);
  const targetCombo = clamp(toNumber(combo, previousCombo), 0, 9);
  const smoothScore = smoothTowards(previousScore, targetScore, 0.3, 0, 1000);
  const smoothAccuracy = smoothTowards(previousAccuracy, targetAccuracy, 0.25, 0, 100);
  const smoothHp = smoothTowards(previousHp, targetHp, 0.2, 0, 100);
  const smoothCombo = smoothTowards(previousCombo, targetCombo, 0.25, 0, 9);
  const tipLevel = avgScore >= 90 ? "excellent" : avgScore >= 75 ? "good" : avgScore >= 60 ? "warning" : "critical";
  const trend = smoothScore > previousScore + 2 ? "up" : smoothScore < previousScore - 2 ? "down" : "flat";
  const mode = source === "pose" ? "pose" : source === "dummy" ? "dummy" : "idle";
  const isRealPose = mode === "pose";
  const featureSnapshot = clonePlainObject(features);
  const actionClassification =
    isRealPose && rawFeatureSnapshot
      ? buildActionClassification(rawFeatureSnapshot)
      : createUnknownActionClassification(mode === "dummy" ? "dummy" : "not-pose");

  return {
    sequence: state.sequence,
    updatedAt: Date.now(),
    source,
    mode,
    isRealPose,
    lessonKey: resolvedKey,
    lessonTitle: resolvedTitle,
    lessonGoal: lessonGoal || profile.goal,
    scoreDelta: smoothScore - previousScore,
    score: smoothScore,
    accuracy: smoothAccuracy,
    hp: smoothHp,
    combo: smoothCombo,
    postureScore,
    guardScore,
    balanceScore,
    reactionScore,
    consistencyScore: clamp(Math.round((balanceScore + postureScore) / 2), 0, 100),
    speedScore: clamp(reactionScore, 0, 100),
    powerScore: clamp(Math.round((guardScore + postureScore) / 2), 0, 100),
    recoveryScore: clamp(Math.round((balanceScore + reactionScore) / 2), 0, 100),
    tipLevel,
    trend,
    analysisLabel: `${resolvedTitle} 분석`,
    message,
    coachMessage: message,
    detectedAction: actionClassification.detectedAction,
    detectedActionLabel: actionClassification.detectedActionLabel,
    actionConfidence: actionClassification.actionConfidence,
    actionReason: actionClassification.actionReason,
    actionScores: actionClassification.actionScores,
    actionCandidates: actionClassification.actionCandidates,
    classificationSnapshot: clonePlainObject(actionClassification.classificationSnapshot),
    currentFrameFeatures: clonePlainObject(actionClassification.currentFrameFeatures),
    currentFrameThresholdSummary: clonePlainObject(actionClassification.currentFrameThresholdSummary),
    peakActionFeatures: clonePlainObject(actionClassification.peakActionFeatures),
    peakActionThresholdSummaries: clonePlainObject(actionClassification.peakActionThresholdSummaries),
    feedbackItems,
    feedback: cloneArray(feedbackItems),
    poseReady,
    metrics: {
      score: smoothScore,
      accuracy: smoothAccuracy,
      hp: smoothHp,
      combo: smoothCombo,
      scoreDelta: smoothScore - previousScore,
      postureScore,
      guardScore,
      balanceScore,
      reactionScore,
      consistencyScore: clamp(Math.round((balanceScore + postureScore) / 2), 0, 100),
      speedScore: clamp(reactionScore, 0, 100),
      powerScore: clamp(Math.round((guardScore + postureScore) / 2), 0, 100),
      recoveryScore: clamp(Math.round((balanceScore + reactionScore) / 2), 0, 100),
      tipLevel,
      trend,
      poseReady,
      mode,
      source,
      isRealPose,
      detectedAction: actionClassification.detectedAction,
      actionConfidence: actionClassification.actionConfidence,
    },
    features: featureSnapshot,
  };
}

function createDummyMetrics() {
  const profile = getLessonProfile(state.lessonKey);
  const tick = state.tickCount + 1;
  const wave = Math.sin(tick / 2.8);
  const guardWave = Math.cos(tick / 3.1);
  const balanceWave = Math.sin(tick / 4.2 + 0.7);
  const reactionWave = Math.cos(tick / 2.5 + 0.4);
  const fatigue = Math.max(0, tick - 4) * 0.8;

  const postureScore = clamp(Math.round(82 + wave * 7 - fatigue * 0.2), 60, 98);
  const guardScore = clamp(Math.round(80 + guardWave * 8 - fatigue * 0.3), 58, 97);
  const balanceScore = clamp(Math.round(84 + balanceWave * 5 - fatigue * 0.15), 62, 98);
  const reactionScore = clamp(Math.round(78 + reactionWave * 6 - fatigue * 0.25), 55, 97);
  const averageScore = (postureScore + guardScore + balanceScore + reactionScore) / 4;
  const targetScore = clamp(Math.round(averageScore * 10), 0, 1000);
  const targetAccuracy = clamp(Math.round(averageScore + 2 + wave * 2), 50, 99);
  const targetHp = clamp(Math.round(100 - Math.max(0, tick - 1) * 1.2 + balanceScore / 50), 45, 100);
  const targetCombo = clamp(Math.max(0, Math.round((averageScore - 68) / 5) + (wave > 0.35 ? 1 : 0)), 0, 9);

  return createMetricsFromScores({
    score: targetScore,
    accuracy: targetAccuracy,
    hp: targetHp,
    combo: targetCombo,
    postureScore,
    guardScore,
    balanceScore,
    reactionScore,
    message: makeMessage(postureScore, guardScore, balanceScore, reactionScore, profile),
    source: "dummy",
    lessonKey: state.lessonKey,
    lessonTitle: profile.title,
    lessonGoal: profile.goal,
    poseReady: true,
  });
}

function createPoseMetrics(poseLandmarks, now = getMonotonicNow()) {
  const profile = getLessonProfile(state.lessonKey);
  if (isBasicGuardFamily(state.lessonKey)) {
    return createBasicGuardMetrics(state.lessonKey, poseLandmarks, now);
  }
  if (state.lessonKey === "jab") {
    return createJabMetrics(poseLandmarks, now);
  }
  if (state.lessonKey === "cross") {
    return createCrossMetrics(poseLandmarks, now);
  }
  if (state.lessonKey === "left-hook") {
    return createLeftHookMetrics(poseLandmarks, now);
  }
  if (state.lessonKey === "slip") {
    return createSlipMetrics(poseLandmarks, now);
  }
  if (state.lessonKey === "uppercut") {
    return createUppercutMetrics(poseLandmarks, now);
  }

  const featureSnapshot = getLandmarkGroup(poseLandmarks, now);
  const thresholds = getLessonThresholds(state.lessonKey);
  const nose = featureSnapshot.nose;
  const leftShoulder = featureSnapshot.leftShoulder;
  const rightShoulder = featureSnapshot.rightShoulder;
  const leftElbow = featureSnapshot.leftElbow;
  const rightElbow = featureSnapshot.rightElbow;
  const leftWrist = featureSnapshot.leftWrist;
  const rightWrist = featureSnapshot.rightWrist;
  const leftHip = featureSnapshot.leftHip;
  const rightHip = featureSnapshot.rightHip;
  const leftKnee = featureSnapshot.leftKnee;
  const rightKnee = featureSnapshot.rightKnee;
  const leftAnkle = featureSnapshot.leftAnkle;
  const rightAnkle = featureSnapshot.rightAnkle;

  const shoulderMid = featureSnapshot.shoulderMid;
  const hipMid = featureSnapshot.hipMid;
  const kneeMid = featureSnapshot.kneeMid;
  const ankleMid = featureSnapshot.ankleMid;

  const torsoLean = shoulderMid && hipMid ? Math.abs(shoulderMid.x - hipMid.x) * 180 + Math.abs(shoulderMid.y - hipMid.y) * 120 : 18;
  const postureScore = clamp(Math.round(100 - torsoLean), 48, 98);

  const leftGuard = leftWrist && leftShoulder ? Math.max(0, leftWrist.y - leftShoulder.y) : 0.08;
  const rightGuard = rightWrist && rightShoulder ? Math.max(0, rightWrist.y - rightShoulder.y) : 0.08;
  const faceLine = nose ? nose.y : shoulderMid?.y ?? 0.3;
  const guardPenalty = ((leftGuard + rightGuard) / 2 + Math.max(0, faceLine - Math.min(leftWrist?.y ?? faceLine, rightWrist?.y ?? faceLine))) * 160;
  const guardScore = clamp(Math.round(100 - guardPenalty), 42, 98);

  const legSpread = leftAnkle && rightAnkle ? Math.abs(leftAnkle.x - rightAnkle.x) : 0.18;
  const verticalStack = kneeMid && hipMid ? Math.abs(kneeMid.x - hipMid.x) * 140 : 10;
  const balanceScore = clamp(Math.round(100 - verticalStack + legSpread * 40), 46, 98);

  const leftElbowAngle = angle(leftShoulder, leftElbow, leftWrist);
  const rightElbowAngle = angle(rightShoulder, rightElbow, rightWrist);
  const reactionSeed = ((leftElbowAngle + rightElbowAngle) / 2 - 90) / 2;
  const reactionScore = clamp(Math.round(78 + reactionSeed), 50, 98);

  const averageScore = (postureScore + guardScore + balanceScore + reactionScore) / 4;
  const targetScore = clamp(Math.round(averageScore * 10), 0, 1000);
  const targetAccuracy = clamp(Math.round(averageScore), 50, 99);
  const targetHp = clamp(Math.round(100 - Math.max(0, 90 - averageScore) * 0.6), 45, 100);
  const targetCombo = clamp(Math.round((guardScore + reactionScore) / 30), 0, 9);
  const lessonFeatures = getLessonFeatureSummary(state.lessonKey, featureSnapshot);
  const thresholdSummary = evaluateThresholdSummary(state.lessonKey, lessonFeatures);
  const baseMetrics = createMetricsFromScores({
    score: targetScore,
    accuracy: targetAccuracy,
    hp: targetHp,
    combo: targetCombo,
    postureScore,
    guardScore,
    balanceScore,
    reactionScore,
    message: makeMessage(postureScore, guardScore, balanceScore, reactionScore, profile),
    source: "pose",
    lessonKey: state.lessonKey,
    lessonTitle: profile.title,
    lessonGoal: profile.goal,
    features: lessonFeatures,
    rawFeatureSnapshot: featureSnapshot,
    poseReady: true,
  });

  return {
    ...baseMetrics,
    features: lessonFeatures,
    thresholds,
    thresholdSummary,
  };
}

function emitUpdate(metrics) {
  const snapshot = cloneMetrics(metrics);
  state.updateListeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch (error) {
      console.error("PoseAnalyzer update listener failed:", error);
    }
  });

  if (snapshot.feedbackItems.length > 0) {
    state.feedbackListeners.forEach((listener) => {
      try {
        listener(cloneMetrics(snapshot));
      } catch (error) {
        console.error("PoseAnalyzer feedback listener failed:", error);
      }
    });
  }
}

function advanceDummyFrame() {
  state.tickCount += 1;
  state.sequence += 1;
  state.lastUpdateAt = getMonotonicNow();
  state.currentMetrics = createDummyMetrics();
  emitUpdate(state.currentMetrics);
  return state.currentMetrics;
}

function extractContextPoseLandmarks(context) {
  const candidates = [
    context?.poseLandmarks,
    context?.landmarks,
    context?.pose,
    globalScope.IM_BOXER_POSE_LANDMARKS,
  ];

  for (const candidate of candidates) {
    if (isPoseLikePayload(candidate)) {
      return candidate;
    }
  }

  return null;
}

function applyPoseFrame(poseLandmarks, now = getMonotonicNow()) {
  state.running = true;
  state.paused = false;

  if (!state.startedAt) {
    state.startedAt = now;
  }

  state.sequence += 1;
  state.lastUpdateAt = now;
  state.currentMetrics = createPoseMetrics(poseLandmarks, now);
  if (state.currentMetrics?.source === "pose" && state.currentMetrics?.isRealPose) {
    const featureSnapshot = getLandmarkGroup(poseLandmarks, now);
    state.recentFeatureSnapshots.push(clonePlainObject(featureSnapshot));
    state.recentFeatureSnapshots = state.recentFeatureSnapshots.slice(-ACTION_HISTORY_LIMIT);
  }
  state.lastPoseLandmarks = clonePoseLandmarks(poseLandmarks);
  state.lastPoseAt = now;
  emitUpdate(state.currentMetrics);
  return getCurrentMetrics();
}

function syncContext(context) {
  const now = typeof context?.now === "number" ? context.now : Date.now();
  const trainingState = context?.state?.trainingState;
  const lessonKey = normalizeLessonKey(context?.lessonKey || state.lessonKey);
  const poseLandmarks = extractContextPoseLandmarks(context);

  if (lessonKey !== state.lessonKey) {
    state.lessonKey = lessonKey;
    if (state.sequence === 0) {
      state.currentMetrics = createBaselineMetrics();
    }
  }

  // 탭 전환/일시정지 후 재개 시, 멈춰 있던 시간은 누적하지 않는다.
  if (state.lastInvocationAt && now - state.lastInvocationAt > UPDATE_INTERVAL_MS * 1.75) {
    state.lastUpdateAt = now;
  }
  state.lastInvocationAt = now;

  if (trainingState !== "active") {
    state.paused = true;
    return getCurrentMetrics();
  }

  if (poseLandmarks) {
    return applyPoseFrame(poseLandmarks, now);
  }

  state.running = true;
  state.paused = false;

  if (!state.startedAt) {
    state.startedAt = now;
  }

  if (!state.lastUpdateAt) {
    state.lastUpdateAt = now;
  }

  const elapsedSinceUpdate = now - state.lastUpdateAt;
  if (elapsedSinceUpdate >= UPDATE_INTERVAL_MS) {
    const steps = Math.max(1, Math.floor(elapsedSinceUpdate / UPDATE_INTERVAL_MS));
    for (let index = 0; index < steps; index += 1) {
      advanceDummyFrame();
    }
    state.lastUpdateAt += steps * UPDATE_INTERVAL_MS;
  }

  return getCurrentMetrics();
}

function start() {
  state.running = true;
  state.paused = false;
  if (!state.startedAt) {
    state.startedAt = getMonotonicNow();
  }
  state.lastUpdateAt = getMonotonicNow();

  // 시작 직후 한 번은 바로 값을 보여준다.
  if (state.sequence === 0) {
    advanceDummyFrame();
  }

  return getCurrentMetrics();
}

function pause() {
  state.running = false;
  state.paused = true;
  return getCurrentMetrics();
}

function resume() {
  state.running = true;
  state.paused = false;
  state.lastUpdateAt = getMonotonicNow();
  return getCurrentMetrics();
}

function stop() {
  state.running = false;
  state.paused = false;
  return getCurrentMetrics();
}

function reset() {
  state.running = false;
  state.paused = false;
  state.sequence = 0;
  state.tickCount = 0;
  state.deliveredSequence = 0;
  state.startedAt = 0;
  state.lastUpdateAt = 0;
  state.lastInvocationAt = 0;
  state.lessonKey = normalizeLessonKey(state.lessonKey);
  state.lastPoseLandmarks = null;
  state.lastPoseAt = 0;
  state.recentFeatureSnapshots = [];
  state.currentMetrics = createBaselineMetrics();
  return getCurrentMetrics();
}

function setLessonKey(value) {
  state.lessonKey = normalizeLessonKey(value);
  state.lastPoseLandmarks = null;
  state.lastPoseAt = 0;
  state.recentFeatureSnapshots = [];
  state.currentMetrics = createBaselineMetrics();
  state.deliveredSequence = 0;
  return getCurrentMetrics();
}

function getCurrentMetrics() {
  const snapshot = cloneMetrics(ensureCurrentMetrics());

  if (snapshot.sequence === state.deliveredSequence) {
    snapshot.scoreDelta = 0;
    return snapshot;
  }

  state.deliveredSequence = snapshot.sequence;
  return snapshot;
}

function onUpdate(callback) {
  if (typeof callback !== "function") {
    return () => {};
  }

  state.updateListeners.add(callback);
  callback(getCurrentMetrics());
  return () => {
    state.updateListeners.delete(callback);
  };
}

function onFeedback(callback) {
  if (typeof callback !== "function") {
    return () => {};
  }

  state.feedbackListeners.add(callback);
  const snapshot = getCurrentMetrics();
  if (snapshot.feedbackItems.length > 0) {
    callback(snapshot);
  }
  return () => {
    state.feedbackListeners.delete(callback);
  };
}

function isPoseLikePayload(source) {
  if (!source) {
    return false;
  }

  if (Array.isArray(source)) {
    return source.length > 0 && isLikelyPoint(source[0]);
  }

  if (typeof source === "object") {
    return ["nose", "leftShoulder", "rightShoulder", "leftHip", "rightHip", 0, 11, 12].some((key) => isLikelyPoint(source[key]));
  }

  return false;
}

function analyzePoseFrame(poseLandmarks) {
  // 실제 MediaPipe가 들어오면 이 메서드만 그대로 사용하면 된다.
  if (isPoseLikePayload(poseLandmarks)) {
    return applyPoseFrame(poseLandmarks);
  }

  // training.js가 보내는 것은 포즈 자체가 아니라 컨텍스트다.
  return syncContext(poseLandmarks);
}

function poseAnalyzerEntry(poseLandmarks) {
  return analyzePoseFrame(poseLandmarks);
}

poseAnalyzerEntry.start = start;
poseAnalyzerEntry.pause = pause;
poseAnalyzerEntry.resume = resume;
poseAnalyzerEntry.stop = stop;
poseAnalyzerEntry.reset = reset;
poseAnalyzerEntry.setLessonKey = setLessonKey;
poseAnalyzerEntry.getCurrentMetrics = getCurrentMetrics;
poseAnalyzerEntry.onUpdate = onUpdate;
poseAnalyzerEntry.onFeedback = onFeedback;
poseAnalyzerEntry.analyzePoseFrame = analyzePoseFrame;

reset();

globalScope.IM_BOXER_POSE_ANALYZER = poseAnalyzerEntry;

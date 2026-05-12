const globalScope = typeof window !== "undefined" ? window : globalThis;

const STORAGE_KEYS = {
  thresholds: "im_boxer_thresholds",
  accuracyLogs: "im_boxer_accuracy_logs",
};

const SUPPORTED_LESSONS = [
  "beginner-basic-guard",
  "jab",
  "cross",
  "left-hook",
  "slip",
  "uppercut",
];

const DEFAULT_THRESHOLDS = {
  "beginner-basic-guard": {
    guardWristToFaceMax: 0.47,
    elbowAngleMin: 70,
    elbowAngleMax: 120,
    shoulderLevelDiffMax: 0.12,
    kneeAngleMin: 96,
    kneeAngleMax: 168,
    stanceWidthMinRatio: 0.8,
    stanceWidthMaxRatio: 1.65,
    balanceOffsetMax: 0.4,
  },
  jab: {
    elbowExtensionMin: 130,
    wristSpeedMin: 0.17,
    wristTravelMinRatio: 0.05,
    shoulderForwardMin: 0.03,
    oppositeGuardMaxDistance: 0.1,
    returnTimeMax: 0.75,
  },
  cross: {
    elbowExtensionMin: 125,
    wristSpeedMin: 0.28,
    shoulderRotationMin: 6,
    hipRotationMin: 4,
    balanceOffsetMax: 0.3,
  },
  "left-hook": {
    elbowAngleMin: 80,
    elbowAngleMax: 150,
    wristHeightDiffMax: 0.1,
    horizontalMoveMinRatio: 0.08,
    wristSpeedMin: 0,
    wristTravelMinRatio: 0,
    torsoRotationMin: 0,
    elbowHeightMinRatio: 0,
    rearGuardGapMax: 1.4,
  },
  slip: {
    headMoveMinRatio: 0.12,
    heightChangeMax: 0.14,
    kneeAngleMin: 135,
    kneeAngleMax: 178,
    balanceOffsetMax: 0.2,
  },
  uppercut: {
    verticalMoveMinRatio: 0.12,
    wristSpeedMin: 0.16,
    elbowAngleMin: 42,
    elbowAngleMax: 140,
    kneeBendMin: 5,
    kneeBendMax: 135,
    torsoRiseMin: 0.02,
  },
};

const LESSON_FEATURE_KEYS = {
  "beginner-basic-guard": {
    guardWristToFaceMax: "guardWristToFace",
    elbowAngleMin: "elbowAngle",
    elbowAngleMax: "elbowAngle",
    shoulderLevelDiffMax: "shoulderLevelDiff",
    kneeAngleMin: "kneeAngle",
    kneeAngleMax: "kneeAngle",
    stanceWidthMinRatio: "stanceWidthRatio",
    stanceWidthMaxRatio: "stanceWidthRatio",
    balanceOffsetMax: "balanceOffset",
  },
  jab: {
    elbowExtensionMin: "elbowExtension",
    wristSpeedMin: "wristSpeed",
    wristTravelMinRatio: "wristTravelRatio",
    shoulderForwardMin: "shoulderForward",
    oppositeGuardMaxDistance: "oppositeGuardDistance",
    returnTimeMax: "returnTime",
  },
  cross: {
    elbowExtensionMin: "elbowExtension",
    wristSpeedMin: "wristSpeed",
    shoulderRotationMin: "shoulderRotation",
    hipRotationMin: "hipRotation",
    balanceOffsetMax: "balanceOffset",
  },
  "left-hook": {
    elbowAngleMin: "elbowAngle",
    elbowAngleMax: "elbowAngle",
    wristHeightDiffMax: "wristHeightDiff",
    horizontalMoveMinRatio: "horizontalMoveRatio",
    wristSpeedMin: "wristSpeed",
    wristTravelMinRatio: "wristTravelRatio",
    torsoRotationMin: "torsoRotation",
    elbowHeightMinRatio: "elbowHeightRatio",
    rearGuardGapMax: "rearGuardGap",
  },
  slip: {
    headMoveMinRatio: "headMoveRatio",
    heightChangeMax: "heightChange",
    kneeAngleMin: "kneeAngle",
    kneeAngleMax: "kneeAngle",
    balanceOffsetMax: "balanceOffset",
  },
  uppercut: {
    verticalMoveMinRatio: "verticalMoveRatio",
    wristSpeedMin: "wristSpeed",
    elbowAngleMin: "elbowAngle",
    elbowAngleMax: "elbowAngle",
    kneeBendMin: "kneeBend",
    kneeBendMax: "kneeBend",
    torsoRiseMin: "torsoRise",
  },
};

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function clone(value) {
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(value);
    } catch {
      // fall through to JSON clone
    }
  }

  return JSON.parse(JSON.stringify(value));
}

function getNow() {
  return Date.now();
}

function normalizeLessonKey(value) {
  const key = String(value || "").trim();
  if (key === "basic-guard" || key === "real-fight-guard") {
    return "beginner-basic-guard";
  }
  return SUPPORTED_LESSONS.includes(key) ? key : key;
}

function normalizeLabel(value) {
  const label = String(value || "unknown").toLowerCase().trim();
  if (!label) {
    return "unknown";
  }
  if (label === "unknown") {
    return "unknown";
  }
  if (label === "incorrect" || label.startsWith("incorrect")) {
    return "incorrect";
  }
  if (label === "correct" || label.startsWith("correct")) {
    return "correct";
  }
  return "unknown";
}

function normalizeSource(value) {
  const source = String(value || "unknown").toLowerCase().trim();
  if (source === "pose" || source === "dummy") {
    return source;
  }
  return "unknown";
}

function normalizePreviewImage(value) {
  const previewImage = String(value || "").trim();
  if (!previewImage) {
    return "";
  }

  if (!/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(previewImage)) {
    return "";
  }

  return previewImage;
}

function normalizeFeatureMap(features) {
  if (!isPlainObject(features)) {
    return {};
  }

  const normalized = clone(features);
  const balanceOffset = toNumber(normalized.balanceOffset, NaN);

  // Older logs stored balanceOffset on a 0-100 scale while thresholds use raw ratios.
  if (Number.isFinite(balanceOffset) && balanceOffset > 2) {
    normalized.balanceOffset = Number((balanceOffset / 100).toFixed(3));
  } else if (Number.isFinite(balanceOffset)) {
    normalized.balanceOffset = Number(balanceOffset.toFixed(3));
  }

  return normalized;
}

function pickPreviewSource(sample) {
  return (
    sample?.previewImage ||
    sample?.thumbnail ||
    sample?.image ||
    sample?.photo ||
    sample?.snapshot ||
    ""
  );
}

function createSampleId() {
  if (typeof globalScope.crypto?.randomUUID === "function") {
    try {
      return globalScope.crypto.randomUUID();
    } catch {
      // fall through
    }
  }

  return `${getNow()}-${Math.random().toString(16).slice(2, 10)}`;
}

function buildLegacySampleId(sample, index) {
  const timestamp = toNumber(sample?.timestamp, 0);
  const label = normalizeLabel(sample?.label);
  const source = normalizeSource(sample?.source);
  const accuracy = Number.isFinite(toNumber(sample?.accuracy, NaN))
    ? Math.round(toNumber(sample?.accuracy, 0))
    : "na";
  return `legacy-${index}-${timestamp}-${label}-${source}-${accuracy}`;
}

function normalizeStoredSampleForRead(sample, index) {
  if (!isPlainObject(sample)) {
    return null;
  }

  const normalized = clone(sample);
  if (!normalized.id) {
    normalized.id = buildLegacySampleId(normalized, index);
  }
  normalized.lessonKey = normalizeLessonKey(normalized.lessonKey);
  normalized.label = normalizeLabel(normalized.label);
  normalized.source = normalizeSource(normalized.source);
  normalized.isRealPose = normalized.isRealPose === true;
  normalized.timestamp = toNumber(normalized.timestamp, 0);
  normalized.accuracy = toNumber(normalized.accuracy, null);
  normalized.metrics = isPlainObject(normalized.metrics) ? clone(normalized.metrics) : {};
  normalized.features = normalizeFeatureMap(normalized.features);
  if (!normalized.previewImage) {
    normalized.previewImage = "";
  }
  return normalized;
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function getStorage() {
  try {
    if (typeof globalScope.localStorage === "undefined") {
      return null;
    }
    return globalScope.localStorage;
  } catch {
    return null;
  }
}

function readStorageObject(key, fallback) {
  const storage = getStorage();
  if (!storage) {
    return clone(fallback);
  }

  try {
    const raw = storage.getItem(key);
    if (!raw) {
      return clone(fallback);
    }
    const parsed = JSON.parse(raw);
    return isPlainObject(parsed) ? parsed : clone(fallback);
  } catch {
    return clone(fallback);
  }
}

function writeStorageObject(key, value) {
  const storage = getStorage();
  if (!storage) {
    return false;
  }

  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function removeStorageItem(key) {
  const storage = getStorage();
  if (!storage) {
    return false;
  }

  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function getDefaultThresholds() {
  return clone(DEFAULT_THRESHOLDS);
}

function mergeThresholdTree(base, patch) {
  const output = clone(base);
  if (!isPlainObject(patch)) {
    return output;
  }

  for (const [lessonKey, values] of Object.entries(patch)) {
    if (!isPlainObject(values)) {
      continue;
    }
    if (!output[lessonKey]) {
      output[lessonKey] = {};
    }
    for (const [thresholdKey, thresholdValue] of Object.entries(values)) {
      if (typeof thresholdValue === "number" && Number.isFinite(thresholdValue)) {
        output[lessonKey][thresholdKey] = thresholdValue;
      }
    }
  }

  return output;
}

function getThresholdState() {
  const fallback = { version: 1, updatedAt: 0, thresholds: {} };
  const stored = readStorageObject(STORAGE_KEYS.thresholds, fallback);
  return {
    version: toNumber(stored.version, 1) || 1,
    updatedAt: toNumber(stored.updatedAt, 0),
    thresholds: isPlainObject(stored.thresholds) ? stored.thresholds : {},
  };
}

function getAllThresholds() {
  const state = getThresholdState();
  return mergeThresholdTree(getDefaultThresholds(), state.thresholds);
}

function getThresholds(lessonKey) {
  const normalizedLessonKey = normalizeLessonKey(lessonKey);
  const allThresholds = getAllThresholds();
  const lessonThresholds = allThresholds[normalizedLessonKey];
  return isPlainObject(lessonThresholds) ? clone(lessonThresholds) : {};
}

function saveThresholds(thresholds) {
  const current = getThresholdState();
  const nextThresholds = {};

  if (isPlainObject(thresholds) && isPlainObject(thresholds.thresholds)) {
    for (const [lessonKey, values] of Object.entries(thresholds.thresholds)) {
      if (isPlainObject(values)) {
        nextThresholds[normalizeLessonKey(lessonKey)] = clone(values);
      }
    }
  } else if (isPlainObject(thresholds)) {
    for (const [lessonKey, values] of Object.entries(thresholds)) {
      if (lessonKey === "version" || lessonKey === "updatedAt") {
        continue;
      }
      if (isPlainObject(values)) {
        nextThresholds[normalizeLessonKey(lessonKey)] = clone(values);
      }
    }
  }

  const payload = {
    version: 1,
    updatedAt: getNow(),
    thresholds: nextThresholds,
  };

  writeStorageObject(STORAGE_KEYS.thresholds, payload);
  return clone(payload);
}

function updateThreshold(lessonKey, key, value) {
  const normalizedLessonKey = normalizeLessonKey(lessonKey);
  const state = getThresholdState();
  if (!state.thresholds[normalizedLessonKey]) {
    state.thresholds[normalizedLessonKey] = {};
  }

  const numericValue = toNumber(value, null);
  if (numericValue === null || !Number.isFinite(numericValue)) {
    return getThresholds(normalizedLessonKey);
  }

  state.thresholds[normalizedLessonKey][key] = numericValue;
  saveThresholds({ thresholds: state.thresholds });
  return getThresholds(normalizedLessonKey);
}

function resetThresholds() {
  const payload = {
    version: 1,
    updatedAt: getNow(),
    thresholds: {},
  };
  writeStorageObject(STORAGE_KEYS.thresholds, payload);
  return clone(payload);
}

function resetLessonThresholds(lessonKey) {
  const normalizedLessonKey = normalizeLessonKey(lessonKey);
  const state = getThresholdState();
  if (state.thresholds[normalizedLessonKey]) {
    delete state.thresholds[normalizedLessonKey];
  }
  return saveThresholds({ thresholds: state.thresholds });
}

function getAccuracyLogState() {
  const fallback = { version: 1, logs: {} };
  const stored = readStorageObject(STORAGE_KEYS.accuracyLogs, fallback);
  return {
    version: toNumber(stored.version, 1) || 1,
    logs: isPlainObject(stored.logs) ? stored.logs : {},
  };
}

function getAccuracyLogs(lessonKey) {
  const normalizedLessonKey = normalizeLessonKey(lessonKey);
  const state = getAccuracyLogState();
  const lessonLogs = Array.isArray(state.logs[normalizedLessonKey]) ? state.logs[normalizedLessonKey] : [];
  return lessonLogs
    .map((sample, index) => normalizeStoredSampleForRead(sample, index))
    .filter(Boolean);
}

function saveAccuracyLogs(logState) {
  const payload = {
    version: 1,
    logs: {},
  };

  if (isPlainObject(logState?.logs)) {
    for (const [lessonKey, samples] of Object.entries(logState.logs)) {
      if (Array.isArray(samples)) {
        payload.logs[normalizeLessonKey(lessonKey)] = samples.slice(-300).map((sample) => clone(sample));
      }
    }
  }

  writeStorageObject(STORAGE_KEYS.accuracyLogs, payload);
  return clone(payload);
}

function clearAccuracyLogs(lessonKey) {
  const normalizedLessonKey = normalizeLessonKey(lessonKey);
  const state = getAccuracyLogState();
  delete state.logs[normalizedLessonKey];
  return saveAccuracyLogs({ logs: state.logs });
}

function clearAllAccuracyLogs() {
  const payload = {
    version: 1,
    logs: {},
  };
  writeStorageObject(STORAGE_KEYS.accuracyLogs, payload);
  return clone(payload);
}

function sanitizeSample(sample) {
  if (!isPlainObject(sample)) {
    return null;
  }

  const source = normalizeSource(sample.source);
  const isRealPose = sample.isRealPose === true;
  const label = normalizeLabel(sample.label);
  const lessonKey = normalizeLessonKey(sample.lessonKey);
  const accuracy = toNumber(sample.accuracy, null);
  const previewImage = normalizePreviewImage(pickPreviewSource(sample));

  if (source !== "pose" || !isRealPose) {
    return null;
  }

  return {
    id: String(sample.id || createSampleId()),
    version: 1,
    lessonKey,
    timestamp: toNumber(sample.timestamp, getNow()),
    label,
    source,
    isRealPose: true,
    accuracy: accuracy === null ? null : accuracy,
    metrics: isPlainObject(sample.metrics) ? clone(sample.metrics) : {},
    features: normalizeFeatureMap(sample.features),
    previewImage,
  };
}

function shouldSkipRecommendation(lessonKey, thresholdKey) {
  if (lessonKey === "beginner-basic-guard" && thresholdKey === "guardWristToFaceMax") {
    return true;
  }

  return false;
}

function logAccuracySample(lessonKey, sample) {
  const normalizedLessonKey = normalizeLessonKey(lessonKey);
  const sanitized = sanitizeSample({
    ...sample,
    lessonKey: normalizedLessonKey,
  });

  if (!sanitized) {
    return false;
  }

  const state = getAccuracyLogState();
  const lessonLogs = Array.isArray(state.logs[normalizedLessonKey]) ? state.logs[normalizedLessonKey].slice() : [];
  lessonLogs.push(sanitized);
  state.logs[normalizedLessonKey] = lessonLogs.slice(-300);
  saveAccuracyLogs(state);
  return true;
}

function deleteAccuracySample(lessonKey, sampleId) {
  const normalizedLessonKey = normalizeLessonKey(lessonKey);
  const id = String(sampleId || "").trim();
  if (!id) {
    return false;
  }

  const state = getAccuracyLogState();
  const lessonLogs = Array.isArray(state.logs[normalizedLessonKey]) ? state.logs[normalizedLessonKey].slice() : [];
  const nextLogs = lessonLogs.filter((sample, index) => {
    const sampleIdValue = String(sample?.id || buildLegacySampleId(sample, index));
    return sampleIdValue !== id;
  });

  if (nextLogs.length === lessonLogs.length) {
    return false;
  }

  state.logs[normalizedLessonKey] = nextLogs;
  saveAccuracyLogs(state);
  return true;
}

function getLogSummary(lessonKey) {
  const logs = getAccuracyLogs(lessonKey);
  const total = logs.length;
  const correct = logs.filter((sample) => sample.label === "correct");
  const incorrect = logs.filter((sample) => sample.label === "incorrect");
  const unknown = logs.filter((sample) => sample.label === "unknown");
  const accuracies = logs.map((sample) => toNumber(sample.accuracy, NaN)).filter((value) => Number.isFinite(value));
  const averageAccuracy = accuracies.length
    ? accuracies.reduce((sum, value) => sum + value, 0) / accuracies.length
    : 0;
  const lastTimestamp = total ? toNumber(logs[total - 1].timestamp, 0) : 0;

  return {
    lessonKey: normalizeLessonKey(lessonKey),
    total,
    correctCount: correct.length,
    incorrectCount: incorrect.length,
    unknownCount: unknown.length,
    poseCount: logs.filter((sample) => sample.source === "pose" && sample.isRealPose === true).length,
    dummyCount: logs.filter((sample) => sample.source === "dummy").length,
    averageAccuracy: Number(averageAccuracy.toFixed(2)),
    lastTimestamp,
  };
}

function median(values) {
  const clean = values
    .map((value) => toNumber(value, NaN))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);

  if (clean.length === 0) {
    return null;
  }

  const mid = Math.floor(clean.length / 2);
  if (clean.length % 2 === 0) {
    return (clean[mid - 1] + clean[mid]) / 2;
  }
  return clean[mid];
}

function trimmedMean(values, trimRatio = 0.1) {
  const clean = values
    .map((value) => toNumber(value, NaN))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);

  if (clean.length === 0) {
    return null;
  }

  const trimCount = Math.floor(clean.length * trimRatio);
  const trimmed = clean.slice(trimCount, Math.max(trimCount + 1, clean.length - trimCount));
  if (trimmed.length === 0) {
    return median(clean);
  }

  const total = trimmed.reduce((sum, value) => sum + value, 0);
  return total / trimmed.length;
}

function getThresholdDirection(thresholdKey) {
  const key = String(thresholdKey || "");
  if (/Max(?:Ratio|Distance)?$/i.test(key)) {
    return "max";
  }
  if (/Min(?:Ratio|Distance)?$/i.test(key)) {
    return "min";
  }
  if (/Max$/i.test(key)) {
    return "max";
  }
  if (/Min$/i.test(key)) {
    return "min";
  }
  return "unknown";
}

function getPairedThresholdKey(thresholdKey) {
  const key = String(thresholdKey || "");
  if (/MinRatio$/i.test(key)) {
    return key.replace(/MinRatio$/i, "MaxRatio");
  }
  if (/MaxRatio$/i.test(key)) {
    return key.replace(/MaxRatio$/i, "MinRatio");
  }
  if (/MinDistance$/i.test(key)) {
    return key.replace(/MinDistance$/i, "MaxDistance");
  }
  if (/MaxDistance$/i.test(key)) {
    return key.replace(/MaxDistance$/i, "MinDistance");
  }
  if (/Min$/i.test(key)) {
    return key.replace(/Min$/i, "Max");
  }
  if (/Max$/i.test(key)) {
    return key.replace(/Max$/i, "Min");
  }
  return "";
}

function getFeatureKeyForThreshold(lessonKey, thresholdKey) {
  const lessonMap = LESSON_FEATURE_KEYS[lessonKey] || {};
  if (lessonMap[thresholdKey]) {
    return lessonMap[thresholdKey];
  }

  return String(thresholdKey)
    .replace(/MinRatio$/i, "Ratio")
    .replace(/MaxRatio$/i, "Ratio")
    .replace(/MinDistance$/i, "Distance")
    .replace(/MaxDistance$/i, "Distance")
    .replace(/Min$/i, "")
    .replace(/Max$/i, "");
}

function getLessonFeatureValues(lessonKey, samples, thresholdKey) {
  const featureKey = getFeatureKeyForThreshold(lessonKey, thresholdKey);
  const values = [];

  samples.forEach((sample) => {
    const featureValue = sample?.features?.[featureKey];
    const numericValue = toNumber(featureValue, NaN);
    if (Number.isFinite(numericValue)) {
      values.push(numericValue);
    }
  });

  return values;
}

function suggestThresholdAdjustments(lessonKey) {
  const normalizedLessonKey = normalizeLessonKey(lessonKey);
  const logs = getAccuracyLogs(normalizedLessonKey);
  const correctSamples = logs.filter((sample) => sample.label === "correct");
  const incorrectSamples = logs.filter((sample) => sample.label === "incorrect");

  if (correctSamples.length < 10 || incorrectSamples.length < 10) {
    return {
      canSuggest: false,
      reason: "correct/incorrect 샘플이 충분하지 않습니다.",
      correctCount: correctSamples.length,
      incorrectCount: incorrectSamples.length,
      recommendations: [],
    };
  }

  const currentThresholds = getThresholds(normalizedLessonKey);
  const recommendations = [];
  const lessonDefaults = DEFAULT_THRESHOLDS[normalizedLessonKey] || {};

  for (const thresholdKey of Object.keys(lessonDefaults)) {
    if (shouldSkipRecommendation(normalizedLessonKey, thresholdKey)) {
      continue;
    }

    const correctValues = getLessonFeatureValues(normalizedLessonKey, correctSamples, thresholdKey);
    const incorrectValues = getLessonFeatureValues(normalizedLessonKey, incorrectSamples, thresholdKey);
    const correctMedian = median(correctValues);
    const incorrectMedian = median(incorrectValues);

    if (!Number.isFinite(correctMedian) || !Number.isFinite(incorrectMedian)) {
      continue;
    }

    const current = toNumber(currentThresholds[thresholdKey], lessonDefaults[thresholdKey]);
    const direction = getThresholdDirection(thresholdKey);
    let suggested = (correctMedian + incorrectMedian) / 2;

    // If the observed medians move in the opposite direction of the threshold intent,
    // skip the recommendation because the feature is not separating correct/incorrect
    // in a trustworthy way.
    if (direction === "min" && correctMedian <= incorrectMedian) {
      continue;
    }
    if (direction === "max" && correctMedian >= incorrectMedian) {
      continue;
    }

    const pairedThresholdKey = getPairedThresholdKey(thresholdKey);
    const hasPairedThreshold =
      pairedThresholdKey &&
      Object.prototype.hasOwnProperty.call(lessonDefaults, pairedThresholdKey);

    if (hasPairedThreshold && (direction === "min" || direction === "max")) {
      const spread = Math.abs(correctMedian - incorrectMedian);
      const anchor = correctMedian;
      const halfGap = Math.max(
        spread * 0.25,
        Math.abs(anchor) * 0.05,
        0.01,
      );

      suggested = direction === "min"
        ? anchor - halfGap
        : anchor + halfGap;

      if (suggested <= 0 && thresholdKey.toLowerCase().includes("ratio")) {
        suggested = 0.01;
      }
    } else if (direction === "min") {
      suggested = (correctMedian * 0.65) + (incorrectMedian * 0.35);
      if (suggested < Math.min(correctMedian, incorrectMedian)) {
        suggested = (correctMedian + incorrectMedian) / 2;
      }
    } else if (direction === "max") {
      suggested = (correctMedian * 0.65) + (incorrectMedian * 0.35);
      if (suggested > Math.max(correctMedian, incorrectMedian)) {
        suggested = (correctMedian + incorrectMedian) / 2;
      }
    }

    const spread = Math.abs(correctMedian - incorrectMedian);
    const confidenceBase = spread / (Math.max(Math.abs(correctMedian), Math.abs(incorrectMedian), 1) + 1);
    const sampleFactor = Math.min(1, Math.min(correctSamples.length, incorrectSamples.length) / 20);
    const confidence = Number((Math.min(1, confidenceBase * 0.7 + sampleFactor * 0.3)).toFixed(2));

    recommendations.push({
      key: thresholdKey,
      current: Number.isFinite(current) ? current : lessonDefaults[thresholdKey],
      suggested: Number(toNumber(suggested, current).toFixed(4)),
      confidence,
      basedOn: `correct median ${Number(correctMedian.toFixed(4))}, incorrect median ${Number(incorrectMedian.toFixed(4))}`,
      direction,
      featureKey: getFeatureKeyForThreshold(normalizedLessonKey, thresholdKey),
    });
  }

  return {
    canSuggest: recommendations.length > 0,
    reason: recommendations.length > 0 ? "" : "추천할 threshold가 없습니다.",
    correctCount: correctSamples.length,
    incorrectCount: incorrectSamples.length,
    recommendations,
  };
}

const api = {
  getDefaultThresholds,
  getThresholds,
  getAllThresholds,
  saveThresholds,
  updateThreshold,
  resetThresholds,
  resetLessonThresholds,
  logAccuracySample,
  getAccuracyLogs,
  clearAccuracyLogs,
  clearAllAccuracyLogs,
  deleteAccuracySample,
  suggestThresholdAdjustments,
  getLogSummary,
  DEFAULT_THRESHOLDS: getDefaultThresholds(),
};

globalScope.IM_BOXER_THRESHOLD_MANAGER = api;
globalScope.IM_BOXER_THRESHOLD_DEFAULTS = api.DEFAULT_THRESHOLDS;

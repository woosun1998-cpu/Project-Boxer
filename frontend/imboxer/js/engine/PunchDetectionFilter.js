/**
 * 펀치 판정 필터 — 속도·가속도·방향·가드 우선순위
 *
 * speed = (손목 이동거리 / 어깨너비) / Δt(초)
 * acceleration = (현재 speed - 이전 speed) / Δt
 *
 * 민감도: 아래 Threshold 를 **올리면** 펀치로 인정되기 어려워집니다.
 * (예: PUNCH_SPEED_THRESHOLD 0.22 → 0.28 → 0.35)
 */

/** 1단계 — 최소 손목 속도 (어깨너비 대비 / 초) */
export const PUNCH_SPEED_THRESHOLD = 0.22;

/** 1단계 — 최소 가속도. 천천히 손을 올리면 통과하지 않음 */
export const PUNCH_ACCELERATION_THRESHOLD = 0.14;

/** 손 이동 방향이 어깨→손목(앞으로 뻗기)과 얼마나 일치하는지 (0~1) */
export const PUNCH_FORWARD_DOT_MIN = 0.42;

/** |세로속도|/|속도| 가 이 값보다 크면 위·아래 제스처로 간주해 제외 */
export const PUNCH_MAX_VERTICAL_DOMINANCE = 0.72;

/** 손목이 어깨보다 이만큼 위(y 작음)면 가드로 간주 */
export const GUARD_WRIST_ABOVE_SHOULDER = 0.1;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function distance2D(a, b) {
  if (!a || !b) return 0;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function getPoint(landmarks, index) {
  const lm = landmarks?.[index];
  if (!lm || (lm.visibility ?? 1) < 0.35) return null;
  return { x: lm.x, y: lm.y };
}

/** 양 손목이 일정 높이 이상 올라가 있으면 가드 */
export function isUserGuarding(landmarks) {
  const leftShoulder = getPoint(landmarks, 11);
  const rightShoulder = getPoint(landmarks, 12);
  const leftWrist = getPoint(landmarks, 15);
  const rightWrist = getPoint(landmarks, 16);
  if (!leftShoulder || !rightShoulder || !leftWrist || !rightWrist) {
    return false;
  }

  const shoulderMidY = (leftShoulder.y + rightShoulder.y) / 2;
  const guardLine = shoulderMidY + GUARD_WRIST_ABOVE_SHOULDER;
  return leftWrist.y < guardLine && rightWrist.y < guardLine;
}

function computeWristKinematics(wristNow, wristPrev, shoulderNow, prevSpeed, dtSec, shoulderSpan) {
  const span = Math.max(shoulderSpan, 0.001);
  const dt = Math.max(dtSec, 0.04);

  if (!wristNow || !wristPrev) {
    return { speed: 0, acceleration: 0, vx: 0, vy: 0, forwardDot: 0 };
  }

  const dx = wristNow.x - wristPrev.x;
  const dy = wristNow.y - wristPrev.y;
  const speed = distance2D(wristNow, wristPrev) / span / dt;

  const acceleration = (speed - toNumber(prevSpeed, 0)) / dt;

  const armDx = wristNow.x - (shoulderNow?.x ?? wristNow.x);
  const armDy = wristNow.y - (shoulderNow?.y ?? wristNow.y);
  const armLen = Math.hypot(armDx, armDy) || 0.001;
  const moveLen = Math.hypot(dx, dy) || 0.001;
  const forwardDot = clamp((dx * armDx + dy * armDy) / (moveLen * armLen), -1, 1);

  return { speed, acceleration, vx: dx / dt, vy: dy / dt, forwardDot };
}

function passesDirectionFilter(kinematics) {
  const speedLen = Math.hypot(kinematics.vx, kinematics.vy);
  if (speedLen < 1e-6) {
    return false;
  }

  const verticalRatio = Math.abs(kinematics.vy) / speedLen;
  if (verticalRatio > PUNCH_MAX_VERTICAL_DOMINANCE) {
    return false;
  }

  if (kinematics.forwardDot < PUNCH_FORWARD_DOT_MIN) {
    return false;
  }

  return true;
}

function passesPunchKinematics(kinematics) {
  if (kinematics.speed < PUNCH_SPEED_THRESHOLD) {
    return false;
  }
  if (kinematics.acceleration < PUNCH_ACCELERATION_THRESHOLD) {
    return false;
  }
  return passesDirectionFilter(kinematics);
}

/** motion sample 저장용 — 다음 프레임 가속도 계산에 사용 */
export function measureWristSpeeds(landmarks, previous, now) {
  if (!landmarks || !previous?.now) {
    return { leftWristSpeed: 0, rightWristSpeed: 0 };
  }
  const dtSec = Math.max(0.04, (now - previous.now) / 1000);
  const leftShoulder = getPoint(landmarks, 11);
  const rightShoulder = getPoint(landmarks, 12);
  const leftWrist = getPoint(landmarks, 15);
  const rightWrist = getPoint(landmarks, 16);
  const shoulderSpan = Math.max(
    distance2D(leftShoulder, rightShoulder),
    distance2D(previous.leftShoulder, previous.rightShoulder),
    0.001,
  );
  const leftKin = computeWristKinematics(
    leftWrist,
    previous.leftWrist,
    leftShoulder,
    previous.leftWristSpeed,
    dtSec,
    shoulderSpan,
  );
  const rightKin = computeWristKinematics(
    rightWrist,
    previous.rightWrist,
    rightShoulder,
    previous.rightWristSpeed,
    dtSec,
    shoulderSpan,
  );
  return {
    leftWristSpeed: leftKin.speed,
    rightWristSpeed: rightKin.speed,
  };
}

export function passesPunchFilter({ landmarks, previous, now, actionKey }) {
  if (!landmarks || !previous?.now) {
    return false;
  }
  if (isUserGuarding(landmarks)) {
    return false;
  }

  const dtSec = Math.max(0.04, (now - previous.now) / 1000);
  const leftShoulder = getPoint(landmarks, 11);
  const rightShoulder = getPoint(landmarks, 12);
  const leftWrist = getPoint(landmarks, 15);
  const rightWrist = getPoint(landmarks, 16);
  const shoulderSpan = Math.max(
    distance2D(leftShoulder, rightShoulder),
    distance2D(previous.leftShoulder, previous.rightShoulder),
    0.001,
  );

  const leftKin = computeWristKinematics(
    leftWrist,
    previous.leftWrist,
    leftShoulder,
    previous.leftWristSpeed,
    dtSec,
    shoulderSpan,
  );
  const rightKin = computeWristKinematics(
    rightWrist,
    previous.rightWrist,
    rightShoulder,
    previous.rightWristSpeed,
    dtSec,
    shoulderSpan,
  );

  if (actionKey === "jab") {
    return passesPunchKinematics(leftKin);
  }
  if (actionKey === "cross") {
    return passesPunchKinematics(rightKin);
  }
  if (actionKey === "hook") {
    const hookSide = leftKin.speed >= rightKin.speed ? leftKin : rightKin;
    return passesPunchKinematics(hookSide);
  }

  return passesPunchKinematics(leftKin) || passesPunchKinematics(rightKin);
}

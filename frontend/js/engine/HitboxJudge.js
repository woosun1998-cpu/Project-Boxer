// =============================================
// HitboxJudge.js
// Multi-landmark dodge judge for sparring attacks.
// =============================================

class HitboxJudge {
  constructor(config = {}) {
    this.hitboxRadius = config.radius ?? 0.15;
    this.centerX = config.centerX ?? 0.5;
    this.centerY = config.centerY ?? 0.5;
  }

  setRadius(nextRadius) {
    this.hitboxRadius = nextRadius ?? this.hitboxRadius;
  }

  judge(landmarks, attackProfile = {}, timingContext = {}) {
    const pose = this.getPoseReference(landmarks, timingContext);
    if (!pose.nose) return 'HIT';

    const profile = this.resolveAttackProfile(attackProfile);
    const referenceCenter = this.getReferenceCenter(profile, pose, timingContext);
    const displacement = this.computeDisplacement(pose, referenceCenter, timingContext);
    const shapeEscaped = this.hasEscapedHitbox(profile, pose, referenceCenter);
    const moveSatisfied = this.isRequiredMoveSatisfied(profile, displacement, pose, referenceCenter);

    if (profile.required_move === 'any') {
      return shapeEscaped ? 'DODGE' : 'HIT';
    }

    return shapeEscaped && moveSatisfied ? 'DODGE' : 'HIT';
  }

  resolveAttackProfile(attackProfile = {}) {
    const attackType = (attackProfile.attack_type || attackProfile.type || 'jab').toLowerCase();
    const fallbackRadius = Number(attackProfile.hitbox_radius ?? this.hitboxRadius ?? 0.15);
    const fallbackShape = attackType === 'hook' ? 'ellipse' : attackType === 'uppercut' ? 'lane' : 'circle';
    const fallbackMove =
      attackType === 'hook' ? 'slip_side' :
      attackType === 'uppercut' ? 'duck' :
      attackType === 'straight' ? 'lean_back' :
      'slip_side';

    return {
      attack_type: attackType,
      judge_shape: attackProfile.judge_shape || fallbackShape,
      required_move: attackProfile.required_move || fallbackMove,
      min_displacement: Number(attackProfile.min_displacement ?? 0.08),
      hitbox_radius: fallbackRadius,
      center_x: Number(attackProfile.center_x ?? this.centerX),
      center_y: Number(attackProfile.center_y ?? this.centerY)
    };
  }

  getPoseReference(landmarks, timingContext = {}) {
    // Legacy compatibility: allow judge(noseLandmark).
    const normalized = Array.isArray(landmarks) ? landmarks : this.wrapSingleLandmark(landmarks);
    const nose = this.getLandmark(normalized, 0);
    const leftShoulder = this.getLandmark(normalized, 11) || timingContext.left_shoulder || null;
    const rightShoulder = this.getLandmark(normalized, 12) || timingContext.right_shoulder || null;
    const shoulderCenter = this.averagePoint(leftShoulder, rightShoulder)
      || timingContext.shoulder_center
      || { x: this.centerX, y: this.centerY + 0.16 };
    const headCenter = this.averagePoint(nose, shoulderCenter)
      || timingContext.head_center
      || nose
      || { x: this.centerX, y: this.centerY };

    return {
      nose,
      left_shoulder: leftShoulder,
      right_shoulder: rightShoulder,
      shoulder_center: shoulderCenter,
      head_center: headCenter
    };
  }

  wrapSingleLandmark(landmark) {
    if (!landmark || typeof landmark.x !== 'number' || typeof landmark.y !== 'number') {
      return [];
    }
    return [{ x: landmark.x, y: landmark.y }];
  }

  getLandmark(landmarks, index) {
    const landmark = landmarks?.[index];
    if (!landmark || typeof landmark.x !== 'number' || typeof landmark.y !== 'number') {
      return null;
    }
    return landmark;
  }

  averagePoint(a, b) {
    if (!a || !b) return null;
    return {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2
    };
  }

  getReferenceCenter(profile, pose, timingContext = {}) {
    const referencePose = timingContext.referenceLandmarks
      ? this.getPoseReference(timingContext.referenceLandmarks, timingContext)
      : null;

    return {
      x: Number(referencePose?.head_center?.x ?? timingContext.referenceHeadCenter?.x ?? profile.center_x ?? this.centerX),
      y: Number(referencePose?.head_center?.y ?? timingContext.referenceHeadCenter?.y ?? profile.center_y ?? this.centerY),
      shoulderX: Number(referencePose?.shoulder_center?.x ?? timingContext.referenceShoulderCenter?.x ?? pose.shoulder_center?.x ?? this.centerX),
      shoulderY: Number(referencePose?.shoulder_center?.y ?? timingContext.referenceShoulderCenter?.y ?? pose.shoulder_center?.y ?? (this.centerY + 0.16))
    };
  }

  computeDisplacement(pose, referenceCenter, timingContext = {}) {
    const timingScale = Number(timingContext.displacementScale ?? 1);
    const noseDx = (pose.nose?.x ?? referenceCenter.x) - referenceCenter.x;
    const headDx = (pose.head_center?.x ?? referenceCenter.x) - referenceCenter.x;
    const headDy = (pose.head_center?.y ?? referenceCenter.y) - referenceCenter.y;
    const shoulderDx = (pose.shoulder_center?.x ?? referenceCenter.shoulderX) - referenceCenter.shoulderX;
    const shoulderDy = (pose.shoulder_center?.y ?? referenceCenter.shoulderY) - referenceCenter.shoulderY;

    return {
      noseDx: noseDx * timingScale,
      headDx: headDx * timingScale,
      headDy: headDy * timingScale,
      shoulderDx: shoulderDx * timingScale,
      shoulderDy: shoulderDy * timingScale,
      headDistance: Math.sqrt((headDx * headDx) + (headDy * headDy)),
      shoulderDistance: Math.sqrt((shoulderDx * shoulderDx) + (shoulderDy * shoulderDy))
    };
  }

  hasEscapedHitbox(profile, pose, referenceCenter) {
    const radius = Number(profile.hitbox_radius ?? this.hitboxRadius ?? 0.15);
    const point = profile.attack_type === 'uppercut' ? pose.head_center : (pose.head_center || pose.nose);
    if (!point) return false;

    switch (profile.judge_shape) {
      case 'ellipse':
        return this.isOutsideEllipse(point, referenceCenter, radius * 1.1, radius * 0.82);
      case 'lane':
        return this.isOutsideLane(point, referenceCenter, radius * 0.85, radius * 1.15);
      case 'circle':
      default:
        return this.isOutsideCircle(point, referenceCenter, radius);
    }
  }

  isOutsideCircle(point, center, radius) {
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    return Math.sqrt(dx * dx + dy * dy) > radius;
  }

  isOutsideEllipse(point, center, radiusX, radiusY) {
    const dx = (point.x - center.x) / Math.max(radiusX, 0.001);
    const dy = (point.y - center.y) / Math.max(radiusY, 0.001);
    return (dx * dx) + (dy * dy) > 1;
  }

  isOutsideLane(point, center, laneHalfWidth, laneHalfHeight) {
    const dx = Math.abs(point.x - center.x);
    const dy = Math.abs(point.y - center.y);
    return dx > laneHalfWidth || dy > laneHalfHeight;
  }

  isRequiredMoveSatisfied(profile, displacement, pose, referenceCenter) {
    const min = Number(profile.min_displacement ?? 0.08);
    const absHeadX = Math.abs(displacement.headDx);
    const absShoulderX = Math.abs(displacement.shoulderDx);
    const downAmount = displacement.headDy;
    const backLean = Math.abs((pose.head_center?.x ?? referenceCenter.x) - (pose.shoulder_center?.x ?? referenceCenter.shoulderX));

    switch (profile.required_move) {
      case 'slip_left':
        return displacement.headDx <= -min;
      case 'slip_right':
        return displacement.headDx >= min;
      case 'slip_side':
        return absHeadX >= min || absShoulderX >= min * 0.85;
      case 'duck':
        return downAmount >= min || (pose.nose && pose.shoulder_center && pose.nose.y >= pose.shoulder_center.y - 0.04);
      case 'lean_back':
        return backLean >= min * 0.9 || displacement.headDistance >= min;
      case 'any':
      default:
        return true;
    }
  }

  drawHitbox(ctx, canvasWidth, canvasHeight, isActive = false, attackProfile = {}) {
    const profile = this.resolveAttackProfile(attackProfile);
    const cx = profile.center_x * canvasWidth;
    const cy = profile.center_y * canvasHeight;
    const radius = profile.hitbox_radius * Math.min(canvasWidth, canvasHeight);

    ctx.save();
    ctx.strokeStyle = isActive ? 'rgba(255,45,85,0.9)' : 'rgba(255,45,85,0.3)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();

    switch (profile.judge_shape) {
      case 'ellipse':
        ctx.ellipse(cx, cy, radius * 1.1, radius * 0.82, 0, 0, Math.PI * 2);
        break;
      case 'lane':
        ctx.rect(cx - radius * 0.85, cy - radius * 1.15, radius * 1.7, radius * 2.3);
        break;
      case 'circle':
      default:
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        break;
    }

    ctx.stroke();
    ctx.restore();

    if (isActive) {
      ctx.save();
      ctx.fillStyle = 'rgba(255,45,85,0.08)';
      ctx.beginPath();

      switch (profile.judge_shape) {
        case 'ellipse':
          ctx.ellipse(cx, cy, radius * 1.1, radius * 0.82, 0, 0, Math.PI * 2);
          break;
        case 'lane':
          ctx.rect(cx - radius * 0.85, cy - radius * 1.15, radius * 1.7, radius * 2.3);
          break;
        case 'circle':
        default:
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          break;
      }

      ctx.fill();
      ctx.restore();
    }
  }
}

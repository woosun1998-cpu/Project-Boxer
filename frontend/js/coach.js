(function (global) {
  const CAMERA_STORAGE_KEY = "boxer-correction-camera-device-id";
  const REACTION_LABELS = ["jab", "cross", "hook", "uppercut"];
  const DEFAULT_ANALYSIS_CONFIG = {
    MIN_KEYPOINT_SCORE: 0.38,
    SMOOTHING_ALPHA: 0.35,
    MAX_POSITION_JUMP_PX: 140,
    MIN_PUNCH_DISTANCE_PX: 24,
    MIN_PUNCH_SPEED: 260,
    MIN_PUNCH_ACCELERATION: 450,
    PUNCH_COOLDOWN_MS: 300,
    GUARD_MARGIN_PX: 18,
    GUARD_WINDOW_FRAMES: 4,
    REACTION_MIN_DELAY_MS: 1200,
    REACTION_MAX_DELAY_MS: 3200,
    REACTION_TIMEOUT_MS: 4500,
    FALSE_START_WINDOW_MS: 700,
    SESSION_DURATION_MS: 60_000,
  };

  function clamp(value, min = 0, max = 1) {
    return Math.min(Math.max(value, min), max);
  }

  function lerp(a, b, alpha) {
    return a + (b - a) * alpha;
  }

  function copyPoint(point) {
    if (!point) return null;
    return {
      x: Number(point.x) || 0,
      y: Number(point.y) || 0,
      z: Number(point.z) || 0,
      visibility: Number(point.visibility) || 0,
    };
  }

  function dist(a, b) {
    if (!a || !b) return 0;
    return Math.hypot((a.x || 0) - (b.x || 0), (a.y || 0) - (b.y || 0));
  }

  function distPx(a, b, width, height) {
    if (!a || !b) return 0;
    return Math.hypot(((a.x || 0) - (b.x || 0)) * width, ((a.y || 0) - (b.y || 0)) * height);
  }

  function pointConfidence(point) {
    return Number(point?.visibility ?? point?.score ?? 0) || 0;
  }

  function angleDeg(a, b, c) {
    if (!a || !b || !c) return 180;
    const abx = (a.x || 0) - (b.x || 0);
    const aby = (a.y || 0) - (b.y || 0);
    const cbx = (c.x || 0) - (b.x || 0);
    const cby = (c.y || 0) - (b.y || 0);
    const dot = abx * cbx + aby * cby;
    const mag = Math.hypot(abx, aby) * Math.hypot(cbx, cby);
    if (!mag) return 180;
    return Math.acos(clamp(dot / mag, -1, 1)) * (180 / Math.PI);
  }

  function pickRandom(items) {
    return items[Math.floor(Math.random() * items.length)];
  }

  class BoxerCoachDetector {
    constructor(options = {}) {
      const { analysis = {}, ...rest } = options;
      this.options = {
        threshold: 0.62,
        promptIntervalMs: 9000,
        promptTimeoutMs: 4500,
        sessionSyncMs: 60_000,
        cameraConstraints: rest.cameraConstraints || rest.videoConstraints || null,
        notes: "",
        ...rest,
        analysis: { ...DEFAULT_ANALYSIS_CONFIG, ...analysis },
      };

      this.videoEl = null;
      this.canvasEl = null;
      this.ctx = null;
      this.stream = null;
      this.pose = null;
      this.running = false;
      this.sessionUid = this._createSessionUid();
      this.startedAt = 0;
      this.endedAt = 0;
      this.sessionStartedAt = null;
      this.sessionEndedAt = null;
      this.lastFrameAt = 0;
      this.prevLandmarks = null;
      this.smoothedLandmarks = null;
      this.pointHistory = { left: [], right: [] };
      this.guardWindow = [];
      this.currentPrompt = null;
      this.promptTimer = null;
      this.promptTimeout = null;
      this.syncTimer = null;
      this.sessionTimer = null;
      this.lastPunchAt = 0;
      this.cameraHints = [];
      this.metrics = this._createMetrics();
      this.liveFrame = this._createLiveFrame();
      this.debugEnabled = Boolean(options.debug);

      this.onPerfect = this.options.onPerfect || null;
      this.onCount = this.options.onCount || null;
      this.onPrediction = this.options.onPrediction || null;
      this.onFeedback = this.options.onFeedback || null;
      this.onStatus = this.options.onStatus || null;
    }

    _createSessionUid() {
      if (global.crypto?.randomUUID) return global.crypto.randomUUID();
      return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }

    _createMetrics() {
      return {
        totalPunches: 0,
        punchCounts: { jab: 0, cross: 0, hook: 0, uppercut: 0 },
        punchSpeedSum: 0,
        punchSpeedSamples: 0,
        maxPunchSpeed: 0,
        punchCountLeft: 0,
        punchCountRight: 0,
        guardChecks: 0,
        guardSuccesses: 0,
        guardFailCount: 0,
        pivotScoreSum: 0,
        pivotSamples: 0,
        pivotEngagementSamples: 0,
        reactionAttempts: 0,
        reactionSuccesses: 0,
        reactionMissCount: 0,
        reactionMsSum: 0,
        reactionMsSamples: 0,
        bestReactionMs: null,
        falseStartCount: 0,
        deviceFpsSum: 0,
        deviceFpsSamples: 0,
        modelConfidenceSum: 0,
        modelConfidenceSamples: 0,
      };
    }

    _createLiveFrame() {
      return {
        threshold: this.options.threshold,
        bestLabel: "none",
        bestScore: 0,
        punchDetected: "none",
        speedRaw: 0,
        speedNorm: 0,
        guardScore: 0,
        pivotScore: 0,
        leadExtension: 0,
        rearExtension: 0,
        promptAgeMs: 0,
        promptLabel: null,
      };
    }

    _cfg(key) {
      return this.options.analysis?.[key] ?? DEFAULT_ANALYSIS_CONFIG[key];
    }

    _frameSize() {
      return {
        width: Math.max(1, this.videoEl?.videoWidth || this.canvasEl?.width || 640),
        height: Math.max(1, this.videoEl?.videoHeight || this.canvasEl?.height || 480),
      };
    }

    _randReactionDelay() {
      const min = this._cfg("REACTION_MIN_DELAY_MS");
      const max = this._cfg("REACTION_MAX_DELAY_MS");
      return Math.round(min + Math.random() * Math.max(1, max - min));
    }

    _toPixelPoint(point, frameWidth, frameHeight) {
      if (!point) return null;
      return {
        x: (Number(point.x) || 0) * frameWidth,
        y: (Number(point.y) || 0) * frameHeight,
        z: Number(point.z) || 0,
        visibility: Number(point.visibility) || 0,
      };
    }

    _stabilizeLandmarks(landmarks) {
      const { width, height } = this._frameSize();
      const alpha = this._cfg("SMOOTHING_ALPHA");
      const maxJumpPx = this._cfg("MAX_POSITION_JUMP_PX");
      const prev = this.smoothedLandmarks || landmarks.map(copyPoint);

      return landmarks.map((point, index) => {
        if (!point) return prev[index] || null;
        if (pointConfidence(point) < this._cfg("MIN_KEYPOINT_SCORE")) {
          return prev[index] || copyPoint(point);
        }

        const prevPoint = prev[index];
        if (!prevPoint) return copyPoint(point);

        const jumpPx = distPx(point, prevPoint, width, height);
        if (jumpPx > maxJumpPx) {
          return prevPoint;
        }

        return {
          x: lerp(prevPoint.x, point.x, alpha),
          y: lerp(prevPoint.y, point.y, alpha),
          z: lerp(prevPoint.z || 0, point.z || 0, alpha),
          visibility: lerp(pointConfidence(prevPoint), pointConfidence(point), alpha),
        };
      });
    }

    _recordFps(now) {
      const frameDelta = this.lastFrameAt ? now - this.lastFrameAt : 0;
      if (frameDelta > 0) {
        const fps = 1000 / frameDelta;
        this.metrics.deviceFpsSum += fps;
        this.metrics.deviceFpsSamples += 1;
      }
    }

    _windowAverage(history, key) {
      if (!history.length) return 0;
      const valid = history.map((item) => Number(item?.[key] || 0)).filter((value) => Number.isFinite(value));
      if (!valid.length) return 0;
      return valid.reduce((sum, value) => sum + value, 0) / valid.length;
    }

    _detectSide(current, frameWidth) {
      const leftShoulder = current[11];
      const rightShoulder = current[12];
      const leftWrist = current[15];
      const rightWrist = current[16];
      if (!leftShoulder || !rightShoulder || !leftWrist || !rightWrist) return "unknown";
      const leftTravel = Math.abs((leftWrist.x - leftShoulder.x) * frameWidth);
      const rightTravel = Math.abs((rightWrist.x - rightShoulder.x) * frameWidth);
      return leftTravel >= rightTravel ? "left" : "right";
    }

    setMode(mode) {
      this.options.mode = mode === "sparring" ? "sparring" : "tutorial";
      return this;
    }

    async init({ videoEl, canvasEl } = {}) {
      this.videoEl = videoEl || this.videoEl;
      this.canvasEl = canvasEl || this.canvasEl;
      if (!this.videoEl) throw new Error("videoEl is required.");
      if (!this.canvasEl) throw new Error("canvasEl is required.");
      this.ctx = this.canvasEl.getContext("2d");

      if (!global.Pose) {
        throw new Error("MediaPipe Pose is not loaded.");
      }

      await this._startCamera();
      this._createPose();
      this._setStatus("ready", "Camera ready. Press Start to begin coaching.");
      return this;
    }

    async _startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera access is not available.");
      }

      this.videoEl.autoplay = true;
      this.videoEl.muted = true;
      this.videoEl.playsInline = true;
      this.videoEl.setAttribute("autoplay", "");
      this.videoEl.setAttribute("muted", "");
      this.videoEl.setAttribute("playsinline", "");

      const selectedDeviceId = String(this.options.cameraDeviceId || localStorage.getItem(CAMERA_STORAGE_KEY) || "").trim();
      const candidates = [];
      if (selectedDeviceId) {
        candidates.push({
          deviceId: { exact: selectedDeviceId },
          width: { ideal: 720 },
          height: { ideal: 1280 },
          aspectRatio: { ideal: 9 / 16 },
        });
      }
      if (this.options.cameraConstraints) {
        candidates.push(this.options.cameraConstraints);
      }
      candidates.push({
        facingMode: { ideal: "user" },
        width: { ideal: 720 },
        height: { ideal: 1280 },
        aspectRatio: { ideal: 9 / 16 },
      });
      candidates.push({ facingMode: { ideal: "environment" } });
      candidates.push({ facingMode: "user" });
      candidates.push(true);

      if (navigator.mediaDevices.enumerateDevices) {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          devices
            .filter((device) => device.kind === "videoinput" && device.deviceId)
            .forEach((device) => {
              candidates.push({ deviceId: { exact: device.deviceId } });
            });
        } catch (_error) {
          // Use the default candidate list.
        }
      }

      const seen = new Set();
      const uniqueCandidates = candidates.filter((candidate) => {
        const key = typeof candidate === "boolean" ? "true" : JSON.stringify(candidate);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      let lastError = null;
      for (const video of uniqueCandidates) {
        let stream = null;
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
          this.stream = stream;
          this.videoEl.srcObject = stream;
          await this.videoEl.play().catch(() => {});
          await new Promise((resolve) => {
            const timer = setTimeout(resolve, 1000);
            const finish = () => {
              clearTimeout(timer);
              resolve();
            };
            this.videoEl.addEventListener("loadedmetadata", finish, { once: true });
            this.videoEl.addEventListener("loadeddata", finish, { once: true });
          });

          if ((this.videoEl.videoWidth || 0) > 0 && (this.videoEl.videoHeight || 0) > 0) {
            if (!this.canvasEl.width || !this.canvasEl.height) {
              this.canvasEl.width = 720;
              this.canvasEl.height = 1280;
            }
            return stream;
          }

          stream.getTracks().forEach((track) => track.stop());
          this.videoEl.srcObject = null;
        } catch (error) {
          lastError = error;
          if (stream) {
            stream.getTracks().forEach((track) => track.stop());
          }
          this.videoEl.srcObject = null;
        }
      }

      throw lastError || new Error("Unable to access camera.");
    }

    _createPose() {
      this.pose = new global.Pose({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
      });

      this.pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        minDetectionConfidence: 0.55,
        minTrackingConfidence: 0.55,
      });

      this.pose.onResults((results) => this._onResults(results));
    }

    start() {
      if (this.running) return;
      this.running = true;
      this.startedAt = performance.now();
      this.endedAt = 0;
      this.sessionStartedAt = new Date().toISOString();
      this.sessionEndedAt = null;
      this.lastFrameAt = 0;
      this.prevLandmarks = null;
      this.smoothedLandmarks = null;
      this.pointHistory = { left: [], right: [] };
      this.guardWindow = [];
      this.metrics = this._createMetrics();
      this.liveFrame = this._createLiveFrame();
      this._schedulePrompt(this._randReactionDelay());
      this.syncTimer = setInterval(() => {
        void this.flushSession("interval");
      }, this.options.sessionSyncMs);
      this.sessionTimer = setTimeout(() => {
        void this.flushSession("session-end").finally(() => this.stop(false));
      }, this.options.analysis.SESSION_DURATION_MS);
      this._setStatus("running", "Show JAB / CROSS / HOOK / UPPERCUT slowly.");
      this._loop();
    }

    stop(flush = true) {
      this.running = false;
      clearTimeout(this.promptTimer);
      clearTimeout(this.promptTimeout);
      clearInterval(this.syncTimer);
      clearTimeout(this.sessionTimer);
      this.promptTimer = null;
      this.promptTimeout = null;
      this.syncTimer = null;
      this.sessionTimer = null;
      this.endedAt = performance.now();
      this.sessionEndedAt = new Date().toISOString();
      this._setStatus("stopped", "Analysis stopped.");
      if (flush) {
        void this.flushSession("stop");
      }
      if (this.stream) {
        this.stream.getTracks().forEach((track) => track.stop());
        this.stream = null;
      }
      this.pose = null;
    }

    async _loop() {
      if (!this.running || !this.pose) return;
      try {
        await this.pose.send({ image: this.videoEl });
      } catch (error) {
        this._setStatus("error", error?.message || "Pose analysis failed.");
        return;
      }
      requestAnimationFrame(() => this._loop());
    }

    _onResults(results) {
      const landmarks = results?.poseLandmarks || null;
      this._drawOverlay(landmarks);
      if (!landmarks) return;
      const now = performance.now();
      this._recordFps(now);
      this._updateFromLandmarks(landmarks, now);
    }

    _updateFromLandmarks(landmarks, now) {
      const current = this._stabilizeLandmarks(landmarks.map(copyPoint));
      const prev = this.smoothedLandmarks || current;
      const dtMs = Math.max(16, now - (this.lastFrameAt || now));
      const dtSec = dtMs / 1000;
      const frame = this._frameSize();
      this.lastFrameAt = now;
      this.smoothedLandmarks = current;

      const shoulderWidthPx = Math.max(distPx(current[11], current[12], frame.width, frame.height), 1);
      const shoulderWidth = shoulderWidthPx / frame.width;
      const left = this._sideSnapshot(current, prev, 11, 13, 15, 23, 25, 27, frame, shoulderWidthPx, dtSec);
      const right = this._sideSnapshot(current, prev, 12, 14, 16, 24, 26, 28, frame, shoulderWidthPx, dtSec);
      const guardOk = !!(current[15] && current[16] && current[11] && current[12] && current[15].y < current[11].y && current[16].y < current[12].y);
      const pivotScore = this._computePivotScore(current, shoulderWidthPx, frame);
      const leftGuardScore = current[15] && current[11]
        ? clamp(1 - Math.max(0, (current[15].y - current[11].y) * frame.height - this._cfg("GUARD_MARGIN_PX")) / Math.max(1, this._cfg("GUARD_MARGIN_PX") * 2))
        : 0;
      const rightGuardScore = current[16] && current[12]
        ? clamp(1 - Math.max(0, (current[16].y - current[12].y) * frame.height - this._cfg("GUARD_MARGIN_PX")) / Math.max(1, this._cfg("GUARD_MARGIN_PX") * 2))
        : 0;
      const guardScore = clamp((leftGuardScore + rightGuardScore) / 2, 0, 1);
      this.guardWindow.push({
        left: current[15]?.y ?? 1,
        right: current[16]?.y ?? 1,
        ls: current[11]?.y ?? 1,
        rs: current[12]?.y ?? 1,
      });
      if (this.guardWindow.length > this._cfg("GUARD_WINDOW_FRAMES")) {
        this.guardWindow.shift();
      }
      const avgGuardScore = this._windowAverage(this.guardWindow.map((item) => ({
        score: clamp(
          ((item.left < item.ls) ? 1 : 0) * 0.5 +
          ((item.right < item.rs) ? 1 : 0) * 0.5,
          0,
          1
        ),
      })), "score");

      const scores = {
        jab: clamp(left.speedNorm * 0.44 + left.extensionNorm * 0.28 + left.verticalRiseNorm * 0.16 + (avgGuardScore ? 0.12 : 0.02)),
        cross: clamp(right.speedNorm * 0.44 + right.extensionNorm * 0.28 + right.verticalRiseNorm * 0.16 + (avgGuardScore ? 0.12 : 0.02)),
        hook: clamp(Math.max(left.hookShape, right.hookShape)),
        uppercut: clamp(Math.max(left.uppercutShape, right.uppercutShape)),
      };
      const leftEligible = left.extensionPx >= this._cfg("MIN_PUNCH_DISTANCE_PX")
        && left.speedRaw >= this._cfg("MIN_PUNCH_SPEED")
        && (left.speedRaw - (this.pointHistory.left.at(-1)?.speedRaw || 0)) / Math.max(dtSec, 0.016) >= this._cfg("MIN_PUNCH_ACCELERATION");
      const rightEligible = right.extensionPx >= this._cfg("MIN_PUNCH_DISTANCE_PX")
        && right.speedRaw >= this._cfg("MIN_PUNCH_SPEED")
        && (right.speedRaw - (this.pointHistory.right.at(-1)?.speedRaw || 0)) / Math.max(dtSec, 0.016) >= this._cfg("MIN_PUNCH_ACCELERATION");

      if (!leftEligible) scores.jab = Math.min(scores.jab, 0.08);
      if (!rightEligible) scores.cross = Math.min(scores.cross, 0.08);
      if (!leftEligible && !rightEligible) {
        scores.hook = Math.min(scores.hook, 0.08);
        scores.uppercut = Math.min(scores.uppercut, 0.08);
      }

      const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
      const [bestLabel, bestScore] = ranked[0];
      const punchDetected = bestScore >= this.options.threshold ? bestLabel : "none";
      const detectionList = REACTION_LABELS.map((label) => ({ label, score: scores[label] || 0 }));
      const promptAgeMs = this.currentPrompt
        ? Math.max(0, Math.round(now - this.currentPrompt.startedAt))
        : 0;
      const modelConfidence = Math.max(bestScore, scores.jab, scores.cross, scores.hook, scores.uppercut);
      this.metrics.modelConfidenceSum += modelConfidence;
      this.metrics.modelConfidenceSamples += 1;
      if (punchDetected !== "none") {
        this.liveFrame.bestLabel = bestLabel;
        this.liveFrame.bestScore = bestScore;
      }

      this.liveFrame = {
        threshold: this.options.threshold,
        bestLabel,
        bestScore,
        punchDetected,
        speedRaw: Math.max(left.speedRaw, right.speedRaw),
        speedNorm: Math.max(left.speedNorm, right.speedNorm),
        guardScore,
        pivotScore,
        leadExtension: left.extensionNorm,
        rearExtension: right.extensionNorm,
        promptAgeMs,
        promptLabel: this.currentPrompt?.label || null,
      };

      this.pointHistory.left.push({ speedRaw: left.speedRaw, extensionPx: left.extensionPx });
      this.pointHistory.right.push({ speedRaw: right.speedRaw, extensionPx: right.extensionPx });
      if (this.pointHistory.left.length > 12) this.pointHistory.left.shift();
      if (this.pointHistory.right.length > 12) this.pointHistory.right.shift();

      const currentSide = this._detectSide(current, frame.width);

      if (punchDetected !== "none" && now - this.lastPunchAt > this._cfg("PUNCH_COOLDOWN_MS")) {
        this.lastPunchAt = now;
        this.metrics.totalPunches += 1;
        this.metrics.punchCounts[punchDetected] += 1;
        const punchSpeed = Math.max(left.speedRaw, right.speedRaw);
        this.metrics.punchSpeedSum += punchSpeed;
        this.metrics.punchSpeedSamples += 1;
        this.metrics.maxPunchSpeed = Math.max(this.metrics.maxPunchSpeed, punchSpeed);
        if (currentSide === "left") this.metrics.punchCountLeft += 1;
        if (currentSide === "right") this.metrics.punchCountRight += 1;
        this.metrics.guardChecks += 1;
        this.metrics.guardSuccesses += avgGuardScore >= 0.55 ? 1 : 0;
        this.metrics.guardFailCount += avgGuardScore >= 0.55 ? 0 : 1;
        this.metrics.pivotSamples += 1;
        this.metrics.pivotScoreSum += pivotScore * 100;
        this.metrics.pivotEngagementSamples += pivotScore >= 0.5 ? 1 : 0;

        if (this.currentPrompt) {
          const reactionWindow = now - this.currentPrompt.startedAt;
          if (reactionWindow < this._cfg("FALSE_START_WINDOW_MS")) {
            this.metrics.falseStartCount += 1;
          }

          if (this.currentPrompt.label === punchDetected && !this.currentPrompt.resolved) {
            const reactionMs = Math.max(0, Math.round(now - this.currentPrompt.startedAt));
            this.currentPrompt.resolved = true;
            this.metrics.reactionAttempts += 1;
            this.metrics.reactionSuccesses += 1;
            this.metrics.reactionMsSum += reactionMs;
            this.metrics.reactionMsSamples += 1;
            this.metrics.bestReactionMs = this.metrics.bestReactionMs === null
              ? reactionMs
              : Math.min(this.metrics.bestReactionMs, reactionMs);
            this._setFeedback(`Perfect reaction: ${punchDetected.toUpperCase()} in ${reactionMs}ms`);
            this.onPerfect?.({ label: punchDetected, score: bestScore, summary: this.getSummary() });
            this._schedulePrompt(this._randReactionDelay());
          }
        }
      }

      if (this.currentPrompt && now - this.currentPrompt.startedAt > this._cfg("REACTION_TIMEOUT_MS") && !this.currentPrompt.resolved) {
        this.metrics.reactionAttempts += 1;
        this.metrics.reactionMissCount = (this.metrics.reactionMissCount || 0) + 1;
        this._setFeedback(`Reaction missed: ${this.currentPrompt.label.toUpperCase()}`);
        this.currentPrompt.resolved = true;
        this._schedulePrompt(this._randReactionDelay());
      }

      const summary = this.getSummary();
      this.onPrediction?.(
        { label: punchDetected, score: bestScore },
        detectionList,
        summary
      );

      if (!this.currentPrompt?.resolved && punchDetected !== "none") {
        this._setFeedback(`Show ${this.currentPrompt.label.toUpperCase()}!`);
      }

      this.prevLandmarks = current;
    }

    _sideSnapshot(current, prev, shoulderIdx, elbowIdx, wristIdx, hipIdx, kneeIdx, ankleIdx, frame, shoulderWidthPx, dtSec) {
      const shoulder = current[shoulderIdx];
      const elbow = current[elbowIdx];
      const wrist = current[wristIdx];
      const hip = current[hipIdx];
      const knee = current[kneeIdx];
      const ankle = current[ankleIdx];
      const prevWrist = prev[wristIdx];

      const speedRaw = prevWrist ? distPx(wrist, prevWrist, frame.width, frame.height) / Math.max(dtSec, 0.016) : 0;
      const speedNorm = clamp((speedRaw / Math.max(shoulderWidthPx, 1)) * 0.6, 0, 1);
      const extensionPx = distPx(wrist, shoulder, frame.width, frame.height);
      const extensionNorm = clamp(extensionPx / Math.max(shoulderWidthPx * 1.25, 1), 0, 1);
      const verticalRiseNorm = clamp((((shoulder?.y ?? 0) - (wrist?.y ?? 0)) * frame.height) / Math.max(shoulderWidthPx, 1) * 0.65, 0, 1);
      const elbowAngle = angleDeg(shoulder, elbow, wrist);
      const hookShape = clamp(((170 - elbowAngle) / 90) * 0.6 + speedNorm * 0.4, 0, 1);
      const uppercutShape = clamp(verticalRiseNorm * 0.55 + ((160 - elbowAngle) / 80) * 0.45, 0, 1);
      const hipLift = knee && ankle ? clamp((ankle.y - knee.y) * 2.2, 0, 1) : 0;

      return {
        speedRaw,
        speedNorm,
        extensionPx,
        extensionNorm,
        verticalRiseNorm,
        hookShape,
        uppercutShape,
        hipLift,
      };
    }

    _computePivotScore(current, shoulderWidth) {
      const leftHip = current[23];
      const rightHip = current[24];
      const leftKnee = current[25];
      const rightKnee = current[26];
      const leftAnkle = current[27];
      const rightAnkle = current[28];
      const shoulderWidthSafe = Math.max(shoulderWidth, 0.001);

      const hipRotation = clamp(Math.abs((leftHip?.x ?? 0) - (rightHip?.x ?? 0)) / shoulderWidthSafe, 0, 1);
      const heelLift = clamp(((leftAnkle?.y ?? 0) - (leftKnee?.y ?? 0) + (rightAnkle?.y ?? 0) - (rightKnee?.y ?? 0)) * 1.5, 0, 1);
      const leftKneeAngle = angleDeg(leftHip, leftKnee, leftAnkle);
      const rightKneeAngle = angleDeg(rightHip, rightKnee, rightAnkle);
      const kneeFlex = clamp((((180 - leftKneeAngle) + (180 - rightKneeAngle)) / 2) / 90, 0, 1);

      return clamp(hipRotation * 0.45 + heelLift * 0.3 + kneeFlex * 0.25, 0, 1);
    }

    _schedulePrompt(delay = this._randReactionDelay()) {
      clearTimeout(this.promptTimer);
      clearTimeout(this.promptTimeout);

      this.promptTimer = setTimeout(() => {
        if (!this.running) return;
        const label = pickRandom(REACTION_LABELS);
        this.currentPrompt = {
          label,
          startedAt: performance.now(),
          resolved: false,
        };
        this._setFeedback(`Reaction test: ${label.toUpperCase()}`);
        this._setStatus("reaction", `Show ${label.toUpperCase()} now.`);

        this.promptTimeout = setTimeout(() => {
          if (!this.currentPrompt || this.currentPrompt.resolved) return;
          this.currentPrompt.resolved = true;
          this._setFeedback(`Try again: ${label.toUpperCase()}`);
          this._setStatus("running", "Keep your rhythm and guard up.");
          this._schedulePrompt(this._randReactionDelay());
        }, this._cfg("REACTION_TIMEOUT_MS"));
      }, Math.max(0, delay));
    }

    async flushSession(reason = "interval") {
      if (!global.api) return null;
      if (!this.metrics.totalPunches && !this.metrics.reactionAttempts && reason === "interval") return null;
      if (!localStorage.getItem("boxer_token")) {
        this._setStatus("auth", "로그인 후에만 세션을 저장할 수 있습니다.");
        return null;
      }

      const summary = this.getSummary();
      const payload = {
        session_uid: this.sessionUid,
        session_mode: this.options.mode || "coach",
        session_started_at: this.sessionStartedAt || new Date().toISOString(),
        session_ended_at: this.sessionEndedAt || new Date().toISOString(),
        session_duration_sec: summary.session_duration_sec,
        total_punches: summary.total_punches,
        avg_punch_speed: summary.avg_punch_speed,
        max_punch_speed: summary.max_punch_speed,
        punch_count_left: summary.punch_count_left,
        punch_count_right: summary.punch_count_right,
        guard_success_rate: summary.guard_success_rate,
        guard_fail_count: summary.guard_fail_count,
        reaction_ms_avg: summary.reaction_ms_avg,
        best_reaction_ms: summary.best_reaction_ms,
        reaction_success_count: summary.reaction_success_count,
        reaction_miss_count: summary.reaction_miss_count,
        false_start_count: summary.false_start_count,
        avg_pivot_score: summary.avg_pivot_score,
        pivot_engagement_rate: summary.pivot_engagement_rate,
        device_fps_avg: summary.device_fps_avg,
        model_confidence_avg: summary.model_confidence_avg,
        notes: this.options.notes || "",
        raw_summary_json: summary,
      };

      try {
        this._setStatus("syncing", "Sending session summary to the server.");
        const data = await global.api.post("/api/v1/training/log", payload);
        this._setFeedback(`Session saved (${reason})`);
        this._resetWindow();
        this.sessionUid = this._createSessionUid();
        return data;
      } catch (error) {
        this._setStatus("error", error?.message || "Failed to sync training log.");
        return null;
      }
    }

    _resetWindow() {
      this.startedAt = performance.now();
      this.sessionStartedAt = new Date().toISOString();
      this.sessionEndedAt = null;
      this.metrics = this._createMetrics();
    }

    getSummary() {
      const totalPunches = this.metrics.totalPunches;
      const sessionDurationSec = Math.max(0, Math.round(((this.endedAt || performance.now()) - this.startedAt) / 1000));
      const avgPunchSpeed = this.metrics.punchSpeedSamples ? this.metrics.punchSpeedSum / this.metrics.punchSpeedSamples : 0;
      const maxPunchSpeed = this.metrics.maxPunchSpeed || 0;
      const guardSuccessRate = this.metrics.guardChecks ? (this.metrics.guardSuccesses / this.metrics.guardChecks) * 100 : 0;
      const guardFailCount = this.metrics.guardFailCount || 0;
      const pivotScoreAvg = this.metrics.pivotSamples ? this.metrics.pivotScoreSum / this.metrics.pivotSamples : 0;
      const pivotEngagementRate = this.metrics.pivotSamples ? (this.metrics.pivotEngagementSamples / this.metrics.pivotSamples) * 100 : 0;
      const reactionMsAvg = this.metrics.reactionMsSamples ? this.metrics.reactionMsSum / this.metrics.reactionMsSamples : 0;
      const reactionSuccessRate = this.metrics.reactionAttempts ? (this.metrics.reactionSuccesses / this.metrics.reactionAttempts) * 100 : 0;
      const deviceFpsAvg = this.metrics.deviceFpsSamples ? this.metrics.deviceFpsSum / this.metrics.deviceFpsSamples : 0;
      const modelConfidenceAvg = this.metrics.modelConfidenceSamples ? this.metrics.modelConfidenceSum / this.metrics.modelConfidenceSamples : 0;
      const promptCount = this.metrics.reactionAttempts;

      return {
        session_uid: this.sessionUid,
        session_started_at: this.sessionStartedAt,
        session_ended_at: this.sessionEndedAt,
        session_duration_sec: sessionDurationSec,
        total_punches: totalPunches,
        punch_count_left: this.metrics.punchCountLeft,
        punch_count_right: this.metrics.punchCountRight,
        avg_punch_speed: Number(avgPunchSpeed.toFixed(2)),
        max_punch_speed: Number(maxPunchSpeed.toFixed(2)),
        guard_success_rate: Number(guardSuccessRate.toFixed(1)),
        guard_fail_count: guardFailCount,
        avg_pivot_score: Number(pivotScoreAvg.toFixed(2)),
        pivot_score_avg: Number(pivotScoreAvg.toFixed(2)),
        pivot_engagement_rate: Number(pivotEngagementRate.toFixed(1)),
        reaction_ms_avg: Number(reactionMsAvg.toFixed(1)),
        best_reaction_ms: this.metrics.bestReactionMs === null ? 0 : this.metrics.bestReactionMs,
        reaction_success_rate: Number(reactionSuccessRate.toFixed(1)),
        reaction_success_count: this.metrics.reactionSuccesses,
        reaction_miss_count: this.metrics.reactionMissCount,
        false_start_count: this.metrics.falseStartCount,
        prompt_count: promptCount,
        punch_counts: { ...this.metrics.punchCounts },
        current_prompt: this.currentPrompt?.label || null,
        mode: this.options.mode || "coach",
        device_fps_avg: Number(deviceFpsAvg.toFixed(2)),
        model_confidence_avg: Number(modelConfidenceAvg.toFixed(2)),
        live_frame: { ...this.liveFrame },
      };
    }

    _drawOverlay(landmarks) {
      if (!this.ctx || !this.canvasEl) return;
      const width = this.canvasEl.width || this.videoEl.videoWidth || 720;
      const height = this.canvasEl.height || this.videoEl.videoHeight || 1280;
      if (this.canvasEl.width !== width) this.canvasEl.width = width;
      if (this.canvasEl.height !== height) this.canvasEl.height = height;

      this.ctx.clearRect(0, 0, width, height);

      if (!landmarks) return;
      this.ctx.save();
      this.ctx.translate(width, 0);
      this.ctx.scale(-1, 1);

      if (typeof drawConnectors === "function" && typeof drawLandmarks === "function" && global.POSE_CONNECTIONS) {
        drawConnectors(this.ctx, landmarks, global.POSE_CONNECTIONS, {
          color: "rgba(111,215,255,0.85)",
          lineWidth: 2,
        });
        drawLandmarks(this.ctx, landmarks, {
          color: "#ff4f78",
          lineWidth: 1,
          radius: 3,
        });
      }

      if (this.debugEnabled) {
        this.ctx.fillStyle = "rgba(255,255,255,0.88)";
        this.ctx.font = "12px Pretendard, sans-serif";
        landmarks.forEach((point, index) => {
          if (!point || pointConfidence(point) < this._cfg("MIN_KEYPOINT_SCORE")) return;
          const x = (point.x || 0) * width;
          const y = (point.y || 0) * height;
          this.ctx.fillText(String(index), x + 4, y - 4);
        });
      }

      this.ctx.restore();
    }

    _setStatus(status, message) {
      this.onStatus?.(status, this.getSummary());
      if (message) this.onFeedback?.(message, this.getSummary());
    }

    _setFeedback(message) {
      if (message) this.onFeedback?.(message, this.getSummary());
    }
  }

  global.BoxerCoachDetector = BoxerCoachDetector;
  global.createBoxerCoachDetector = function createBoxerCoachDetector(options = {}) {
    return new BoxerCoachDetector(options);
  };
  global.createBoxerAIDetector = function createBoxerAIDetector(options = {}) {
    return new BoxerCoachDetector(options);
  };
})(window);

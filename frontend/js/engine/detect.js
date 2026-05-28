/* global tf */

(function (global) {
  const DEFAULT_MODEL_PATH = "/static/boxing_ai_web_model/model.json";
  const DEFAULT_LABELS = ["hook", "uppercut", "cross", "jab", "No punch"];
  const DEFAULT_API_BASE = "";

  function resolveApiUrl(path) {
    const p = String(path || "").trim();
    if (/^https?:\/\//i.test(p)) return p;
    const normalized = p.startsWith("/") ? p : `/${p}`;
    const isQuickTunnel =
      typeof global.location !== "undefined" &&
      /\.trycloudflare\.com$/i.test(global.location.hostname || "");
    if (isQuickTunnel) {
      return `${global.location.origin.replace(/\/$/, "")}${normalized}`;
    }
    const raw = typeof global.__BOXER_API_URL__ === "string" ? global.__BOXER_API_URL__.trim() : "";
    const base = (raw || DEFAULT_API_BASE).replace(/\/$/, "");
    if (!base) return normalized;
    return `${base}${normalized}`;
  }

  function normalizeLabel(value) {
    return String(value ?? "none").trim().toLowerCase() || "none";
  }

  function argMax(values) {
    let bestIndex = 0;
    let bestValue = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < values.length; i += 1) {
      const n = Number(values[i]) || 0;
      if (n > bestValue) {
        bestValue = n;
        bestIndex = i;
      }
    }
    return { index: bestIndex, score: bestValue };
  }

  class BoxerAIDetector {
    constructor(options = {}) {
      this.options = {
        modelPath: DEFAULT_MODEL_PATH,
        labels: DEFAULT_LABELS,
        mode: "tutorial",
        threshold: 0.8,
        stableFrames: 2,
        inferenceIntervalMs: 90,
        targetLabels: ["hook", "uppercut", "cross", "jab"],
        videoConstraints: { facingMode: "user" },
        ...options,
      };

      this.model = null;
      this.videoEl = null;
      this.canvasEl = null;
      this.ctx = null;
      this.stream = null;
      this.cameraEnabled = this.options.cameraEnabled !== false;
      this.running = false;
      this.lastInferenceAt = 0;
      this.latestLabel = "none";
      this.latestScore = 0;
      this.stableLabel = "none";
      this.stableFrames = 0;
      this.armedForCount = true;
      this.counts = {};
      this.sessionEvents = [];
      this.onPerfect = this.options.onPerfect || null;
      this.onCount = this.options.onCount || null;
      this.onPrediction = this.options.onPrediction || null;
      this.onFeedback = this.options.onFeedback || null;
      this.onStatus = this.options.onStatus || null;
      this.motionContextProvider = this.options.motionContextProvider || null;
      this.motionContext = null;
    }

    setMode(mode) {
      this.options.mode = mode === "sparring" ? "sparring" : "tutorial";
      return this;
    }

    setMotionContextProvider(provider) {
      this.motionContextProvider = typeof provider === "function" ? provider : null;
      return this;
    }

    setMotionContext(context) {
      this.motionContext = context || null;
      return this;
    }

    async init({ videoEl, canvasEl } = {}) {
      if (!global.tf) {
        throw new Error("TensorFlow.js is not loaded.");
      }
      this.videoEl = videoEl || this.videoEl;
      this.canvasEl = canvasEl || this.canvasEl;
      this.ctx = this.canvasEl ? this.canvasEl.getContext("2d") : null;
      if (this.cameraEnabled) {
        await this.startCamera();
      }
      await this.loadModel();
      this.setStatus("ready");
      return this;
    }

    async loadModel() {
      if (this.model) return this.model;
      this.setStatus("loading-model");
      const modelPath = await this._resolveModelPath();
      this.model = await global.tf.loadGraphModel(modelPath);
      this.setStatus("model-loaded");
      return this.model;
    }

    async _resolveModelPath() {
      const configuredPath = String(this.options.modelPath || DEFAULT_MODEL_PATH);
      if (configuredPath && configuredPath !== DEFAULT_MODEL_PATH) {
        return configuredPath;
      }

      if (typeof global.resolveBoxerApiBase === "function") {
        try {
          const base = await global.resolveBoxerApiBase();
          if (base) return `${base}/static/boxing_ai_web_model/model.json`;
        } catch (_error) {
          // fall back below
        }
      }

      return "/static/boxing_ai_web_model/model.json";
    }

    async startCamera() {
      if (!this.videoEl) {
        throw new Error("videoEl is required.");
      }
      if (!this.cameraEnabled) {
        if (this.videoEl.srcObject || this.videoEl.readyState >= 2) {
          return null;
        }
        throw new Error("camera is disabled and no existing video stream was found.");
      }
      if (this.stream) return this.stream;

      this.videoEl.autoplay = true;
      this.videoEl.muted = true;
      this.videoEl.playsInline = true;
      this.videoEl.setAttribute("autoplay", "");
      this.videoEl.setAttribute("muted", "");
      this.videoEl.setAttribute("playsinline", "");

      const candidates = [];
      const pushCandidate = (video) => {
        if (!video) return;
        candidates.push(video);
      };
      pushCandidate(this.options.videoConstraints);
      pushCandidate({ facingMode: { ideal: "user" } });
      pushCandidate({ facingMode: { ideal: "environment" } });
      pushCandidate({ facingMode: "user" });
      pushCandidate(true);

      if (navigator.mediaDevices?.enumerateDevices) {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          devices
            .filter((device) => device.kind === "videoinput" && device.deviceId)
            .forEach((device) => {
              candidates.push({ deviceId: { exact: device.deviceId } });
            });
        } catch (_error) {
          // fall back to the generic candidates above
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
          stream = await navigator.mediaDevices.getUserMedia({
            video,
            audio: false,
          });
          this.videoEl.srcObject = stream;
          await this.videoEl.play().catch(() => {});
          await new Promise((resolve) => {
            const onReady = () => resolve(true);
            const timeout = setTimeout(onReady, 1200);
            const cleanup = () => {
              clearTimeout(timeout);
              this.videoEl.removeEventListener("loadedmetadata", onReady);
              this.videoEl.removeEventListener("loadeddata", onReady);
            };
            this.videoEl.addEventListener("loadedmetadata", () => {
              cleanup();
              resolve(true);
            }, { once: true });
            this.videoEl.addEventListener("loadeddata", () => {
              cleanup();
              resolve(true);
            }, { once: true });
          });

          const width = Number(this.videoEl.videoWidth) || 0;
          const height = Number(this.videoEl.videoHeight) || 0;
          if (width > 0 && height > 0) {
            this.stream = stream;
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

    start() {
      if (this.running) return;
      this.startedAt = performance.now();
      this.running = true;
      this.armedForCount = true;
      this.loop();
      this.setStatus("running");
    }

    stop() {
      this.running = false;
      if (this.stream) {
        this.stream.getTracks().forEach((track) => track.stop());
        this.stream = null;
      }
      this.setStatus("stopped");
    }

    getSummary() {
      const totalPunches = Object.values(this.counts).reduce((sum, value) => sum + value, 0);
      return {
        mode: this.options.mode,
        totalPunches,
        counts: { ...this.counts },
        events: [...this.sessionEvents],
        latestLabel: this.latestLabel,
        latestScore: this.latestScore,
      };
    }

    async inferFrame() {
      if (!this.model || !this.videoEl || this.videoEl.readyState < 2) return null;
      this._syncCanvasSize();

      const input = global.tf.tidy(() => {
        const tensor = global.tf.browser.fromPixels(this.videoEl).toFloat();
        const [height, width] = this._getModelInputSize();
        const resized = global.tf.image.resizeBilinear(tensor, [height, width]);
        return resized.div(255.0).expandDims(0);
      });

      let rawOutput;
      try {
        rawOutput = this.model.executeAsync
          ? await this.model.executeAsync(input)
          : this.model.predict(input);
      } finally {
        input.dispose();
      }

      const detections = await this._decodeOutput(rawOutput);
      this._disposeOutput(rawOutput);

      const best = detections[0] || { label: "none", score: 0 };
      this.latestLabel = normalizeLabel(best.label);
      this.latestScore = Number(best.score) || 0;

      this._updateStableState(best);
      this._drawOverlay(best, detections);
      this.onPrediction?.(best, detections, this.getSummary());

      return { best, detections };
    }

    async loop(timestamp = 0) {
      if (!this.running) return;

      if (timestamp - this.lastInferenceAt >= this.options.inferenceIntervalMs) {
        this.lastInferenceAt = timestamp;
        try {
          await this.inferFrame();
        } catch (error) {
          this.setStatus(`error:${error.message}`);
        }
      }

      requestAnimationFrame((nextTs) => this.loop(nextTs));
    }

    async finishSession({ token, userId, notes = "" } = {}) {
      const payload = {
        mode: this.options.mode,
        duration_sec: this._getDurationSeconds(),
        notes,
        generate_feedback: true,
        logs: Object.entries(this.counts).map(([punch_type, count]) => ({
          punch_type,
          count,
        })),
      };

      let result;
      if (global.api?.post) {
        const data = await global.api.post("/api/v1/records", payload);
        result = { success: true, data };
      } else {
        const response = await fetch(resolveApiUrl("/api/v1/records"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const detail = await response.text().catch(() => "");
          throw new Error(detail || `Failed to save records (${response.status})`);
        }

        const json = await response.json();
        result = json && typeof json === "object" && "data" in json
          ? json
          : { success: true, data: json };
      }

      const feedback = result?.data?.feedback || "";
      this.onFeedback?.(feedback);
      return result;
    }

    _getDurationSeconds() {
      if (!this.startedAt) {
        this.startedAt = performance.now();
        return 0;
      }
      return Math.max(0, Math.round((performance.now() - this.startedAt) / 1000));
    }

    _getModelInputSize() {
      const shape = this.model?.inputs?.[0]?.shape || [];
      const height = Number(shape[1]) || 640;
      const width = Number(shape[2]) || 640;
      return [height, width];
    }

    async _decodeOutput(rawOutput) {
      const tensors = Array.isArray(rawOutput) ? rawOutput : [rawOutput];
      const arrays = [];

      for (const tensor of tensors) {
        if (!tensor || typeof tensor.array !== "function") continue;
        const value = await tensor.array();
        arrays.push({ tensor, value });
      }

      if (!arrays.length) return [];

      const primary = arrays[0];
      const shape = primary?.tensor?.shape || [];
      if (shape.length === 3) {
        const decoded = this._decodeThreeDimensionalOutput(primary.value, shape);
        if (decoded.length) return decoded;
      }

      if (arrays.length >= 3 && this._looksLikeNmsOutput(arrays)) {
        return this._decodeNmsOutput(arrays);
      }

      return this._decodeFlatOutput(primary.value);
    }

    _decodeThreeDimensionalOutput(value, shape) {
      const classCount = this.options.labels.length;
      const [batch, dim1, dim2] = shape;
      if (batch !== 1) return [];

      if (dim1 === classCount) {
        return this._decodeClassMapOutput(value?.[0] || [], classCount, dim2, true);
      }

      if (dim2 === classCount) {
        return this._decodeClassMapOutput(value?.[0] || [], classCount, dim1, false);
      }

      if (dim1 >= 4 + classCount) {
        return this._decodeAnchorGridOutput(value?.[0] || [], dim1, dim2, true);
      }

      if (dim2 >= 4 + classCount) {
        return this._decodeAnchorGridOutput(value?.[0] || [], dim2, dim1, false);
      }

      return this._decodeClassMapOutput(value?.[0] || [], Math.min(classCount, dim1), dim2, true);
    }

    _decodeClassMapOutput(matrix, classCount, anchorCount, channelsFirst) {
      const detections = [];
      for (let classIndex = 0; classIndex < classCount; classIndex += 1) {
        let bestScore = 0;
        let bestAnchor = 0;
        for (let anchorIndex = 0; anchorIndex < anchorCount; anchorIndex += 1) {
          const raw = channelsFirst ? matrix?.[classIndex]?.[anchorIndex] : matrix?.[anchorIndex]?.[classIndex];
          const score = this._toProbability(raw);
          if (score > bestScore) {
            bestScore = score;
            bestAnchor = anchorIndex;
          }
        }
        detections.push({
          label: normalizeLabel(this.options.labels[classIndex] || classIndex),
          score: bestScore,
          box: null,
          anchorIndex: bestAnchor,
        });
      }
      return detections.sort((a, b) => b.score - a.score);
    }

    _decodeAnchorGridOutput(matrix, channelCount, anchorCount, channelsFirst) {
      const classCount = this.options.labels.length;
      const detections = [];

      for (let anchorIndex = 0; anchorIndex < anchorCount; anchorIndex += 1) {
        const row = [];
        for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
          row.push(channelsFirst ? matrix?.[channelIndex]?.[anchorIndex] : matrix?.[anchorIndex]?.[channelIndex]);
        }

        if (row.length < 4) continue;

        const box = row.slice(0, 4);
        const classSlice = row.slice(4, 4 + classCount);
        const hasObjectness = row.length > 4 + classCount;
        const objectness = hasObjectness ? this._toProbability(row[4]) : 1;
        const classScores = hasObjectness ? row.slice(5, 5 + classCount) : classSlice;
        const { index, score } = argMax(classScores.map((value) => this._toProbability(value)));
        const finalScore = objectness * score;

        detections.push({
          label: normalizeLabel(this.options.labels[index] || index),
          score: finalScore,
          box,
          anchorIndex,
        });
      }

      return detections.sort((a, b) => b.score - a.score);
    }

    _looksLikeNmsOutput(arrays) {
      const first = arrays[0]?.value;
      return Array.isArray(first) && Array.isArray(first[0]);
    }

    async _decodeNmsOutput(arrays) {
      const boxes = arrays[0]?.value?.[0] || [];
      const scores = arrays[1]?.value?.[0] || [];
      const classes = arrays[2]?.value?.[0] || [];
      const detections = [];

      for (let i = 0; i < scores.length; i += 1) {
        const score = Number(scores[i]) || 0;
        if (score < 0.01) continue;
        const classIndex = Math.round(Number(classes[i]) || 0);
        const label = normalizeLabel(this.options.labels[classIndex] || classIndex);
        detections.push({
          label,
          score,
          box: boxes[i] || null,
        });
      }

      return detections.sort((a, b) => b.score - a.score);
    }

    _decodeFlatOutput(value) {
      const rows = Array.isArray(value?.[0]) ? value : [value];
      const detections = [];

      for (const row of rows) {
        if (!Array.isArray(row) || row.length < 5) continue;

        let label = "none";
        let score = 0;
        let box = null;

        if (row.length >= 6 && row.length <= 8) {
          const [x1, y1, x2, y2, objectness, classId] = row;
          score = this._toProbability(objectness);
          box = [x1, y1, x2, y2];
          label = normalizeLabel(this.options.labels[Math.round(Number(classId) || 0)] || classId);
        } else if (row.length > 6) {
          const boxValues = row.slice(0, 4);
          const objectness = this._toProbability(row[4]);
          const classScores = row.slice(5);
          const { index, score: classScore } = argMax(classScores.map((value) => this._toProbability(value)));
          score = objectness * classScore;
          box = boxValues;
          label = normalizeLabel(this.options.labels[index] || index);
        } else {
          const classScores = row.slice(1);
          const { index, score: classScore } = argMax(classScores.map((value) => this._toProbability(value)));
          score = classScore;
          label = normalizeLabel(this.options.labels[index] || index);
        }

        detections.push({ label, score, box });
      }

      return detections.sort((a, b) => b.score - a.score);
    }

    _updateStableState(best) {
      const motionContext = this._getMotionContext();
      const canCount = motionContext?.allowCount !== false;
      const nextLabel = best && best.score >= this.options.threshold
        ? normalizeLabel(best.label)
        : "none";

      if (nextLabel === this.stableLabel) {
        this.stableFrames += 1;
      } else {
        this.stableLabel = nextLabel;
        this.stableFrames = 1;
      }

      if (this.stableFrames < this.options.stableFrames) return;

      const previousLabel = this.currentLabel || "none";
      this.currentLabel = nextLabel;

      if (this.options.mode === "tutorial") {
        if (this._isTargetPunch(nextLabel) && previousLabel === "none" && canCount) {
          this._emitPerfect(best);
        }
        return;
      }

      if (this.options.mode === "sparring") {
        if (previousLabel === "none" && this._isTargetPunch(nextLabel) && this.armedForCount && canCount) {
          this.counts[nextLabel] = (this.counts[nextLabel] || 0) + 1;
          this.sessionEvents.push({
            label: nextLabel,
            score: best?.score || 0,
            at: new Date().toISOString(),
          });
          this.onCount?.({
            label: nextLabel,
            count: this.counts[nextLabel],
            summary: this.getSummary(),
          });
          this.armedForCount = false;
        }

        if (nextLabel === "none") {
          this.armedForCount = true;
        }
      }
    }

    _isTargetPunch(label) {
      return this.options.targetLabels.includes(normalizeLabel(label));
    }

    _getMotionContext() {
      if (typeof this.motionContextProvider === "function") {
        try {
          const provided = this.motionContextProvider(this.getSummary(), this.motionContext);
          return provided && typeof provided === "object" ? provided : this.motionContext;
        } catch (_error) {
          return this.motionContext;
        }
      }
      return this.motionContext;
    }

    _emitPerfect(best) {
      const message = "Perfect!";
      this._flashMessage(message, best?.label || "hook");
      this.onPerfect?.({
        label: normalizeLabel(best?.label),
        score: best?.score || 0,
        message,
        summary: this.getSummary(),
      });
    }

    _drawOverlay(best, detections) {
      if (!this.ctx || !this.canvasEl) return;
      const { width, height } = this.canvasEl;
      this.ctx.clearRect(0, 0, width, height);

      const label = best?.label ? normalizeLabel(best.label) : "none";
      const score = Number(best?.score) || 0;

      this.ctx.save();
      this.ctx.fillStyle = score >= this.options.threshold ? "rgba(0, 255, 102, 0.18)" : "rgba(255,255,255,0.08)";
      this.ctx.strokeStyle = score >= this.options.threshold ? "#00ff66" : "#ffffff";
      this.ctx.lineWidth = 3;

      if (best?.box && best.box.length >= 4) {
        const [x1, y1, x2, y2] = best.box.map((value) => Number(value) || 0);
        const boxX = x1 * width;
        const boxY = y1 * height;
        const boxW = (x2 - x1) * width;
        const boxH = (y2 - y1) * height;
        this.ctx.fillRect(boxX, boxY, boxW, boxH);
        this.ctx.strokeRect(boxX, boxY, boxW, boxH);
      }

      const topLine = `${label.toUpperCase()} ${(score * 100).toFixed(1)}%`;
      const subLine = this.options.mode === "tutorial"
        ? "jab / cross / hook / uppercut detector"
        : `count ${Object.values(this.counts).reduce((sum, value) => sum + value, 0)}`;

      this.ctx.fillStyle = "rgba(0,0,0,0.62)";
      this.ctx.fillRect(14, 14, Math.min(width - 28, 280), 64);
      this.ctx.strokeStyle = score >= this.options.threshold ? "#00ff66" : "rgba(255,255,255,0.24)";
      this.ctx.strokeRect(14, 14, Math.min(width - 28, 280), 64);
      this.ctx.fillStyle = "#fff";
      this.ctx.font = "700 18px sans-serif";
      this.ctx.fillText(topLine, 26, 39);
      this.ctx.font = "500 12px sans-serif";
      this.ctx.fillStyle = "rgba(255,255,255,0.72)";
      this.ctx.fillText(subLine, 26, 59);
      this.ctx.restore();

      if (this.options.mode === "tutorial" && this._isTargetPunch(label) && score >= this.options.threshold) {
        this.canvasEl.classList.add("perfect-hit");
        setTimeout(() => this.canvasEl.classList.remove("perfect-hit"), 180);
      }
    }

    _flashMessage(text, label) {
      const el = document.createElement("div");
      el.className = "boxer-ai-message";
      el.textContent = text;
      el.setAttribute("data-label", label);
      el.style.cssText = [
        "position:fixed",
        "inset:auto 50% 20%",
        "transform:translateX(-50%)",
        "padding:1rem 1.6rem",
        "border-radius:999px",
        "background:rgba(0,0,0,0.8)",
        "border:1px solid rgba(255,255,255,0.18)",
        "color:#fff",
        "font:700 1.5rem/1.1 sans-serif",
        "letter-spacing:0.04em",
        "z-index:9999",
        "box-shadow:0 12px 36px rgba(0,0,0,0.45)",
      ].join(";");

      document.body.appendChild(el);
      requestAnimationFrame(() => el.classList.add("show"));
      setTimeout(() => {
        el.classList.remove("show");
        setTimeout(() => el.remove(), 240);
      }, 1200);
    }

    _disposeOutput(rawOutput) {
      const tensors = Array.isArray(rawOutput) ? rawOutput : [rawOutput];
      tensors.forEach((tensor) => {
        if (tensor && typeof tensor.dispose === "function") {
          tensor.dispose();
        }
      });
    }

    _toProbability(value) {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return 0;
      if (numeric >= 0 && numeric <= 1) return numeric;
      return 1 / (1 + Math.exp(-numeric));
    }

    _syncCanvasSize() {
      if (!this.canvasEl || !this.videoEl) return;
      const width = Number(this.videoEl.videoWidth) || Number(this.canvasEl.width) || 640;
      const height = Number(this.videoEl.videoHeight) || Number(this.canvasEl.height) || 480;
      if (this.canvasEl.width !== width) this.canvasEl.width = width;
      if (this.canvasEl.height !== height) this.canvasEl.height = height;
    }

    setStatus(status) {
      this.status = status;
      this.onStatus?.(status, this.getSummary());
    }
  }

  global.BoxerAIDetector = BoxerAIDetector;
  global.createBoxerAIDetector = function createBoxerAIDetector(options = {}) {
    return new BoxerAIDetector(options);
  };
})(window);

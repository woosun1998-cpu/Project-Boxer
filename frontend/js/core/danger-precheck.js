(function () {
  let loadPromise = null;
  let modelPromise = null;

  const DANGER_LABELS = new Set(["knife", "scissors", "baseball bat"]);
  const DANGER_LABEL_KO = {
    knife: "칼",
    scissors: "가위",
    "baseball bat": "야구방망이",
  };

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
        // 이미 로드가 끝난 경우를 대비
        if (existing.dataset.loaded === "1") resolve();
        return;
      }

      const script = document.createElement("script");
      script.src = src;
      script.crossOrigin = "anonymous";
      script.async = true;
      script.addEventListener("load", () => {
        script.dataset.loaded = "1";
        resolve();
      }, { once: true });
      script.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
      document.head.appendChild(script);
    });
  }

  async function ensureModelLoaded() {
    if (!loadPromise) {
      loadPromise = (async () => {
        if (!window.tf) {
          await loadScript("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.20.0/dist/tf.min.js");
        }
        if (!window.cocoSsd) {
          await loadScript("https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3");
        }
      })();
    }
    await loadPromise;

    if (!modelPromise) {
      modelPromise = window.cocoSsd.load();
    }
    return modelPromise;
  }

  async function runDangerObjectPrecheck(options = {}) {
    const {
      threshold = 0.45,
      maxNumBoxes = 12,
      warmupDelayMs = 500,
      sampleCount = 5,
      sampleIntervalMs = 120,
      requiredHits = 2,
      videoConstraints = { video: { facingMode: "user" }, audio: false },
      videoEl: providedVideoEl = null,
      targetLabels = null,
      labelMap = null,
      keepStream = false,
    } = options;

    let stream = null;
    let tempVideo = null;
    let videoEl = providedVideoEl;

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        return { safe: true, reason: "camera_api_unavailable", dangerLabels: [] };
      }

      const model = await ensureModelLoaded();

      if (!videoEl) {
        tempVideo = document.createElement("video");
        tempVideo.playsInline = true;
        tempVideo.muted = true;
        tempVideo.autoplay = true;
        tempVideo.style.position = "fixed";
        tempVideo.style.left = "-9999px";
        tempVideo.style.top = "-9999px";
        tempVideo.style.width = "1px";
        tempVideo.style.height = "1px";
        document.body.appendChild(tempVideo);
        videoEl = tempVideo;
      }

      stream = await navigator.mediaDevices.getUserMedia(videoConstraints);
      videoEl.srcObject = stream;
      try {
        await videoEl.play();
      } catch (_) {}

      await new Promise((resolve) => window.setTimeout(resolve, warmupDelayMs));
      const activeTargetLabels =
        targetLabels instanceof Set
          ? targetLabels
          : Array.isArray(targetLabels)
          ? new Set(targetLabels.map((v) => String(v || "").toLowerCase()))
          : DANGER_LABELS;
      const activeLabelMap = labelMap && typeof labelMap === "object" ? labelMap : DANGER_LABEL_KO;
      const safeSampleCount = Math.max(1, Number(sampleCount) || 1);
      const safeIntervalMs = Math.max(0, Number(sampleIntervalMs) || 0);
      const safeRequiredHits = Math.max(1, Number(requiredHits) || 1);

      const hitCountByLabel = new Map();
      const collectedPredictions = [];

      for (let i = 0; i < safeSampleCount; i += 1) {
        const predictions = await model.detect(videoEl, maxNumBoxes, threshold);
        collectedPredictions.push(...predictions);
        const labelSetInSample = new Set(
          predictions
            .map((item) => String(item.class || "").toLowerCase())
            .filter((label) => activeTargetLabels.has(label))
        );
        labelSetInSample.forEach((label) => {
          hitCountByLabel.set(label, (hitCountByLabel.get(label) || 0) + 1);
        });
        if (i < safeSampleCount - 1 && safeIntervalMs > 0) {
          await new Promise((resolve) => window.setTimeout(resolve, safeIntervalMs));
        }
      }

      const dangerLabels = [];
      hitCountByLabel.forEach((count, label) => {
        if (count >= safeRequiredHits) {
          dangerLabels.push(activeLabelMap[label] || label);
        }
      });
      const unique = [...new Set(dangerLabels)];

      return {
        safe: unique.length === 0,
        dangerLabels: unique,
        rawPredictions: collectedPredictions,
        hitCountByLabel: Object.fromEntries(hitCountByLabel),
        decisionRule: {
          sampleCount: safeSampleCount,
          requiredHits: safeRequiredHits,
        },
      };
    } catch (_) {
      // 점검 실패가 기능 전체를 막지 않도록 안전하게 통과 처리
      return { safe: true, reason: "precheck_failed", dangerLabels: [] };
    } finally {
      if (stream && !(keepStream && providedVideoEl)) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (videoEl && !(keepStream && providedVideoEl)) {
        try {
          videoEl.pause();
        } catch (_) {}
        videoEl.srcObject = null;
      }
      if (tempVideo?.parentNode) {
        tempVideo.parentNode.removeChild(tempVideo);
      }
    }
  }

  window.runDangerObjectPrecheck = runDangerObjectPrecheck;
})();


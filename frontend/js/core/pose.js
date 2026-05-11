(() => {
  let poseInstance = null;
  let cameraInstance = null;
  let started = false;

  // 0에서 100 사이의 값을 받아 UI를 업데이트하는 함수
  function updateAccuracyUI(score) {
    const boundedScore = Math.max(0, Math.min(100, Math.round(score)));

    // 1. 숫자 텍스트 업데이트
    const valueEl = document.getElementById("accuracyValue");
    if (valueEl) valueEl.innerText = String(boundedScore);

    // 2. SVG 게이지 테두리 업데이트 (stroke-dashoffset 계산)
    const progressCircle = document.querySelector(".accuracy-progress");
    if (progressCircle) {
      const circumference = 440; // 반지름 70 기준 원둘레
      const offset = circumference - (boundedScore / 100) * circumference;
      progressCircle.style.strokeDashoffset = String(offset);
    }
  }

  async function initPoseTracking(options = {}) {
    if (started) return;

    const videoId = options.videoId || "webcamFeed";
    const canvasId = options.canvasId || "poseCanvas";
    const videoElement = document.getElementById(videoId);
    const canvasElement = document.getElementById(canvasId);

    if (!videoElement || !canvasElement) {
      throw new Error("Pose target elements are missing.");
    }

    if (
      typeof Pose === "undefined" ||
      typeof Camera === "undefined" ||
      typeof drawConnectors === "undefined" ||
      typeof drawLandmarks === "undefined"
    ) {
      throw new Error("MediaPipe Pose library is not loaded.");
    }

    const canvasCtx = canvasElement.getContext("2d");

    poseInstance = new Pose({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
    });

    poseInstance.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    poseInstance.onResults((results) => {
      const width = videoElement.videoWidth || canvasElement.clientWidth;
      const height = videoElement.videoHeight || canvasElement.clientHeight;
      if (!width || !height) return;

      if (canvasElement.width !== width || canvasElement.height !== height) {
        canvasElement.width = width;
        canvasElement.height = height;
      }

      canvasCtx.save();
      canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

      if (results.poseLandmarks) {
        const landmarks = results.poseLandmarks;
        window.__latestUserPoseLandmarks = landmarks;
        const feedbackElement =
          document.getElementById("feedback-msg") ||
          document.querySelector(".feedback-text");
        const customFeedbackMode = window.__customPoseFeedbackActive === true;

        // 25(좌측 무릎), 26(우측 무릎), 27(좌측 발목), 28(우측 발목)
        // 가시성과 y 범위를 함께 검사하여 전신(하체) 인식 여부를 판단합니다.
        const isLowerBodyVisible =
          ((landmarks[25]?.visibility ?? 0) > 0.5 &&
            (landmarks[25]?.y ?? 2) < 1) ||
          ((landmarks[26]?.visibility ?? 0) > 0.5 &&
            (landmarks[26]?.y ?? 2) < 1) ||
          ((landmarks[27]?.visibility ?? 0) > 0.5 &&
            (landmarks[27]?.y ?? 2) < 1) ||
          ((landmarks[28]?.visibility ?? 0) > 0.5 &&
            (landmarks[28]?.y ?? 2) < 1);

        if (feedbackElement && !customFeedbackMode) {
          if (!isLowerBodyVisible) {
            feedbackElement.innerText =
              "카메라에 전신(무릎 밑까지)이 나오도록 뒤로 물러나주세요!";
            feedbackElement.style.fontSize = "18px";
            updateAccuracyUI(0);
          } else {
            feedbackElement.innerText = "자세 분석 중...";
            feedbackElement.style.fontSize = "22px";

            // 임시 점수: 주요 상/하체 랜드마크 가시성 평균을 정확도로 사용
            // (추후 각도 기반 채점으로 교체 가능)
            const scoreIndices = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
            const visibleScores = scoreIndices.map(
              (idx) => (landmarks[idx]?.visibility ?? 0) * 100,
            );
            const avgScore =
              visibleScores.reduce((sum, val) => sum + val, 0) /
              visibleScores.length;
            updateAccuracyUI(avgScore);
          }
        }

        drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {
          color: "#ED1D32",
          lineWidth: 4,
        });
        drawLandmarks(canvasCtx, results.poseLandmarks, {
          color: "#00E1FF",
          lineWidth: 1,
          radius: 3,
        });
      }

      canvasCtx.restore();
    });

    cameraInstance = new Camera(videoElement, {
      onFrame: async () => {
        await poseInstance.send({ image: videoElement });
      },
      width: 540,
      height: 674,
    });

    await cameraInstance.start();
    started = true;
  }

  window.updateAccuracyUI = updateAccuracyUI;
  window.initPoseTracking = initPoseTracking;
})();

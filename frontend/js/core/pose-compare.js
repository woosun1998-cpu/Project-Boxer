/**
 * 트레이너 영상 포즈 vs 웹캠 포즈 실시간 비교 (tutorial2 / diet-boxing-play 공용)
 */
(() => {
  function calculateAngle(a, b, c) {
    if (!a || !b || !c) return null;
    const abAngle = Math.atan2((a.y ?? 0) - (b.y ?? 0), (a.x ?? 0) - (b.x ?? 0));
    const cbAngle = Math.atan2((c.y ?? 0) - (b.y ?? 0), (c.x ?? 0) - (b.x ?? 0));
    let deg = Math.abs(((cbAngle - abAngle) * 180) / Math.PI);
    if (deg > 180) deg = 360 - deg;
    return deg;
  }

  function getCoreJointAngles(lm) {
    if (!lm) return null;
    const rightElbow = calculateAngle(lm[12], lm[14], lm[16]);
    const leftElbow = calculateAngle(lm[11], lm[13], lm[15]);
    const rightShoulder = calculateAngle(lm[24], lm[12], lm[14]);
    const leftShoulder = calculateAngle(lm[23], lm[11], lm[13]);
    if (
      [rightElbow, leftElbow, rightShoulder, leftShoulder].some(
        (v) => v == null || !Number.isFinite(v),
      )
    ) {
      return null;
    }
    return { rightElbow, leftElbow, rightShoulder, leftShoulder };
  }

  function getAgreementRate(trainerAngles, userAngles) {
    const diffs = [
      Math.abs(trainerAngles.rightElbow - userAngles.rightElbow),
      Math.abs(trainerAngles.leftElbow - userAngles.leftElbow),
      Math.abs(trainerAngles.rightShoulder - userAngles.rightShoulder),
      Math.abs(trainerAngles.leftShoulder - userAngles.leftShoulder),
    ];
    const avgDiff = diffs.reduce((sum, d) => sum + d, 0) / diffs.length;
    const score = Math.max(0, Math.min(100, 100 - (avgDiff / 90) * 100));
    return { score, diffs };
  }

  function buildFeedback(trainerAngles, userAngles) {
    const joints = [
      {
        key: "rightElbow",
        tooOpenMsg: "오른쪽 팔을 더 굽히세요!",
        tooClosedMsg: "오른쪽 팔을 조금 더 펴세요!",
      },
      {
        key: "leftElbow",
        tooOpenMsg: "왼쪽 팔을 더 굽히세요!",
        tooClosedMsg: "왼쪽 팔을 조금 더 펴세요!",
      },
      {
        key: "rightShoulder",
        tooOpenMsg: "오른쪽 어깨 가드를 더 올리세요!",
        tooClosedMsg: "오른쪽 어깨 긴장을 조금 풀어 주세요.",
      },
      {
        key: "leftShoulder",
        tooOpenMsg: "왼손 가드를 올리세요!",
        tooClosedMsg: "왼쪽 어깨 긴장을 조금 풀어 주세요.",
      },
    ];

    let biggest = null;
    for (const joint of joints) {
      const diff = Math.abs(
        (trainerAngles[joint.key] ?? 0) - (userAngles[joint.key] ?? 0),
      );
      if (!biggest || diff > biggest.diff) {
        biggest = { ...joint, diff };
      }
    }

    if (!biggest || biggest.diff < 12) {
      return "좋아요! 트레이너 자세와 거의 일치합니다.";
    }

    const trainer = trainerAngles[biggest.key];
    const user = userAngles[biggest.key];
    return user > trainer ? biggest.tooOpenMsg : biggest.tooClosedMsg;
  }

  function isLowerBodyVisible(landmarks) {
    return (
      ((landmarks[25]?.visibility ?? 0) > 0.5 && (landmarks[25]?.y ?? 2) < 1) ||
      ((landmarks[26]?.visibility ?? 0) > 0.5 && (landmarks[26]?.y ?? 2) < 1) ||
      ((landmarks[27]?.visibility ?? 0) > 0.5 && (landmarks[27]?.y ?? 2) < 1) ||
      ((landmarks[28]?.visibility ?? 0) > 0.5 && (landmarks[28]?.y ?? 2) < 1)
    );
  }

  /**
   * @param {object} options
   * @param {string} [options.trainerVideoId]
   * @param {string} [options.feedbackId]
   * @param {number} [options.intervalMs]
   */
  async function initTrainerPoseCompare(options = {}) {
    const trainerVideo = document.getElementById(
      options.trainerVideoId || "trainer-video",
    );
    const feedbackEl = document.getElementById(
      options.feedbackId || "feedback-msg",
    );
    const intervalMs = options.intervalMs ?? 120;

    if (!trainerVideo || typeof Pose === "undefined") return;

    window.__customPoseFeedbackActive = true;

    let trainerPose = null;
    let latestTrainerPoseLandmarks = null;
    let poseCompareTimer = null;

    trainerPose = new Pose({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
    });
    trainerPose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    trainerPose.onResults((results) => {
      latestTrainerPoseLandmarks = results?.poseLandmarks || null;
    });

    const runCompareTick = async () => {
      if (!trainerPose || trainerVideo.paused || trainerVideo.ended) return;

      if (trainerVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        try {
          await trainerPose.send({ image: trainerVideo });
        } catch {
          /* frame skip */
        }
      }

      const userLandmarks = window.__latestUserPoseLandmarks;
      if (!userLandmarks) return;

      if (!isLowerBodyVisible(userLandmarks)) {
        window.updateAccuracyUI?.(0);
        if (feedbackEl) {
          feedbackEl.innerText =
            "카메라에 전신(무릎 밑까지)이 나오도록 뒤로 물러나주세요!";
          feedbackEl.style.fontSize = "18px";
        }
        return;
      }

      if (!latestTrainerPoseLandmarks) {
        if (feedbackEl) {
          feedbackEl.innerText = "트레이너 자세를 분석 중입니다...";
          feedbackEl.style.fontSize = "20px";
        }
        return;
      }

      const trainerAngles = getCoreJointAngles(latestTrainerPoseLandmarks);
      const userAngles = getCoreJointAngles(userLandmarks);
      if (!trainerAngles || !userAngles) {
        if (feedbackEl) {
          feedbackEl.innerText =
            "팔과 상체가 잘 보이도록 카메라 각도를 조정해 주세요.";
          feedbackEl.style.fontSize = "18px";
        }
        return;
      }

      const { score } = getAgreementRate(trainerAngles, userAngles);
      window.updateAccuracyUI?.(score);

      if (feedbackEl) {
        feedbackEl.innerText = buildFeedback(trainerAngles, userAngles);
        feedbackEl.style.fontSize = "22px";
      }
    };

    const startCompareLoop = () => {
      if (poseCompareTimer) return;
      poseCompareTimer = setInterval(() => {
        runCompareTick();
      }, intervalMs);
    };

    const stopCompareLoop = () => {
      if (!poseCompareTimer) return;
      clearInterval(poseCompareTimer);
      poseCompareTimer = null;
    };

    trainerVideo.addEventListener("play", startCompareLoop);
    trainerVideo.addEventListener("pause", stopCompareLoop);
    trainerVideo.addEventListener("ended", stopCompareLoop);

    if (!trainerVideo.paused && !trainerVideo.ended) {
      startCompareLoop();
    }
  }

  window.initTrainerPoseCompare = initTrainerPoseCompare;
})();

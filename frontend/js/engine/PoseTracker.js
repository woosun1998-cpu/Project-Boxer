// =============================================
// PoseTracker.js - MediaPipe Pose wrapper
// Tracks the user's pose and forwards landmarks to the game.
// =============================================

class PoseTracker {
  constructor(videoEl, canvasEl, onPose) {
    this.video = videoEl;
    this.canvas = canvasEl;
    this.ctx = canvasEl.getContext('2d');
    this.onPose = onPose;
    this.pose = null;
    this.camera = null;
    this.latestLandmarks = null;
    this.isRunning = false;
  }

  async init() {
    console.debug('[PoseTracker] init start', {
      hasMediaDevices: !!navigator.mediaDevices?.getUserMedia,
      videoWidth: this.video?.videoWidth || 0,
      videoHeight: this.video?.videoHeight || 0,
    });

    if (typeof Pose === 'undefined') {
      console.error('[PoseTracker] MediaPipe Pose is missing');
      throw new Error('MediaPipe Pose가 로드되지 않았습니다.');
    }

    this.pose = new Pose({
      locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
    });

    this.pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.7,
    });

    this.pose.onResults(results => this._onResults(results));

    this.camera = new Camera(this.video, {
      onFrame: async () => {
        if (this.pose && this.isRunning) {
          try {
            await this.pose.send({ image: this.video });
          } catch (err) {
            console.error('[PoseTracker] pose.send failed', err);
          }
        }
      },
      width: 640,
      height: 480,
    });

    this.isRunning = true;
    console.debug('[PoseTracker] camera.start() requested');
    try {
      await this.camera.start();
    } catch (err) {
      console.error('[PoseTracker] camera.start() failed', err);
      throw err;
    }
    console.debug('[PoseTracker] camera.start() resolved');

    this.canvas.width = this.video.videoWidth || 640;
    this.canvas.height = this.video.videoHeight || 480;
  }

  _onResults(results) {
    if (!this.isRunning) return;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (!results.poseLandmarks) {
      this.latestLandmarks = null;
      this.onPose(null);
      return;
    }

    this.latestLandmarks = results.poseLandmarks;

    if (typeof drawConnectors !== 'undefined') {
      drawConnectors(
        this.ctx,
        results.poseLandmarks,
        POSE_CONNECTIONS,
        { color: 'rgba(0,122,255,0.7)', lineWidth: 2 }
      );
    }

    if (typeof drawLandmarks !== 'undefined') {
      drawLandmarks(
        this.ctx,
        results.poseLandmarks,
        { color: '#FF2D55', lineWidth: 1, radius: 3 }
      );
    }

    this.onPose(results.poseLandmarks);
  }

  getSnapshot() {
    return this.latestLandmarks;
  }

  async stop() {
    this.isRunning = false;
    if (this.camera) {
      await this.camera.stop?.();
      this.camera = null;
    }
    if (this.pose) {
      await this.pose.close?.();
      this.pose = null;
    }
    this.latestLandmarks = null;
  }
}

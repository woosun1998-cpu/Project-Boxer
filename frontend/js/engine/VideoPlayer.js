// =============================================
// VideoPlayer.js
// Trigger sparring impact timestamps from video playback.
// =============================================

class BoxingVideoPlayer {
  constructor(videoEl, timestamps, onImpact) {
    this.video = videoEl;
    this.timestamps = Array.isArray(timestamps) ? timestamps : [];
    this.onImpact = onImpact;
    this.triggered = new Set();
    this.lastTime = 0;
    this._bound = null;
    this.setupEvents();
  }

  setupEvents() {
    this._bound = () => {
      const now = Number(this.video.currentTime || 0);
      const prev = this.lastTime;
      this.lastTime = now;

      if (!this.timestamps.length) {
        return;
      }

      // If the video loops or the user seeks backwards, allow the same
      // timestamps to fire again.
      if (now + 0.02 < prev) {
        this.triggered.clear();
      }

      for (const ts of this.timestamps) {
        const impactTime = Number(ts?.impact_time);
        if (!Number.isFinite(impactTime)) continue;

        const key = `${ts.id ?? 'ts'}-${impactTime}`;
        if (this.triggered.has(key)) continue;

        const crossedImpact = prev <= impactTime && now >= impactTime;
        const nearImpact = Math.abs(now - impactTime) <= 0.12;

        if (crossedImpact || nearImpact) {
          this.triggered.add(key);
          if (typeof this.onImpact === 'function') {
            this.onImpact(ts);
          }
        }
      }
    };

    this.video.addEventListener('timeupdate', this._bound);
    this.video.addEventListener('seeked', this._bound);
    this.video.addEventListener('play', this._bound);
  }

  play() {
    return this.video.play();
  }

  pause() {
    this.video.pause();
  }

  reset() {
    this.video.currentTime = 0;
    this.triggered.clear();
    this.lastTime = 0;
  }

  destroy() {
    if (this._bound) {
      this.video.removeEventListener('timeupdate', this._bound);
      this.video.removeEventListener('seeked', this._bound);
      this.video.removeEventListener('play', this._bound);
    }
  }
}

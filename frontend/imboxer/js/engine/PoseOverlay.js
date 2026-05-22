/**
 * PoseOverlay — draws MediaPipe pose landmarks on a canvas overlay.
 * Pure visual layer: no scoring, no state, no side effects.
 * Silently no-ops when landmarks are null or canvas is missing.
 */

const CONNECTIONS = [
  [0, 11], [0, 12],   // nose → shoulders
  [11, 12],           // shoulder bar
  [11, 13], [13, 15], // left arm (elbow, wrist)
  [12, 14], [14, 16], // right arm
  [11, 23], [12, 24], // torso sides
  [23, 24],           // hip bar
  [23, 25], [25, 27], // left leg
  [24, 26], [26, 28], // right leg
];

// Indices drawn as joints (circles)
const JOINT_INDICES = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];

const VISIBILITY_THRESHOLD = 0.4;

const STYLE = {
  lineColor: "rgba(255, 106, 0, 0.72)",   // --accent orange
  lineWidth: 2.5,
  jointColor: "rgba(255, 154, 61, 0.90)", // --warm
  jointRadius: 4,
  jointGlow: "rgba(255, 106, 0, 0.35)",
  glowBlur: 8,
};

function getCanvas(canvasEl) {
  if (!canvasEl || !(canvasEl instanceof HTMLCanvasElement)) return null;
  return canvasEl;
}

function syncSize(canvas) {
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width || canvas.offsetWidth || 0));
  const h = Math.max(1, Math.round(rect.height || canvas.offsetHeight || 0));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
}

function getMediaElement(canvas) {
  const parent = canvas?.parentElement;
  if (!parent) return null;

  const video = parent.querySelector("video");
  if (video instanceof HTMLVideoElement) {
    return video;
  }

  const image = parent.querySelector("img");
  if (image instanceof HTMLImageElement) {
    return image;
  }

  return null;
}

function getMediaSourceSize(mediaEl) {
  if (!mediaEl) {
    return null;
  }

  if (mediaEl instanceof HTMLVideoElement) {
    const width = mediaEl.videoWidth || mediaEl.clientWidth || 0;
    const height = mediaEl.videoHeight || mediaEl.clientHeight || 0;
    return width > 0 && height > 0 ? { width, height } : null;
  }

  if (mediaEl instanceof HTMLImageElement) {
    const width = mediaEl.naturalWidth || mediaEl.clientWidth || 0;
    const height = mediaEl.naturalHeight || mediaEl.clientHeight || 0;
    return width > 0 && height > 0 ? { width, height } : null;
  }

  return null;
}

function getRenderedContentRect(canvas, mediaEl) {
  const source = getMediaSourceSize(mediaEl);
  const width = canvas.width;
  const height = canvas.height;

  if (!source || width <= 0 || height <= 0) {
    return { x: 0, y: 0, width, height };
  }

  const style = globalThis.getComputedStyle ? globalThis.getComputedStyle(mediaEl) : null;
  const objectFit = style?.objectFit || "fill";
  if (objectFit === "fill") {
    return { x: 0, y: 0, width, height };
  }

  const scaleX = width / source.width;
  const scaleY = height / source.height;
  let scale = 1;

  if (objectFit === "contain" || objectFit === "scale-down") {
    scale = Math.min(scaleX, scaleY);
    if (objectFit === "scale-down") {
      scale = Math.min(1, scale);
    }
  } else {
    scale = Math.max(scaleX, scaleY);
  }

  const renderWidth = source.width * scale;
  const renderHeight = source.height * scale;
  const offsetX = (width - renderWidth) / 2;
  const offsetY = (height - renderHeight) / 2;

  return {
    x: offsetX,
    y: offsetY,
    width: renderWidth,
    height: renderHeight,
  };
}

function clear(canvasEl) {
  const canvas = getCanvas(canvasEl);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function draw(canvasEl, landmarks, mediaEl = null) {
  const canvas = getCanvas(canvasEl);
  if (!canvas) return;

  syncSize(canvas);

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!Array.isArray(landmarks) || landmarks.length === 0) return;

  const targetMedia = mediaEl || getMediaElement(canvas);
  const rect = getRenderedContentRect(canvas, targetMedia);

  function lm(index) {
    const pt = landmarks[index];
    if (!pt) return null;
    if ((pt.visibility ?? 1) < VISIBILITY_THRESHOLD) return null;
    return {
      x: rect.x + (pt.x * rect.width),
      y: rect.y + (pt.y * rect.height),
    };
  }

  // Connections
  ctx.save();
  ctx.strokeStyle = STYLE.lineColor;
  ctx.lineWidth = STYLE.lineWidth;
  ctx.lineCap = "round";

  for (const [a, b] of CONNECTIONS) {
    const pa = lm(a);
    const pb = lm(b);
    if (!pa || !pb) continue;
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
  }

  ctx.restore();

  // Joints
  for (const idx of JOINT_INDICES) {
    const pt = lm(idx);
    if (!pt) continue;

    // Glow
    ctx.save();
    ctx.shadowColor = STYLE.jointGlow;
    ctx.shadowBlur = STYLE.glowBlur;
    ctx.fillStyle = STYLE.jointColor;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, STYLE.jointRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function show(canvasEl) {
  const canvas = getCanvas(canvasEl);
  if (canvas) canvas.style.display = "";
}

function hide(canvasEl) {
  const canvas = getCanvas(canvasEl);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  canvas.style.display = "none";
}

const PoseOverlay = { draw, clear, show, hide };

if (typeof window !== "undefined") {
  window.IM_BOXER_POSE_OVERLAY = PoseOverlay;
}

export default PoseOverlay;

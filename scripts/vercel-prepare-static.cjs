/**
 * Vercel 배포 전 정적 자산 준비
 *
 * URL → 배포 파일 경로 (outputDirectory: frontend 기준)
 *   /video/파일.mp4              → frontend/video/파일.mp4
 *   /assets/videos/...           → frontend/imboxer/assets/videos/...  (vercel.json rewrite)
 *
 * 1순위: public/video, public/assets/videos (Git·Vercel에 올리는 원본)
 * 2순위: 로컬에만 있는 레거시 경로(있을 때만, public에 없는 파일만 보충)
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PUBLIC = path.join(ROOT, "public");
const FRONTEND = path.join(ROOT, "frontend");

/** 복사 대상 (public → frontend) */
const COPY_RULES = [
  {
    label: "스파링·다이어트 (/video/)",
    from: path.join(PUBLIC, "video"),
    to: path.join(FRONTEND, "video"),
    urlExample: "/video/스파링초보.mp4",
  },
  {
    label: "훈련·튜토리얼·스파링 UI (/assets/videos/)",
    from: path.join(PUBLIC, "assets", "videos"),
    to: path.join(FRONTEND, "imboxer", "assets", "videos"),
    urlExample: "/assets/videos/tutorials/tutorial_guide.mp4",
  },
  {
    label: "이미지 (/assets/images/)",
    from: path.join(PUBLIC, "assets", "images"),
    to: path.join(FRONTEND, "imboxer", "assets", "images"),
    urlExample: "/assets/images/...",
    optional: true,
  },
];

/** public에 없을 때만 보충 (로컬 마이그레이션용) */
const LEGACY_FALLBACKS = [
  {
    from: path.join(FRONTEND, "video"),
    to: path.join(FRONTEND, "video"),
  },
  {
    from: path.join(FRONTEND, "imboxer", "assets", "videos"),
    to: path.join(FRONTEND, "imboxer", "assets", "videos"),
  },
];

const MEDIA_EXT = new Set([
  ".mp4",
  ".webm",
  ".m4a",
  ".mov",
  ".mkv",
  ".ogg",
]);

/** 배포 후 404 여부를 빌드 로그로 점검할 대표 파일 */
const SPOT_CHECK = [
  { rel: "video/스파링초보.mp4", url: "/video/스파링초보.mp4" },
  { rel: "video/스파링보통.mp4", url: "/video/스파링보통.mp4" },
  {
    rel: "imboxer/assets/videos/tutorials/tutorial_guide.mp4",
    url: "/assets/videos/tutorials/tutorial_guide.mp4",
  },
  {
    rel: "imboxer/assets/videos/training/tutorial-jab.mp4",
    url: "/assets/videos/training/tutorial-jab.mp4",
  },
];

function isPlaceholder(name) {
  return name === ".gitkeep" || name === ".gitignore" || name === "README.md";
}

function isMediaFile(filePath) {
  return MEDIA_EXT.has(path.extname(filePath).toLowerCase());
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * src → dest 병합 복사
 * @param {object} opts
 * @param {boolean} opts.skipExisting dest에 이미 있으면 건너뜀 (레거시 폴백용)
 */
function copyDirMerge(src, dest, opts) {
  const skipExisting = opts && opts.skipExisting;
  if (!fs.existsSync(src)) {
    return { files: 0, bytes: 0, skipped: 0 };
  }

  ensureDir(dest);
  let files = 0;
  let bytes = 0;
  let skipped = 0;

  for (const name of fs.readdirSync(src)) {
    if (isPlaceholder(name)) continue;

    const from = path.join(src, name);
    const to = path.join(dest, name);
    const stat = fs.statSync(from);

    if (stat.isDirectory()) {
      const sub = copyDirMerge(from, to, opts);
      files += sub.files;
      bytes += sub.bytes;
      skipped += sub.skipped;
      continue;
    }

    if (skipExisting && fs.existsSync(to)) {
      skipped += 1;
      continue;
    }

    ensureDir(path.dirname(to));
    fs.copyFileSync(from, to);
    files += 1;
    bytes += stat.size;
  }

  return { files, bytes, skipped };
}

function countMediaInDir(dir) {
  if (!fs.existsSync(dir)) return 0;
  let n = 0;
  const walk = (d) => {
    for (const name of fs.readdirSync(d)) {
      if (isPlaceholder(name)) continue;
      const p = path.join(d, name);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (isMediaFile(p)) n += 1;
    }
  };
  walk(dir);
  return n;
}

function formatBytes(n) {
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
  return (n / (1024 * 1024)).toFixed(1) + " MB";
}

function runRule(rule) {
  if (!fs.existsSync(rule.from)) {
    ensureDir(rule.to);
    return {
      label: rule.label,
      from: rule.from,
      to: rule.to,
      files: 0,
      bytes: 0,
      skipped: 0,
      missingSrc: true,
      urlExample: rule.urlExample,
    };
  }
  const result = copyDirMerge(rule.from, rule.to);
  return {
    label: rule.label,
    from: rule.from,
    to: rule.to,
    ...result,
    missingSrc: false,
    urlExample: rule.urlExample,
  };
}

function runLegacyFallbacks() {
  let total = { files: 0, bytes: 0, skipped: 0 };
  for (const fb of LEGACY_FALLBACKS) {
    if (!fs.existsSync(fb.from)) continue;
    const r = copyDirMerge(fb.from, fb.to, { skipExisting: true });
    total.files += r.files;
    total.bytes += r.bytes;
    total.skipped += r.skipped;
  }
  return total;
}

function spotCheck() {
  const missing = [];
  const ok = [];
  for (const item of SPOT_CHECK) {
    const abs = path.join(FRONTEND, item.rel);
    if (fs.existsSync(abs)) ok.push(item.url);
    else missing.push(item.url);
  }
  return { ok, missing };
}

function main() {
  console.log("[vercel-prepare-static] 정적 자산 복사 시작\n");

  const reports = [];
  for (const rule of COPY_RULES) {
    const r = runRule(rule);
    reports.push(r);
    const mediaBefore = countMediaInDir(r.to);
    console.log(
      "• " + r.label,
      "\n  " + r.from.replace(ROOT + path.sep, ""),
      "→",
      r.to.replace(ROOT + path.sep, ""),
    );
    if (r.missingSrc) {
      console.log("  (소스 폴더 없음 — public에 생성 후 mp4를 넣으세요)");
    } else {
      console.log(
        "  복사:",
        r.files,
        "개,",
        formatBytes(r.bytes),
        "| 미디어 합계:",
        mediaBefore,
        "개",
      );
    }
    if (r.urlExample) console.log("  URL 예:", r.urlExample);
    console.log("");
  }

  const legacy = runLegacyFallbacks();
  if (legacy.files > 0) {
    console.log(
      "• 레거시 경로 보충 (public에 없던 파일만):",
      legacy.files,
      "개,",
      formatBytes(legacy.bytes),
    );
    console.log("");
  }

  const totalVideo = countMediaInDir(path.join(FRONTEND, "video"));
  const totalAssetsVideos = countMediaInDir(
    path.join(FRONTEND, "imboxer", "assets", "videos"),
  );

  console.log("[vercel-prepare-static] 요약");
  console.log("  frontend/video 미디어:", totalVideo, "개");
  console.log("  frontend/imboxer/assets/videos 미디어:", totalAssetsVideos, "개");

  const { ok, missing } = spotCheck();
  if (ok.length) {
    console.log("\n  배포 URL 점검 OK (샘플):");
    ok.forEach((u) => console.log("    ", u));
  }
  if (missing.length) {
    console.warn("\n  [경고] 아래 URL은 배포 후 404 가능 (파일 없음):");
    missing.forEach((u) => console.warn("    ", u));
    console.warn(
      "\n  → public/video/, public/assets/videos/ 에 mp4를 넣고 Git push 하세요.",
      "\n  → 가이드: md/VERCEL_PUBLIC_ASSET_MIGRATION.md",
    );
  }

  const publicVideoCount = countMediaInDir(path.join(PUBLIC, "video"));
  const publicAssetsVideoCount = countMediaInDir(
    path.join(PUBLIC, "assets", "videos"),
  );

  if (publicVideoCount === 0) {
    console.warn(
      "\n[vercel-prepare-static] public/video/ 에 mp4가 없습니다.",
      "Git push 시 Vercel에서 /video/... 가 404 됩니다.",
      "(로컬 frontend/video 만 있으면 배포 서버에는 포함되지 않습니다)",
    );
  }
  if (publicAssetsVideoCount === 0) {
    console.warn(
      "[vercel-prepare-static] public/assets/videos/ 에 mp4가 없습니다.",
      "Git push 시 Vercel에서 /assets/videos/... 가 404 됩니다.",
    );
  }

  console.log("\n[vercel-prepare-static] 완료");
}

main();

/**
 * Vercel 배포 전 정적 자산 준비
 *
 * 순서:
 *   1) frontend/video → public/video  (로컬 원본 → Git LFS 대상)
 *   2) public → frontend 복사         (배포 산출물)
 *
 * URL (outputDirectory: frontend)
 *   /video/파일.mp4     → frontend/video/파일.mp4
 *   /assets/videos/...  → frontend/imboxer/assets/videos/...
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PUBLIC = path.join(ROOT, "public");
const FRONTEND = path.join(ROOT, "frontend");

const FRONTEND_VIDEO = path.join(FRONTEND, "video");
const PUBLIC_VIDEO = path.join(PUBLIC, "video");

/** public → frontend 배포 복사 */
const COPY_RULES = [
  {
    label: "스파링·다이어트 (/video/)",
    from: PUBLIC_VIDEO,
    to: FRONTEND_VIDEO,
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

const LEGACY_FALLBACKS = [
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

/** 빌드 통과용 최소 mp4 (ftyp 박스만 — 재생 불가, 플레이스홀더) */
const MINIMAL_MP4 = Buffer.from([
  0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
  0x00, 0x00, 0x02, 0x00, 0x69, 0x73, 0x6f, 0x6d, 0x69, 0x73, 0x6f, 0x32,
]);

function isPlaceholder(name) {
  return (
    name === ".gitkeep" ||
    name === ".gitignore" ||
    name === "README.md" ||
    name.startsWith("_build_")
  );
}

function isMediaFile(filePath) {
  return MEDIA_EXT.has(path.extname(filePath).toLowerCase());
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyDirMerge(src, dest, opts) {
  const skipExisting = opts && opts.skipExisting;
  const logEach = opts && opts.logEach;
  if (!fs.existsSync(src)) {
    return { files: 0, bytes: 0, skipped: 0, copiedList: [] };
  }

  ensureDir(dest);
  let files = 0;
  let bytes = 0;
  let skipped = 0;
  const copiedList = [];

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
      copiedList.push(...sub.copiedList);
      continue;
    }

    if (!isMediaFile(from) && opts && opts.mediaOnly) continue;

    if (skipExisting && fs.existsSync(to)) {
      skipped += 1;
      continue;
    }

    if (opts && opts.skipIfSameSize && fs.existsSync(to)) {
      const destStat = fs.statSync(to);
      if (destStat.isFile() && destStat.size === stat.size) {
        skipped += 1;
        continue;
      }
    }

    ensureDir(path.dirname(to));
    fs.copyFileSync(from, to);
    files += 1;
    bytes += stat.size;
    const relDest = path.relative(ROOT, to).split(path.sep).join("/");
    copiedList.push(relDest);
    if (logEach) {
      const relSrc = path.relative(ROOT, from).split(path.sep).join("/");
      console.log("    [복사]", relSrc, "→", relDest, `(${formatBytes(stat.size)})`);
    }
  }

  return { files, bytes, skipped, copiedList };
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

/** frontend/video 내 모든 .mp4 목록 (1단계 폴더) */
function listFrontendMp4Files() {
  const list = [];
  if (!fs.existsSync(FRONTEND_VIDEO)) return list;
  for (const name of fs.readdirSync(FRONTEND_VIDEO)) {
    if (isPlaceholder(name)) continue;
    const p = path.join(FRONTEND_VIDEO, name);
    if (!fs.statSync(p).isFile()) continue;
    if (path.extname(name).toLowerCase() === ".mp4") {
      list.push(name);
    }
  }
  return list;
}

/**
 * frontend/video/*.mp4 → public/video/*.mp4 강제 복사 (항상 덮어씀)
 * 에러 시 throw 하지 않고 errors 배열에 기록
 */
function forceCopyAllMp4ToPublic() {
  const report = {
    copied: [],
    failed: [],
    skipped: [],
    totalBytes: 0,
  };

  ensureDir(PUBLIC_VIDEO);

  const mp4Files = listFrontendMp4Files();
  if (mp4Files.length === 0) {
    return report;
  }

  for (const name of mp4Files) {
    const from = path.join(FRONTEND_VIDEO, name);
    const to = path.join(PUBLIC_VIDEO, name);

    try {
      const stat = fs.statSync(from);
      fs.copyFileSync(from, to);
      report.copied.push(name);
      report.totalBytes += stat.size;
      console.log(
        "    [강제 복사]",
        name,
        "→ public/video/",
        `(${formatBytes(stat.size)})`,
      );
    } catch (err) {
      const msg = err && err.message ? err.message : String(err);
      report.failed.push({ name, error: msg });
      console.warn("    [복사 실패]", name, "—", msg);
    }
  }

  return report;
}

/** 1) 로컬 frontend/video → public/video (Git·LFS에 올릴 원본) */
function syncFrontendVideoToPublic() {
  console.log("• [1/2] frontend/video → public/video (mp4 강제 동기화)");

  if (process.env.VERCEL === "1") {
    console.log(
      "  Vercel CI: frontend/video 는 저장소에 없음(gitignore).",
      "public/video(LFS)만 frontend 로 복사합니다.\n",
    );
    return { files: 0, bytes: 0, failed: [] };
  }

  if (process.env.SKIP_VIDEO_SYNC === "1") {
    console.log("  SKIP_VIDEO_SYNC=1 — 동기화 건너뜀\n");
    return { files: 0, bytes: 0, failed: [] };
  }

  if (!fs.existsSync(FRONTEND_VIDEO)) {
    console.log("  (frontend/video 없음 — 건너뜀)\n");
    return { files: 0, bytes: 0, failed: [] };
  }

  const mp4List = listFrontendMp4Files();
  console.log("  frontend/video mp4:", mp4List.length, "개");

  const force = forceCopyAllMp4ToPublic();

  const srcCount = mp4List.length;
  const destCount = countMediaInDir(PUBLIC_VIDEO);
  const destMp4 = listMediaRelative(PUBLIC_VIDEO).filter((r) =>
    r.toLowerCase().endsWith(".mp4"),
  );

  console.log(
    "  강제 복사 성공:",
    force.copied.length,
    "개,",
    formatBytes(force.totalBytes),
    "| public/video mp4:",
    destMp4.length,
    "개",
  );

  if (force.failed.length > 0) {
    console.warn("  [경고] 복사 실패", force.failed.length, "개:");
    force.failed.forEach((f) => console.warn("    -", f.name, ":", f.error));
  }

  if (srcCount > force.copied.length) {
    console.warn(
      "  [경고] frontend mp4",
      srcCount,
      "개 중",
      force.copied.length,
      "개만 public/video 에 반영됨 (디스크 부족 등 확인)",
    );
  }

  if (force.copied.length > 0) {
    console.log("  → push 전: git add public/video && git lfs ls-files public/video");
  }
  console.log("");

  return {
    files: force.copied.length,
    bytes: force.totalBytes,
    failed: force.failed,
  };
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
      copiedList: [],
      missingSrc: true,
      urlExample: rule.urlExample,
    };
  }
  const result = copyDirMerge(rule.from, rule.to, { logEach: true });
  return {
    label: rule.label,
    from: rule.from,
    to: rule.to,
    ...result,
    copiedList: result.copiedList || [],
    missingSrc: false,
    urlExample: rule.urlExample,
  };
}

function runLegacyFallbacks() {
  let total = { files: 0, bytes: 0 };
  for (const fb of LEGACY_FALLBACKS) {
    if (!fs.existsSync(fb.from)) continue;
    const r = copyDirMerge(fb.from, fb.to, { skipExisting: true, mediaOnly: true });
    total.files += r.files;
    total.bytes += r.bytes;
  }
  return total;
}

function patchVercelApiRewrite() {
  const apiUrl = (process.env.API_URL || "").trim().replace(/\/$/, "");
  if (!apiUrl) return;

  const vercelPath = path.join(ROOT, "vercel.json");
  if (!fs.existsSync(vercelPath)) return;

  const cfg = JSON.parse(fs.readFileSync(vercelPath, "utf8"));
  cfg.rewrites = (cfg.rewrites || []).filter((r) => r.source !== "/api/:path*");
  cfg.rewrites.unshift({
    source: "/api/:path*",
    destination: `${apiUrl}/api/:path*`,
  });
  fs.writeFileSync(vercelPath, JSON.stringify(cfg, null, 2) + "\n", "utf8");
  console.log("• vercel.json /api rewrite →", apiUrl + "/api/:path*");
  console.log("");
}

function logApiDeployHint() {
  const apiUrl = (process.env.API_URL || "").trim().replace(/\/$/, "");
  console.log("• API 호출: 프론트는 상대 경로 /api/... 만 사용");
  if (apiUrl) {
    console.log("  Vercel rewrite 대상 (API_URL):", apiUrl);
  } else {
    console.log("  (API_URL 미설정 — Vercel /api rewrite를 설정하세요)");
  }
  console.log("");
}

function listMediaRelative(dir) {
  const rels = [];
  if (!fs.existsSync(dir)) return rels;
  const walk = (current, prefix) => {
    for (const name of fs.readdirSync(current)) {
      if (isPlaceholder(name)) continue;
      const p = path.join(current, name);
      if (fs.statSync(p).isDirectory()) {
        walk(p, prefix ? prefix + name + "/" : name + "/");
      } else if (isMediaFile(p)) {
        rels.push(prefix + name);
      }
    }
  };
  walk(dir, "");
  return rels;
}

function listAllPublicMedia() {
  const list = [];
  list.push(...listMediaRelative(PUBLIC_VIDEO).map((r) => "video/" + r));
  list.push(
    ...listMediaRelative(path.join(PUBLIC, "assets", "videos")).map(
      (r) => "assets/videos/" + r,
    ),
  );
  return list;
}

function verifyCopyIntegrity(rule) {
  const warnings = [];
  const srcMedia = listMediaRelative(rule.from);

  for (const rel of srcMedia) {
    const srcPath = path.join(rule.from, rel);
    const destPath = path.join(rule.to, rel);
    const publicRel = path.relative(PUBLIC, srcPath).split(path.sep).join("/");
    const frontendRel = path.relative(FRONTEND, destPath).split(path.sep).join("/");

    if (!fs.existsSync(destPath)) {
      warnings.push(`복사 누락: public/${publicRel} → frontend/${frontendRel}`);
      continue;
    }

    const srcSize = fs.statSync(srcPath).size;
    const destSize = fs.statSync(destPath).size;
    if (srcSize !== destSize) {
      warnings.push(
        `크기 불일치: public/${publicRel} (${formatBytes(srcSize)}) ≠ frontend/${frontendRel}`,
      );
    }
  }

  return warnings;
}

/** 영상 0개일 때 빌드는 통과 — 플레이스홀더·안내 파일만 생성 */
function ensureVideoPlaceholders() {
  const publicCount = countMediaInDir(PUBLIC_VIDEO);
  const frontendCount = countMediaInDir(FRONTEND_VIDEO);

  if (publicCount > 0 && frontendCount > 0) return;

  ensureDir(PUBLIC_VIDEO);
  ensureDir(FRONTEND_VIDEO);

  const markerPath = path.join(PUBLIC_VIDEO, "_build_video_sync_required.txt");
  const marker =
    "영상이 Git에 없습니다. 로컬에서 npm run build 후 public/video 를 git lfs add && push 하세요.\n";
  fs.writeFileSync(markerPath, marker, "utf8");

  if (frontendCount === 0) {
    const placeholderName = "_build_placeholder.mp4";
    const publicPlaceholder = path.join(PUBLIC_VIDEO, placeholderName);
    const frontendPlaceholder = path.join(FRONTEND_VIDEO, placeholderName);
    if (!fs.existsSync(publicPlaceholder)) {
      fs.writeFileSync(publicPlaceholder, MINIMAL_MP4);
    }
    if (!fs.existsSync(frontendPlaceholder)) {
      fs.copyFileSync(publicPlaceholder, frontendPlaceholder);
    }
    console.warn(
      "[vercel-prepare-static] [경고] 영상 없음 — 빌드용 플레이스홀더만 생성했습니다.",
      "실제 mp4는 public/video 에 넣고 LFS push 하세요.",
    );
  }
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
  console.log("[vercel-prepare-static] 정적 자산 준비 시작\n");

  patchVercelApiRewrite();
  logApiDeployHint();

  syncFrontendVideoToPublic();

  console.log("• [2/2] public → frontend (Vercel 배포 산출)");

  const publicMedia = listAllPublicMedia();
  if (publicMedia.length === 0) {
    console.log("  public/ 영상: (없음)");
  } else {
    console.log("  public/ 영상 인벤토리:");
    publicMedia.forEach((rel) => console.log("   - public/" + rel));
  }
  console.log("");

  const allCopied = [];
  for (const rule of COPY_RULES) {
    const r = runRule(rule);
    console.log(
      "• " + r.label,
      "\n  " + r.from.replace(ROOT + path.sep, ""),
      "→",
      r.to.replace(ROOT + path.sep, ""),
    );
    if (r.missingSrc) {
      console.log("  (public 소스 없음)");
    } else {
      console.log(
        "  복사:",
        r.files,
        "개,",
        formatBytes(r.bytes),
        "| dest 미디어:",
        countMediaInDir(r.to),
        "개",
      );
    }
    if (r.urlExample) console.log("  URL 예:", r.urlExample);
    if (r.copiedList.length) allCopied.push(...r.copiedList);
    console.log("");
  }

  const legacy = runLegacyFallbacks();
  if (legacy.files > 0) {
    console.log("• imboxer/assets/videos 레거시 보충:", legacy.files, "개");
    console.log("");
  }

  ensureVideoPlaceholders();

  const copyWarnings = [];
  for (const rule of COPY_RULES) {
    if (rule.optional) continue;
    copyWarnings.push(...verifyCopyIntegrity(rule));
  }
  if (copyWarnings.length) {
    console.warn("\n  [경고] 복사 검증:");
    copyWarnings.forEach((w) => console.warn("    ", w));
  }

  const totalVideo = countMediaInDir(FRONTEND_VIDEO);
  const publicVideoCount = countMediaInDir(PUBLIC_VIDEO);

  console.log("[vercel-prepare-static] 요약");
  console.log("  public/video:", publicVideoCount, "개");
  console.log("  frontend/video:", totalVideo, "개");
  console.log("  public → frontend 복사:", allCopied.length, "개");

  const { ok, missing } = spotCheck();
  if (ok.length) {
    console.log("\n  URL 샘플 OK:");
    ok.forEach((u) => console.log("    ", u));
  }
  if (missing.length) {
    console.warn("\n  [경고] 배포 후 404 가능:");
    missing.forEach((u) => console.warn("    ", u));
  }

  if (publicVideoCount === 0) {
    console.warn(
      "\n[vercel-prepare-static] public/video 가 비어 있습니다.",
      "로컬: frontend/video 를 채운 뒤 npm run build → git add public/video → LFS push",
    );
  }

  console.log("\n[vercel-prepare-static] 완료 (빌드 계속)");
}

main();

/**
 * scripts/pro-array.js (복싱프로.mp4 타임스탬프) → cpuAttacksData.js pro 배열 교체
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const srcPath = path.join(__dirname, "pro-array.js");
const dataPath = path.join(root, "frontend", "js", "sparring", "cpuAttacksData.js");

const userArr = vm.runInNewContext(fs.readFileSync(srcPath, "utf8"));
const lines = userArr.map(
  (o) => `    { time: ${o.time}, type: "${o.type}" },`
);
const block = `  // === 프로 (복싱프로.mp4) — ${userArr.length}개 ===
  pro: [
${lines.join("\n")}
  ].map((atk) => ({ ...atk, handled: false }))`;

let src = fs.readFileSync(dataPath, "utf8");
src = src.replace(
  /  \/\/ === 프로[\s\S]*?\]\.map\(\(atk\) => \(\{ \.\.\.atk, handled: false \}\)\)\s*\};?/,
  `${block}\n};`,
);
if (!src.includes("=== 프로 (복싱프로.mp4)")) {
  throw new Error("pro 섹션 치환 실패");
}
fs.writeFileSync(dataPath, src, "utf8");
console.log("pro", userArr.length, "→", dataPath);

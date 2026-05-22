/**
 * scripts/advanced-array.js → cpuAttacksData.js advanced 배열 교체
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const advPath = path.join(__dirname, "advanced-array.js");
const dataPath = path.join(root, "frontend", "js", "sparring", "cpuAttacksData.js");

const userArr = vm.runInNewContext(fs.readFileSync(advPath, "utf8"));
const lines = userArr.map(
  (o) => `    { time: ${o.time}, type: "${o.type}" },`
);
const block = `  // === 어려움 (스파링어려움.mp4) — ${userArr.length}개 ===
  advanced: [
${lines.join("\n")}
  ].map((atk) => ({ ...atk, handled: false })),`;

let src = fs.readFileSync(dataPath, "utf8");
src = src.replace(
  /  \/\/ === 어려움[\s\S]*?\]\.map\(\(atk\) => \(\{ \.\.\.atk, handled: false \}\)\),/,
  block
);
if (!src.includes("=== 어려움 (스파링어려움.mp4)")) {
  throw new Error("advanced 섹션 치환 실패");
}
fs.writeFileSync(dataPath, src, "utf8");
console.log("advanced", userArr.length, "→", dataPath);

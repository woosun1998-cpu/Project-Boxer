/**
 * scripts/cpu-attacks-intermediate.json → cpuAttacksData.js intermediate 배열 교체
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const jsonPath = path.join(__dirname, "cpu-attacks-intermediate.json");
const dataPath = path.join(root, "frontend", "js", "sparring", "cpuAttacksData.js");

const userArr = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
const lines = userArr.map(
  (o) => `    { time: ${o.time}, type: "${o.type}" },`
);
const block = `  // === 보통 (스파링보통.mp4) — ${userArr.length}개 ===
  intermediate: [
${lines.join("\n")}
  ].map((atk) => ({ ...atk, handled: false })),`;

let src = fs.readFileSync(dataPath, "utf8");
src = src.replace(
  /  \/\/ === 보통[\s\S]*?\]\.map\(\(atk\) => \(\{ \.\.\.atk, handled: false \}\)\),/,
  block
);
if (!src.includes("=== 보통 (스파링보통.mp4)")) {
  src = src.replace(
    /  intermediate: \[[\s\S]*?\]\.map\(\(atk\) => \(\{ \.\.\.atk, handled: false \}\)\),/,
    block
  );
}
fs.writeFileSync(dataPath, src, "utf8");
console.log("intermediate", userArr.length, "→", dataPath);

/**
 * user-beginner-attacks.json → cpuAttacksData.js 의 beginner 배열만 교체
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const jsonPath = path.join(__dirname, "user-beginner-attacks.json");
const dataPath = path.join(root, "frontend", "js", "sparring", "cpuAttacksData.js");

const userArr = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
const lines = userArr.map(
  (o) => `    { time: ${o.time}, type: "${o.type}" },`
);
const beginnerBlock = `  // === 초보 (스파링초보.mp4) — ${userArr.length}개 ===
  beginner: [
${lines.join("\n")}
  ].map((atk) => ({ ...atk, handled: false })),`;

let src = fs.readFileSync(dataPath, "utf8");
src = src.replace(
  /  \/\/ === 초보[\s\S]*?\]\.map\(\(atk\) => \(\{ \.\.\.atk, handled: false \}\)\),/,
  beginnerBlock
);
fs.writeFileSync(dataPath, src, "utf8");
console.log("beginner", userArr.length, "→", dataPath);

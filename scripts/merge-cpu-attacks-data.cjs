/**
 * 무엇: cpuAttacks10min.js + intermediate JSON + advanced 배열(JS) → frontend/js/sparring/cpuAttacksData.js
 * 실행: node scripts/merge-cpu-attacks-data.cjs
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const tenPath = path.join(root, "frontend", "js", "sparring", "cpuAttacks10min.js");
const intPath = path.join(root, "scripts", "cpu-attacks-intermediate.json");
const advPath = path.join(root, "scripts", "advanced-array.js");
const outPath = path.join(root, "frontend", "js", "sparring", "cpuAttacksData.js");

const tenSrc = fs.readFileSync(tenPath, "utf8");
const m = tenSrc.match(/Object\.freeze\(\[([\s\S]*)\]\)/);
if (!m) throw new Error("cpuAttacks10min.js 배열 파싱 실패");
const beginnerInner = m[1].trim();

const interArr = JSON.parse(fs.readFileSync(intPath, "utf8"));
if (!Array.isArray(interArr)) throw new Error("intermediate JSON은 배열이어야 합니다");

const formatAttackLines = (arr) =>
  arr
    .map(
      (o) =>
        `    { time: ${o.time}, type: "${String(o.type).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}" },`
    )
    .join("\n");

const interStr = formatAttackLines(interArr);

const advSrc = fs.readFileSync(advPath, "utf8");
const advArr = vm.runInNewContext(advSrc);
if (!Array.isArray(advArr)) throw new Error("advanced-array.js는 배열 리터럴이어야 합니다");
const advStr = formatAttackLines(advArr);

const out = `/**
 * 무엇: 난이도별 코치 타격 타임스탬프 통합 / 왜: sparring-game에서 URL level로 스위칭
 * beginner: 스파링초보(cpuAttacks10min과 동기) · intermediate: 스파링보통 · advanced: 스파링어려움
 * pro 미정의 시 게임에서 beginner로 폴백
 */
window.BOXER_CPU_ATTACKS = {
  beginner: [
${beginnerInner}
  ],
  intermediate: [
${interStr}
  ],
  advanced: [
${advStr}
  ],
};
`;

fs.writeFileSync(outPath, out, "utf8");
console.log("Wrote", outPath, "intermediate", interArr.length, "advanced", advArr.length);

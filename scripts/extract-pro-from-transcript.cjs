const fs = require("fs");
const path = require("path");

const transcriptPath = path.join(
  process.env.USERPROFILE || "",
  ".cursor/projects/c-Users-EZ-Downloads-boxer-woosunshin-frontend-v2-1/agent-transcripts/903f3cb0-1f76-4748-a6e6-80daf698a8c0/903f3cb0-1f76-4748-a6e6-80daf698a8c0.jsonl",
);

const lines = fs.readFileSync(transcriptPath, "utf8").split("\n");
const row = lines.find((l) => l.includes("pro: [") && l.includes("time: 4.41"));
if (!row) {
  console.error("pro array line not found in transcript");
  process.exit(1);
}

const obj = JSON.parse(row);
const text = obj.message.content[0].text;
const re = /\{\s*time:\s*([\d.]+),\s*type:\s*"([^"]+)"\s*\}/g;
const arr = [];
let m;
while ((m = re.exec(text)) !== null) {
  arr.push({ time: Number(m[1]), type: m[2] });
}
if (!arr.length || arr[0].time !== 4.41) {
  console.error("parsed array invalid", arr[0]);
  process.exit(1);
}
const outPath = path.join(__dirname, "pro-array.js");
const body = arr
  .map((o) => `  { time: ${o.time}, type: "${o.type}" },`)
  .join("\n");
fs.writeFileSync(outPath, `[\n${body}\n]\n`, "utf8");

console.log("count", arr.length);
console.log("first", arr[0]);
console.log("last", arr[arr.length - 1]);
console.log("wrote", outPath);

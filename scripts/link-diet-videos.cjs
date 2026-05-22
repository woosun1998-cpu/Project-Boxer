/**
 * 다이어트 복싱 영상 별칭
 * node scripts/link-diet-videos.cjs
 */
const fs = require("fs");
const path = require("path");

const videoDir = path.join(__dirname, "../frontend/video");

const STANDARD_MP4 =
  "20분 전신 HIIT 운동 1   고강도 지방 연소 및 탄력 강화 유산소 운동   장비 없음.mp4";
const INTENSE_MP4 = "30-Minute At-Home Boxing Workout (1).mp4";

const links = [
  ["다이어트복싱.mp4", "diet-light.mp4"],
  ["다이어트복싱.mp4", "라이트모드.mp4"],
  [STANDARD_MP4, "diet-standard.mp4"],
  [INTENSE_MP4, "diet-intense.mp4"],
];

for (const [src, dest] of links) {
  const from = path.join(videoDir, src);
  const to = path.join(videoDir, dest);
  if (!fs.existsSync(from)) {
    console.warn("skip (missing):", src);
    continue;
  }
  if (fs.existsSync(to)) {
    const sameSize = fs.statSync(from).size === fs.statSync(to).size;
    if (sameSize) {
      console.log("exists:", dest);
      continue;
    }
  }
  fs.copyFileSync(from, to);
  console.log("copied:", src, "->", dest);
}

for (const name of [STANDARD_MP4, INTENSE_MP4]) {
  const p = path.join(videoDir, name);
  console.log(fs.existsSync(p) ? "ok mp4:" : "MISSING:", name);
}

console.log("done");

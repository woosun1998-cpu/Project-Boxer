// Download all lh3.googleusercontent.com images referenced by frontend/**/*.html
// into frontend/image/cache/<id>.png and rewrite html files to local paths.
const fs = require("fs");
const path = require("path");
const https = require("https");

const ROOT = path.join(__dirname, "..", "frontend");
const CACHE = path.join(ROOT, "image", "cache");
fs.mkdirSync(CACHE, { recursive: true });

const RE_URL = /https:\/\/lh3\.googleusercontent\.com\/d\/([A-Za-z0-9_\-]+)=w\d+/g;

function walk(dir, acc) {
  acc = acc || [];
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const s = fs.statSync(p);
    if (s.isDirectory()) walk(p, acc);
    else if (name.endsWith(".html")) acc.push(p);
  }
  return acc;
}

function download(url, outPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outPath);
    https
      .get(url, (res) => {
        if (res.statusCode === 302 || res.statusCode === 301) {
          const next = res.headers.location;
          res.resume();
          file.close();
          try { fs.unlinkSync(outPath); } catch (e) {}
          return download(next, outPath).then(resolve, reject);
        }
        if (res.statusCode !== 200) {
          res.resume();
          file.close();
          try { fs.unlinkSync(outPath); } catch (e) {}
          return reject(new Error("HTTP " + res.statusCode));
        }
        res.pipe(file);
        file.on("finish", () => file.close(() => resolve(fs.statSync(outPath).size)));
      })
      .on("error", reject);
  });
}

(async () => {
  const htmls = walk(ROOT);
  const ids = new Set();
  for (const p of htmls) {
    const c = fs.readFileSync(p, "utf8");
    let m;
    RE_URL.lastIndex = 0;
    while ((m = RE_URL.exec(c)) !== null) ids.add(m[1]);
  }
  console.log("[scan] html files:", htmls.length, "distinct ids:", ids.size);

  const idArr = Array.from(ids);
  const failed = [];
  for (let i = 0; i < idArr.length; i++) {
    const id = idArr[i];
    const out = path.join(CACHE, id + ".png");
    if (fs.existsSync(out) && fs.statSync(out).size > 1024) {
      console.log("[skip] " + id + " (" + fs.statSync(out).size + "B)");
      continue;
    }
    const url = "https://lh3.googleusercontent.com/d/" + id + "=w2000";
    let attempt = 0;
    while (attempt < 3) {
      try {
        const sz = await download(url, out);
        console.log("[ok " + (i + 1) + "/" + idArr.length + "] " + id + " " + sz + "B");
        break;
      } catch (e) {
        attempt++;
        const wait = 1500 * attempt;
        console.log("[retry " + attempt + "] " + id + " :: " + e.message + " (wait " + wait + "ms)");
        await new Promise((r) => setTimeout(r, wait));
        if (attempt >= 3) {
          failed.push(id);
          try { fs.unlinkSync(out); } catch (e2) {}
        }
      }
    }
    await new Promise((r) => setTimeout(r, 600));
  }

  let touched = 0;
  for (const p of htmls) {
    const before = fs.readFileSync(p, "utf8");
    const after = before.replace(
      /https:\/\/lh3\.googleusercontent\.com\/d\/([A-Za-z0-9_\-]+)=w\d+/g,
      function (_m, id) { return "./image/cache/" + id + ".png"; }
    );
    if (after !== before) {
      fs.writeFileSync(p, after, "utf8");
      touched++;
      console.log("[rewrite] " + path.relative(ROOT, p));
    }
  }
  console.log("[done] rewritten=" + touched + ", failed=" + failed.length);
  if (failed.length) console.log("[failed-ids] " + failed.join(","));
})();

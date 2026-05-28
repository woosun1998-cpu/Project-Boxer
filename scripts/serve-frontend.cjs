/**
 * frontend 정적 서버 (Range / 206 지원) + /api·/static 백엔드 프록시
 *
 * 사용: node scripts/serve-frontend.cjs
 * 접속: http://localhost:5500/index.html
 * API:  http://localhost:5500/api/... → http://127.0.0.1:8000/api/...
 */
const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "frontend");
const PORT = Number(process.env.PORT) || 5500;
const API_TARGET = (process.env.API_PROXY_TARGET || "http://127.0.0.1:8000").replace(
  /\/$/,
  "",
);

const PROXY_PREFIXES = ["/api", "/static", "/uploads", "/docs", "/redoc", "/openapi.json", "/health"];

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".m4a": "audio/mp4",
  ".webm": "video/webm",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
  ".wasm": "application/wasm",
};

function shouldProxy(urlPath) {
  return PROXY_PREFIXES.some(
    (prefix) => urlPath === prefix || urlPath.startsWith(prefix + "/"),
  );
}

function proxyToApi(req, res) {
  const targetUrl = new URL(req.url, API_TARGET);
  const lib = targetUrl.protocol === "https:" ? https : http;
  const headers = { ...req.headers, host: targetUrl.host };

  const proxyReq = lib.request(
    targetUrl,
    { method: req.method, headers },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );

  proxyReq.on("error", () => {
    res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(`API proxy failed: ${API_TARGET}`);
  });

  req.pipe(proxyReq);
}

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const rel = decoded.replace(/^\/+/, "").replace(/\//g, path.sep);
  const resolved = path.normalize(path.join(ROOT, rel));
  if (!resolved.startsWith(ROOT)) return null;
  return resolved;
}

function sendFile(req, res, filePath) {
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not Found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || "application/octet-stream";
    const range = req.headers.range;

    if (range) {
      const m = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!m) {
        res.writeHead(416);
        res.end();
        return;
      }
      let start = m[1] ? parseInt(m[1], 10) : 0;
      let end = m[2] ? parseInt(m[2], 10) : stat.size - 1;
      if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= stat.size) {
        res.writeHead(416, { "Content-Range": `bytes */${stat.size}` });
        res.end();
        return;
      }
      end = Math.min(end, stat.size - 1);
      const chunk = end - start + 1;
      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${stat.size}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunk,
        "Content-Type": type,
        "Cache-Control": "no-cache",
      });
      fs.createReadStream(filePath, { start, end }).pipe(res);
      return;
    }

    res.writeHead(200, {
      "Content-Length": stat.size,
      "Content-Type": type,
      "Accept-Ranges": "bytes",
      "Cache-Control": ext === ".mp4" ? "no-cache" : "public, max-age=3600",
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const urlPath = (req.url || "/").split("?")[0];

  if (shouldProxy(urlPath)) {
    proxyToApi(req, res);
    return;
  }

  const filePath = safePath(urlPath === "/" ? "/index.html" : urlPath);
  if (!filePath) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  sendFile(req, res, filePath);
});

server.listen(PORT, () => {
  console.log(`[Boxer] frontend → http://localhost:${PORT}/index.html`);
  console.log(`[Boxer] API proxy  → ${API_TARGET} (/api, /static, /docs, /health)`);
  console.log(`[Boxer] Range(206) 지원 — 대용량 mp4 스트리밍 가능`);
});

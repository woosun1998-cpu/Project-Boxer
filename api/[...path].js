/**
 * Vercel Serverless API proxy
 * 무엇: /api/* 요청을 API_URL 백엔드로 전달
 * 왜: 프론트는 항상 상대경로(/api/...)를 사용하도록 통일
 */
module.exports = async function handler(req, res) {
  const base = (process.env.API_URL || "").trim().replace(/\/$/, "");
  if (!base) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ detail: "API_URL is not configured" }));
    return;
  }

  const pathParts = Array.isArray(req.query.path)
    ? req.query.path
    : req.query.path
      ? [req.query.path]
      : [];

  const path = "/api/" + pathParts.map((p) => encodeURIComponent(String(p))).join("/");
  const query = new URLSearchParams(req.query || {});
  query.delete("path");
  const qs = query.toString();
  const target = `${base}${path}${qs ? `?${qs}` : ""}`;

  const headers = { ...req.headers };
  delete headers.host;
  delete headers["content-length"];

  const init = {
    method: req.method,
    headers,
  };

  if (req.method && !["GET", "HEAD"].includes(req.method.toUpperCase())) {
    if (typeof req.body === "string" || Buffer.isBuffer(req.body)) {
      init.body = req.body;
    } else if (req.body != null) {
      init.body = JSON.stringify(req.body);
      if (!init.headers["content-type"]) {
        init.headers["content-type"] = "application/json";
      }
    }
  }

  try {
    const upstream = await fetch(target, init);
    res.statusCode = upstream.status;

    upstream.headers.forEach((value, key) => {
      if (["transfer-encoding", "content-encoding", "connection"].includes(key.toLowerCase())) {
        return;
      }
      res.setHeader(key, value);
    });

    const arrayBuffer = await upstream.arrayBuffer();
    res.end(Buffer.from(arrayBuffer));
  } catch (error) {
    res.statusCode = 502;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(
      JSON.stringify({
        detail: "Upstream API request failed",
        target,
        error: error && error.message ? error.message : String(error),
      }),
    );
  }
};
/**
 * API 베이스 URL (Vercel 빌드 시 scripts/vercel-prepare-static.cjs 가 process.env.API_URL 로 갱신)
 * 로컬: 비우면 api.js 가 http://localhost:8000 사용
 */
(function (g) {
  g.__BOXER_API_URL__ = "";
})(typeof window !== "undefined" ? window : globalThis);

/**
 * mapConfig.js — 카카오 지도 API 키 설정 파일
 *
 * [운영자 안내]
 * 1. 아래 KAKAO_JAVASCRIPT_KEY 값을 실제 카카오 JavaScript 앱 키로 교체하세요.
 * 2. 카카오 개발자 콘솔 → 내 애플리케이션 → 앱 키 → "JavaScript 키"
 *    https://developers.kakao.com/console/app
 * 3. 플랫폼 → Web → 사이트 도메인에 이 앱의 도메인을 등록해야 지도가 표시됩니다.
 *    (로컬 개발 시 http://localhost:포트 등록)
 *
 * [주의]
 * - 이 파일은 Git에 실제 키 값이 포함되지 않도록 .gitignore에 추가하거나
 *   별도 환경 변수 주입 방식으로 교체하세요.
 * - Kakao JavaScript Key는 지도 표시용입니다.
 *   장소 검색은 백엔드 /api/boxing-gyms/nearby 를 통해 처리합니다.
 */
window.IM_BOXER_MAP_CONFIG = {
  KAKAO_JAVASCRIPT_KEY: '8fb02fd09f454c41d6578e641c71e58a',
};

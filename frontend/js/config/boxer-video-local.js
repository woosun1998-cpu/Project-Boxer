/**
 * 훈련·스파링 영상 — 100% 로컬 ./video/ (한글·공백 파일명은 encodeURIComponent)
 * 무엇: 외부 스트림·Drive·폴백 없이 단일 출처 / 왜: 라이브 서버(5500)에서 끊김 없이 재생
 */
(function (global) {
  var DIR = "./video/";

  function fileUrl(fileName) {
    return DIR + encodeURIComponent(fileName);
  }

  global.BOXER_VIDEO = {
    boxingStance: fileUrl("복싱스탠스.mp4"),
    boxingWeaving: fileUrl("복싱 위빙.mp4"),
    boxingCombo: fileUrl("복싱 콤비네이션 강의.mp4"),
    boxingPro: fileUrl("복싱프로.mp4"),
    sparringBeginner: fileUrl("스파링초보.mp4"),
    sparringNormal: fileUrl("스파링보통.mp4"),
    sparringHard: fileUrl("스파링어려움.mp4"),
    dietLight: fileUrl("라이트모드.mp4"),
    dietStandard: fileUrl("스탠다드모드.mp4"),
    dietIntense: fileUrl("인탠스모드.mp4"),
    _dir: DIR,
    _fileUrl: fileUrl,
  };
})(typeof window !== "undefined" ? window : globalThis);

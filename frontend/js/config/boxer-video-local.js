/**
 * 훈련·스파링 영상 — 100% 로컬 ./video/ (한글·공백 파일명은 encodeURIComponent)
 * 무엇: 외부 스트림·Drive·폴백 없이 단일 출처 / 왜: 라이브 서버(5500)에서 끊김 없이 재생
 */
(function (global) {
  var DIR = "./video/";

  function fileUrl(fileName) {
    try {
      if (typeof global.location !== "undefined" && global.location.href) {
        return new URL("video/" + encodeURIComponent(fileName), global.location.href).href;
      }
    } catch (e) {
      /* fallback */
    }
    return DIR + encodeURIComponent(fileName);
  }

  global.BOXER_VIDEO = {
    stretching: fileUrl("스트레칭.mp4"),
    boxingStance: fileUrl("복싱스탠스.mp4"),
    boxingWeaving: fileUrl("복싱 위빙.mp4"),
    boxingCombo: fileUrl("복싱 콤비네이션 강의.mp4"),
    boxingPro: fileUrl("복싱프로.mp4"),
    sparringBeginner: fileUrl("스파링초보.mp4"),
    sparringNormal: fileUrl("스파링보통.mp4"),
    sparringHard: fileUrl("스파링어려움.mp4"),
    /* ASCII 별칭 우선 — Live Server 한글 경로 404 방지 (scripts/link-diet-videos.cjs) */
    dietLight: fileUrl("diet-light.mp4"),
    dietStandard: fileUrl(
      "20분 전신 HIIT 운동 1   고강도 지방 연소 및 탄력 강화 유산소 운동   장비 없음.mp4",
    ),
    dietIntense: fileUrl("30-Minute At-Home Boxing Workout (1).mp4"),
    dietLightKo: fileUrl("다이어트복싱.mp4"),
    _dir: DIR,
    _fileUrl: fileUrl,
  };
})(typeof window !== "undefined" ? window : globalThis);

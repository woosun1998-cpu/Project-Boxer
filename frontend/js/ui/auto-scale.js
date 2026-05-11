document.addEventListener("DOMContentLoaded", () => {
  const stage = document.querySelector(".stage-container");
  if (!stage) return;

  /* 스테이지(.stage-viewport flex 중앙 정렬) 기준으로 축소 시에도 화면 정중앙에 남도록
     비율 변환 기준점을 중앙으로 둠(0 0이면 시각적으로 좌상단에 쏠려 보임). */
  stage.style.transformOrigin = "center center";
  function autoScale() {
    const scaleX = window.innerWidth / 1920;
    const scaleY = window.innerHeight / 1080;
    const scale = Math.min(scaleX, scaleY);
    stage.style.transform = `scale(${scale})`;
  }

  window.addEventListener("resize", autoScale);
  autoScale();
});

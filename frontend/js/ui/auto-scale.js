document.addEventListener("DOMContentLoaded", () => {
  const stage = document.querySelector(".stage-container");
  if (!stage) return;

  /**
   * contain(기본): 전체 UI가 보이게 맞춤 → 화면보다 넓으면 좌우 검은 여백
   * cover: 화면을 꽉 채움 → 넘치는 위·아래는 잘림
   */
  const scaleMode =
    stage.dataset.scaleMode === "cover" ? "cover" : "contain";

  stage.style.transformOrigin = "center center";
  function autoScale() {
    const scaleX = window.innerWidth / 1920;
    const scaleY = window.innerHeight / 1080;
    const scale =
      scaleMode === "cover"
        ? Math.max(scaleX, scaleY)
        : Math.min(scaleX, scaleY);
    stage.style.transform = `scale(${scale})`;
  }

  window.addEventListener("resize", autoScale);
  autoScale();
});

document.addEventListener("DOMContentLoaded", () => {
  const stage = document.querySelector(".stage-container");
  if (!stage) return;

  function autoScale() {
    const scaleX = window.innerWidth / 1920;
    const scaleY = window.innerHeight / 1080;
    const scale = Math.min(scaleX, scaleY);
    stage.style.transform = `scale(${scale})`;
  }

  window.addEventListener("resize", autoScale);
  autoScale();
});

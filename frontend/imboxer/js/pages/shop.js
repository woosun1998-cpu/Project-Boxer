import { hydratePage } from "../core/ui.js";

document.addEventListener("DOMContentLoaded", () => {
  hydratePage({
    overrides: {
      summary: "훈련 상점",
      message: "프리미엄 콘텐츠와 훈련 보강 아이템을 안내하는 상점 화면입니다.",
      tierText: "로그인한 사용자의 등급 정보를 바탕으로 상점 화면이 표시됩니다.",
    },
  }).catch(() => {
    window.location.href = "/index.html";
  });

  const slot = document.querySelector("[data-api-shop-slot]");
  if (slot) {
    slot.dataset.apiState = "placeholder";
  }
});

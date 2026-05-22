(function () {
  let cameraGuardInstalled = false;
  let isInternalSafetyCheck = false;
  let lastSafetyPassed = false;
  let pendingApproval = null;

  function hasValidPass() {
    return lastSafetyPassed;
  }

  function markPassed() {
    lastSafetyPassed = true;
  }

  function clearPassed() {
    lastSafetyPassed = false;
  }

  // 무엇: 기존 시작 버튼 가드와 충돌 방지 -> 왜: 실제 강제는 getUserMedia 전역 가드에서 처리하기 위해
  function ensurePassed() {
    return { ok: true, message: "" };
  }

  function isSafetyCheckPage() {
    const path = String(window.location.pathname || "").toLowerCase();
    return path.endsWith("/safety-check.html") || path.endsWith("safety-check.html");
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.addEventListener("load", () => resolve(), { once: true });
      script.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
      document.head.appendChild(script);
    });
  }

  function ensureModalStyle() {
    if (document.getElementById("boxer-safety-modal-style")) return;
    const style = document.createElement("style");
    style.id = "boxer-safety-modal-style";
    style.textContent = `
      .boxer-safety-modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.68);
        z-index: 99990;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
      }
      .boxer-safety-modal {
        width: min(820px, 96vw);
        background: #111726;
        border: 1px solid rgba(255, 255, 255, 0.16);
        border-radius: 14px;
        padding: 14px;
        color: #fff;
      }
      .boxer-safety-modal h3 {
        margin: 0 0 8px;
      }
      .boxer-safety-modal p {
        margin: 0 0 10px;
        color: rgba(255, 255, 255, 0.86);
      }
      .boxer-safety-modal video {
        width: 100%;
        max-height: 42vh;
        border-radius: 10px;
        background: #06080f;
        border: 1px solid rgba(255, 255, 255, 0.16);
        object-fit: cover;
      }
      .boxer-safety-modal .status {
        margin-top: 8px;
        font-size: 14px;
      }
      .boxer-safety-modal .actions {
        margin-top: 10px;
        display: flex;
        gap: 8px;
        justify-content: flex-end;
      }
      .boxer-safety-modal button {
        border: 0;
        border-radius: 8px;
        padding: 9px 12px;
        font-weight: 700;
        cursor: pointer;
      }
      .boxer-safety-modal .btn-primary {
        background: #2d72ff;
        color: #fff;
      }
      .boxer-safety-modal .btn-ghost {
        background: rgba(255, 255, 255, 0.14);
        color: #fff;
      }
    `;
    document.head.appendChild(style);
  }

  function createSafetyModal() {
    ensureModalStyle();
    const backdrop = document.createElement("div");
    backdrop.className = "boxer-safety-modal-backdrop";
    backdrop.innerHTML = `
      <section class="boxer-safety-modal" role="dialog" aria-modal="true">
        <h3>안전확인</h3>
        <p>카메라 사용 전 위험요소(칼, 가위, 야구방망이)를 확인합니다.</p>
        <video autoplay muted playsinline></video>
        <div class="status">분석 시작 버튼을 눌러 주세요.</div>
        <div class="actions">
          <button type="button" class="btn-ghost" data-role="cancel">취소</button>
          <button type="button" class="btn-primary" data-role="run">안전확인 시작</button>
        </div>
      </section>
    `;
    document.body.appendChild(backdrop);
    return {
      backdrop,
      videoEl: backdrop.querySelector("video"),
      statusEl: backdrop.querySelector(".status"),
      runBtn: backdrop.querySelector('[data-role="run"]'),
      cancelBtn: backdrop.querySelector('[data-role="cancel"]'),
      destroy() {
        backdrop.remove();
      },
    };
  }

  async function openSafetyCheckModal() {
    if (pendingApproval) return pendingApproval;
    pendingApproval = (async () => {
      await loadScript("/js/core/danger-precheck.js");
      const modal = createSafetyModal();
      return new Promise((resolve) => {
        let settled = false;
        function done(ok) {
          if (settled) return;
          settled = true;
          modal.destroy();
          resolve(ok);
        }
        modal.cancelBtn.addEventListener("click", () => done(false));
        modal.runBtn.addEventListener("click", async () => {
          modal.runBtn.disabled = true;
          modal.statusEl.textContent = "안전확인 분석 중입니다...";
          try {
            isInternalSafetyCheck = true;
            const result = await window.runDangerObjectPrecheck({
              videoEl: modal.videoEl,
              keepStream: true,
              videoConstraints: { video: { facingMode: "user" }, audio: false },
              sampleCount: 5,
              sampleIntervalMs: 120,
              requiredHits: 2,
            });
            const labels = Array.isArray(result?.dangerLabels) ? result.dangerLabels : [];
            if (labels.length) {
              modal.runBtn.disabled = false;
              modal.statusEl.textContent = `위험요소 감지: ${labels.join(", ")}. 정리 후 다시 시도해 주세요.`;
              return;
            }
            markPassed();
            done(true);
          } catch (_) {
            modal.runBtn.disabled = false;
            modal.statusEl.textContent = "분석 중 오류가 발생했습니다. 다시 시도해 주세요.";
          } finally {
            isInternalSafetyCheck = false;
          }
        });
      });
    })();
    try {
      return await pendingApproval;
    } finally {
      pendingApproval = null;
    }
  }

  function installCameraGuard() {
    if (cameraGuardInstalled) return;
    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices || typeof mediaDevices.getUserMedia !== "function") return;
    if (isSafetyCheckPage()) return;

    const originalGetUserMedia = mediaDevices.getUserMedia.bind(mediaDevices);
    mediaDevices.getUserMedia = async function guardedGetUserMedia(constraints) {
      if (isInternalSafetyCheck) {
        return originalGetUserMedia(constraints);
      }
      clearPassed();
      const approved = await openSafetyCheckModal();
      if (!approved) {
        throw new Error("SAFETY_CHECK_REQUIRED");
      }
      const stream = await originalGetUserMedia(constraints);
      clearPassed();
      return stream;
    };
    cameraGuardInstalled = true;
  }

  window.BoxerSafetyGate = {
    hasValidPass,
    markPassed,
    clearPassed,
    ensurePassed,
    installCameraGuard,
  };

  installCameraGuard();
})();

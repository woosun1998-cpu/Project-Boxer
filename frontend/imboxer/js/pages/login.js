import { getLoginRedirectPath, loginAndStore } from "../core/auth.js";

function getForm() {
  return (
    document.querySelector("[data-login-form]") ||
    document.querySelector("#loginForm") ||
    document.querySelector("form")
  );
}

function getValue(form, selectors) {
  for (const sel of selectors) {
    const el = form.querySelector(sel);
    if (el && el.value) return el.value.trim();
  }
  return "";
}

function getMessageEl(form) {
  return (
    form.querySelector("[data-form-message]") ||
    form.querySelector(".form-message") ||
    document.querySelector("[data-form-message]")
  );
}

function setMessage(form, text, isError = false) {
  const el = getMessageEl(form);
  if (!el) return;
  el.textContent = text;
  el.dataset.state = isError ? "error" : "success";
}

function clearMessage(form) {
  const el = getMessageEl(form);
  if (!el) return;
  el.textContent = "";
  delete el.dataset.state;
}

document.addEventListener("DOMContentLoaded", () => {
  const form = getForm();
  if (!form) return;

  // 입력을 수정하면 이전 오류 메시지를 지운다.
  form.querySelectorAll("input").forEach((input) => {
    input.addEventListener("input", () => {
      const el = getMessageEl(form);
      if (el && el.dataset.state === "error") clearMessage(form);
    });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = getValue(form, ["input[name='email']", "#loginEmail", "[data-email]"]);
    const password = getValue(form, ["input[name='password']", "#loginPassword", "[data-password]"]);

    if (!email || !password) {
      setMessage(form, "이메일과 비밀번호를 입력해 주세요.", true);
      return;
    }

    const btn = form.querySelector("[type='submit']");
    const originalText = btn ? btn.textContent : "";

    function setLoading(loading) {
      if (!btn) return;
      btn.disabled = loading;
      btn.textContent = loading ? "처리 중..." : originalText;
    }

    setLoading(true);
    clearMessage(form);

    try {
      const data = await loginAndStore({ email, password });
      if (btn) btn.textContent = "로그인 완료";
      setMessage(form, "로그인 성공. 이동 중입니다...", false);
      window.location.href = getLoginRedirectPath(data.user);
    } catch (error) {
      setLoading(false);
      setMessage(
        form,
        error.message || "로그인에 실패했습니다. 이메일과 비밀번호를 다시 확인해 주세요.",
        true
      );
    }
  });
});

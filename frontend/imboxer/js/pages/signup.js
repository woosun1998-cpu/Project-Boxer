import { getLoginRedirectPath, signupAndStore } from "../core/auth.js";

function getForm() {
  return (
    document.querySelector("[data-signup-form]") ||
    document.querySelector("#signupForm") ||
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

    const username = getValue(form, ["input[name='username']", "#signupUsername", "[data-username]"]);
    const email = getValue(form, ["input[name='email']", "#signupEmail", "[data-email]"]);
    const password = getValue(form, ["input[name='password']", "#signupPassword", "[data-password]"]);

    if (!username || !email || !password) {
      setMessage(form, "이름, 이메일, 비밀번호를 모두 입력해 주세요.", true);
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
      const data = await signupAndStore({ username, email, password });
      if (btn) btn.textContent = "가입 완료";
      setMessage(form, "회원가입이 완료되었습니다. 이동 중입니다...", false);
      window.location.href = getLoginRedirectPath(data.user);
    } catch (error) {
      setLoading(false);
      setMessage(
        form,
        error.message || "회원가입에 실패했습니다. 잠시 후 다시 시도해 주세요.",
        true
      );
    }
  });
});

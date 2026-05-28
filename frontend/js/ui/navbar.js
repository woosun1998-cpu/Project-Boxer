(function () {
  // 무엇: 포트 강제 리다이렉트 제거 / 왜: 다른 포트 서버 미기동 시 ERR_EMPTY_RESPONSE 및 혼선 방지

  if (document.getElementById("bxn-nav")) return;

  const css = `
    #bxn-nav{position:fixed;top:20px;right:20px;height:70px;border-radius:100px;background:#fff;box-shadow:0 4px 4px rgba(0,0,0,.25);display:flex;align-items:center;gap:40px;padding:0 22px;z-index:1000;font-size:20px}
    #bxn-nav a{color:#1c1c1c;text-decoration:none;font-weight:600;transition:color .2s ease}
    #bxn-nav a:hover,#bxn-nav a.active{color:#b42318}
    #bxn-nav .bxn-login{border:0;background:transparent;padding:0;font:inherit;font-weight:600;cursor:pointer;color:#1c1c1c}
    #bxn-nav .bxn-menu{width:26px;height:20px;border:0;background:transparent;padding:0;display:inline-flex;flex-direction:column;justify-content:space-between;cursor:pointer}
    #bxn-nav .bxn-menu i{height:3px;border-radius:999px;background:#1c1c1c;transition:background .2s ease}
    #bxn-nav .bxn-menu:hover i{background:#b42318}
    .bxn-auth-ov{position:fixed;inset:0;background:rgba(0,0,0,.55);display:none;align-items:center;justify-content:center;z-index:2100;padding:20px;box-sizing:border-box}
    .bxn-auth-ov.open{display:flex}
    .bxn-auth{width:100%;max-width:420px;background:#fff;border:1px solid #e5e5e5;border-radius:20px;padding:14px 12px 18px;box-shadow:0 8px 40px rgba(0,0,0,.12)}
    .bxn-brand{margin:8px 0 12px;text-align:center;line-height:0}
    .bxn-brand img{display:block;width:100%;max-height:140px;object-fit:contain;margin:0 auto}
    .bxn-tabs{display:flex;border-bottom:1px solid #e8e8e8;margin:0 0 12px}
    .bxn-tab{flex:1;height:46px;border:0;background:none;font-size:15px;font-weight:700;color:#8a8a8a;cursor:pointer;position:relative}
    .bxn-tab[aria-selected="true"]{color:#ed1c33}
    .bxn-tab[aria-selected="true"]::after{content:"";position:absolute;left:8px;right:8px;bottom:0;height:3px;background:#ed1c33}
    .bxn-pane{display:none}
    .bxn-pane.active{display:flex;flex-direction:column;gap:12px}
    .bxn-pane form{display:flex;flex-direction:column;gap:12px}
    .bxn-caption{margin:0 0 12px;padding-left:16px;color:#ed1c33;font-size:13px;font-weight:700}
    .bxn-inset{border:1px solid #d4d4d4;border-radius:10px;overflow:hidden;background:#fff}
    .bxn-row{position:relative;border-top:1px solid #ebebeb}
    .bxn-row:first-child{border-top:0}
    .bxn-input{width:100%;height:56px;border:0;padding:18px 16px 0;font-size:16px;font-weight:700;background:#fff}
    .bxn-input::placeholder{color:transparent}
    .bxn-input:focus{outline:none;box-shadow:inset 0 0 0 2px #ed1c33}
    .bxn-float{position:absolute;left:16px;top:50%;transform:translateY(-50%);font-size:16px;font-weight:700;color:#b0b0b0;pointer-events:none;z-index:2;transition:all .16s ease;background:#fff;padding:0 4px}
    .bxn-input:focus + .bxn-float,.bxn-input:not(:placeholder-shown) + .bxn-float{top:10px;transform:none;font-size:11px;color:#8c8c8c}
    .bxn-extra{display:flex;align-items:center;margin:12px 0;font-size:12px;color:#555}
    .bxn-submit{width:100%;height:50px;border:0;border-radius:10px;background:#8b8b8b;color:#fff;font-size:17px;font-weight:700;cursor:pointer}
    .bxn-foot{margin-top:12px;text-align:center;font-size:12px;color:#888}
    .bxn-foot button,.bxn-foot a{border:0;background:none;padding:0;color:#888;cursor:pointer;text-decoration:none}
  `;
  const style = document.createElement("style");
  style.id = "bxn-style";
  style.textContent = css;
  document.head.appendChild(style);

  const path = (location.pathname || "").toLowerCase();
  const inFrontend = path.startsWith("/frontend/");
  const pageBase = inFrontend ? "/frontend" : "";
  // 무엇: 로컬 전용 플레이스홀더 / 왜: 외부 공유 URL·혼합 콘텐츠(CORS) 회피
  const myboxShareImageUrl = `${pageBase || "."}/image/cache/1E58-Ar9HJovqNrhjRTCRZ5bArTU8Q1Hg.png`;
  const isActive = (href) => path.endsWith(href.toLowerCase());

  const nav = document.createElement("nav");
  nav.id = "bxn-nav";
  nav.innerHTML = `
    <a href="${pageBase}/index.html" class="${isActive("/index.html") ? "active" : ""}">홈</a>
    <a href="${pageBase}/tutorial-new.html" class="${isActive("/tutorial-new.html") || isActive("/tutorial2.html") ? "active" : ""}">트레이닝</a>
    <a href="${pageBase}/diet-boxing.html" class="${isActive("/diet-boxing.html") ? "active" : ""}">다이어트 복싱</a>
    <a href="${pageBase}/sparring.html" class="${isActive("/sparring.html") ? "active" : ""}">스파링</a>
    <button id="bxnLoginBtn" type="button" class="bxn-login">로그인</button>
    <button id="bxnMenuBtn" type="button" class="bxn-menu" aria-label="메뉴 열기"><i></i><i></i><i></i></button>
  `;
  const headerMount = document.getElementById("header-container");
  (headerMount || document.body).appendChild(nav);

  const authOv = document.createElement("div");
  authOv.className = "bxn-auth-ov";
  authOv.id = "bxnAuthOv";
  authOv.innerHTML = `
    <div class="bxn-auth" role="dialog" aria-modal="true" aria-label="로그인 및 회원가입">
      <div class="bxn-brand"><img src="${myboxShareImageUrl}" alt="BOXER"></div>
      <div class="bxn-tabs"><button class="bxn-tab" id="bxnTabLogin" aria-selected="true">로그인</button><button class="bxn-tab" id="bxnTabSignup" aria-selected="false">회원가입</button></div>
      <div id="bxnPaneLogin" class="bxn-pane active">
        <p class="bxn-caption">아이디(이메일) 로그인</p>
        <form id="bxnLoginForm">
          <div class="bxn-inset">
            <div class="bxn-row"><input id="bxnLoginEmail" class="bxn-input" type="email" placeholder=" " required><label class="bxn-float" for="bxnLoginEmail">아이디(이메일)</label></div>
            <div class="bxn-row"><input id="bxnLoginPassword" class="bxn-input" type="password" placeholder=" " required><label class="bxn-float" for="bxnLoginPassword">비밀번호</label></div>
          </div>
          <div class="bxn-extra"><label><input type="checkbox"> 로그인 상태 유지</label></div>
          <p id="bxnLoginError" style="min-height:20px;color:#d61f35;margin:0;display:none"></p>
          <button class="bxn-submit" type="submit">로그인</button>
        </form>
      </div>
      <div id="bxnPaneSignup" class="bxn-pane">
        <p class="bxn-caption">새 계정으로 회원가입</p>
        <form id="bxnSignupForm">
          <div class="bxn-inset">
            <div class="bxn-row"><input id="bxnSignupName" class="bxn-input" type="text" minlength="3" maxlength="20" placeholder=" " required><label class="bxn-float" for="bxnSignupName">닉네임 (3~20자)</label></div>
            <div class="bxn-row"><input id="bxnSignupEmail" class="bxn-input" type="email" placeholder=" " required><label class="bxn-float" for="bxnSignupEmail">아이디(이메일)</label></div>
            <div class="bxn-row"><input id="bxnSignupPassword" class="bxn-input" type="password" minlength="8" placeholder=" " required><label class="bxn-float" for="bxnSignupPassword">비밀번호 (8자 이상)</label></div>
          </div>
          <p id="bxnSignupError" style="min-height:20px;color:#d61f35;margin:0;display:none"></p>
          <button class="bxn-submit" type="submit">회원가입</button>
        </form>
      </div>
      <div class="bxn-foot"><a href="#" id="bxnFindPw">비밀번호 찾기</a> | <a href="#" id="bxnFindId">아이디 찾기</a> | <button id="bxnSwitch">회원가입</button></div>
    </div>
  `;
  document.body.appendChild(authOv);

  const state = { loggedIn: !!window.auth?.isLoggedIn?.() };
  const loginBtn = document.getElementById("bxnLoginBtn");
  let lastKnownUsername = "";

  if (window.auth?.handlePageLoadSessionCheck && !window.auth.handlePageLoadSessionCheck()) {
    state.loggedIn = false;
  }

  function getDisplayUsername(user = {}) {
    const rawUsername = typeof user.username === "string" ? user.username.trim() : "";
    if (rawUsername) lastKnownUsername = rawUsername;
    return rawUsername || lastKnownUsername || "User";
  }

  function render() {
    state.loggedIn = !!window.auth?.isLoggedIn?.();
    const user = window.auth?.getCachedUser?.() || {};
    const displayUsername = getDisplayUsername(user);
    if (state.loggedIn) {
      loginBtn.textContent = `${displayUsername}님`;
      loginBtn.style.color = "#ED1D32";
    } else {
      loginBtn.textContent = "로그인";
      loginBtn.style.color = "";
      lastKnownUsername = "";
    }
  }

  function setTab(tab) {
    const isLogin = tab === "login";
    document.getElementById("bxnTabLogin").setAttribute("aria-selected", isLogin ? "true" : "false");
    document.getElementById("bxnTabSignup").setAttribute("aria-selected", isLogin ? "false" : "true");
    document.getElementById("bxnPaneLogin").classList.toggle("active", isLogin);
    document.getElementById("bxnPaneSignup").classList.toggle("active", !isLogin);
    document.getElementById("bxnSwitch").textContent = isLogin ? "회원가입" : "로그인";
  }
  function openAuth(tab) { authOv.classList.add("open"); setTab(tab); }
  function closeAuth() { authOv.classList.remove("open"); }

  window.openAuthModal = function (tab) {
    openAuth(tab === "signup" ? "signup" : "login");
  };

  function handleMenuOrLoginClick() {
    if (state.loggedIn) {
      window.location.href = `${pageBase}/mypage.html`;
      return;
    }
    openAuth("login");
  }

  document.getElementById("bxnMenuBtn").addEventListener("click", handleMenuOrLoginClick);
  loginBtn.addEventListener("click", handleMenuOrLoginClick);
  authOv.addEventListener("click", (e) => { if (e.target === authOv) closeAuth(); });
  document.getElementById("bxnTabLogin").addEventListener("click", () => setTab("login"));
  document.getElementById("bxnTabSignup").addEventListener("click", () => setTab("signup"));
  document.getElementById("bxnSwitch").addEventListener("click", () => {
    const loginSelected = document.getElementById("bxnTabLogin").getAttribute("aria-selected") === "true";
    setTab(loginSelected ? "signup" : "login");
  });
  document.getElementById("bxnFindPw").addEventListener("click", (e) => { e.preventDefault(); alert("준비 중입니다."); });
  document.getElementById("bxnFindId").addEventListener("click", (e) => { e.preventDefault(); alert("준비 중입니다."); });

  document.getElementById("bxnLoginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = document.getElementById("bxnLoginError");
    err.style.display = "none";
    try {
      await window.auth.login(
        document.getElementById("bxnLoginEmail").value.trim(),
        document.getElementById("bxnLoginPassword").value
      );
      closeAuth();
      render();
    } catch (error) {
      err.textContent = error.message || "로그인에 실패했습니다.";
      err.style.display = "block";
    }
  });

  document.getElementById("bxnSignupForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = document.getElementById("bxnSignupError");
    err.style.display = "none";
    try {
      await window.auth.signup(
        document.getElementById("bxnSignupName").value.trim(),
        document.getElementById("bxnSignupEmail").value.trim(),
        document.getElementById("bxnSignupPassword").value
      );
      alert("회원가입이 완료되었습니다. 로그인해 주세요.");
      setTab("login");
    } catch (error) {
      err.textContent = error.message || "회원가입에 실패했습니다.";
      err.style.display = "block";
    }
  });

  window.addEventListener("storage", (event) => {
    if (
      event.key === "boxer_logged_in" ||
      event.key === "boxer_user" ||
      event.key === "boxer_auth_event"
    ) {
      closeAuth();
      render();
    }
  });

  render();
})();

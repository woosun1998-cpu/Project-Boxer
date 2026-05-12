import { clearAuthState, getUserProfile, setUserProfile } from "./storage.js";


const SESSION_EXPIRED_EVENT = "im-boxer:session-expired";


export function logout() {
  clearAuthState();
}


export function getSessionProfile() {
  return getUserProfile();
}


export function saveSessionProfile(profile) {
  setUserProfile(profile);
}


export function handleSessionExpired(redirectTo = "login.html") {
  clearAuthState();
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
  window.location.href = redirectTo;
}


export function onSessionExpired(handler) {
  window.addEventListener(SESSION_EXPIRED_EVENT, handler);
}

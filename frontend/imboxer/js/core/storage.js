import { ACCESS_TOKEN_KEY, USER_PROFILE_KEY } from "./config.js";


export function setAccessToken(token) {
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
}


export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}


export function clearAccessToken() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
}


export function setUserProfile(profile) {
  localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
}


export function getUserProfile() {
  const raw = localStorage.getItem(USER_PROFILE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}


export function clearUserProfile() {
  localStorage.removeItem(USER_PROFILE_KEY);
}


export function clearAuthState() {
  clearAccessToken();
  clearUserProfile();
}

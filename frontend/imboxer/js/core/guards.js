import { getStoredProfile, hasAccessToken, refreshProfile, expireSession } from "./auth.js";


export async function requireAuth(redirectTo = "login.html") {
  if (!hasAccessToken()) {
    window.location.href = redirectTo;
    return null;
  }

  try {
    return await refreshProfile();
  } catch {
    expireSession();
    window.location.href = redirectTo;
    return null;
  }
}


export async function requireRole(allowedRoles, redirectTo = "login.html", deniedRedirect = "index.html") {
  const profile = await requireAuth(redirectTo);
  if (!profile) {
    return null;
  }

  if (!allowedRoles.includes(profile.tier)) {
    window.location.href = deniedRedirect;
    return null;
  }

  return profile;
}


export function getRoleFromStorage() {
  return getStoredProfile()?.tier || null;
}


export function requireAnyLoggedIn(redirectTo = "login.html") {
  return requireAuth(redirectTo);
}

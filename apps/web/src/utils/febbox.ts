/** Session key for where to send the user after Febbox Google login. */
export const FEBBOX_OAUTH_RETURN_KEY = "febbox_oauth_return";

/** postMessage type used when OAuth returns on a different origin (e.g. local → prod). */
export const FEBBOX_OAUTH_MESSAGE = "topwaatch:febbox-auth";

/**
 * Febbox web-authorize login URL.
 * Docs: https://www.febbox.com/open/client
 * After Google login, Febbox redirects to `jump` with `auth_token` (docs also show `auto_token`).
 *
 * Note: Febbox rejects non-HTTPS redirect URIs (including http://localhost).
 * Use an https:// redirect (e.g. https://topwaatch.mov/febbox).
 */
export function getFebboxLoginUrl(clientId: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    jump: redirectUri,
  });
  return `https://www.febbox.com/login/google?${params.toString()}`;
}

/** Read token from Febbox callback query (docs use both names). */
export function getFebboxTokenFromParams(
  params: URLSearchParams,
): string | null {
  return params.get("auth_token") || params.get("auto_token") || null;
}

/** True when the app origin matches the registered Febbox redirect origin. */
export function isFebboxRedirectSameOrigin(redirectUri: string): boolean {
  try {
    return window.location.origin === new URL(redirectUri).origin;
  } catch {
    return false;
  }
}

/**
 * Start Febbox Google login.
 * Same-origin: full-page redirect.
 * Cross-origin (local → https callback): popup + postMessage back.
 */
export function startFebboxOAuth(clientId: string, redirectUri: string): void {
  sessionStorage.setItem(
    FEBBOX_OAUTH_RETURN_KEY,
    `${window.location.pathname}${window.location.search}`,
  );

  const loginUrl = getFebboxLoginUrl(clientId, redirectUri);

  if (isFebboxRedirectSameOrigin(redirectUri)) {
    window.location.href = loginUrl;
    return;
  }

  const popup = window.open(
    loginUrl,
    "topwaatch-febbox-oauth",
    "width=520,height=720,menubar=no,toolbar=no,status=no",
  );

  if (!popup) {
    // Popup blocked  fall back to full navigation (user lands on HTTPS site).
    window.location.href = loginUrl;
  }
}

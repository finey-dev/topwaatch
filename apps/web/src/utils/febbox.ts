/** Session key for where to send the user after Febbox Google login. */
export const FEBBOX_OAUTH_RETURN_KEY = "febbox_oauth_return";

/** postMessage type used when OAuth returns on a different origin (e.g. local → prod). */
export const FEBBOX_OAUTH_MESSAGE = "topwaatch:febbox-auth";

/**
 * Use the configured Febbox redirect URI exactly as registered at
 * https://www.febbox.com/open/client — do not derive it from window.location,
 * or preview/staging origins will fail Febbox validation.
 */
export function resolveFebboxRedirectUri(
  configured: string | null,
): string | null {
  return configured;
}

/**
 * Febbox web-authorize entry URL.
 * Docs: https://www.febbox.com/open/client
 *
 * Start at /open/client_auth and let Febbox build the Google login link.
 * Constructing /login/google ourselves is fragile: putting client_id on that
 * URL lands on client_auth with "Client ID not found", and nesting client_auth
 * inside jump with an encoded redirect_uri triggers "redirect URI is not allowed"
 * on the Google callback. Febbox's own login page uses the correct shape.
 */
export function getFebboxLoginUrl(clientId: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
  });
  return `https://www.febbox.com/open/client_auth?${params.toString()}`;
}

/** Read token from Febbox callback query (docs use both names). */
export function getFebboxTokenFromParams(
  params: URLSearchParams,
): string | null {
  return params.get("auth_token") || params.get("auto_token") || null;
}

/**
 * Start Febbox Google login (full-page redirect).
 * Local dev uses the configured HTTPS callback; production uses the current origin.
 */
export function startFebboxOAuth(clientId: string, redirectUri: string): void {
  sessionStorage.setItem(
    FEBBOX_OAUTH_RETURN_KEY,
    `${window.location.pathname}${window.location.search}`,
  );
  window.location.href = getFebboxLoginUrl(clientId, redirectUri);
}

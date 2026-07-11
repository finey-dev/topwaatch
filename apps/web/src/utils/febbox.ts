/** Session key for where to send the user after Febbox Google login. */
export const FEBBOX_OAUTH_RETURN_KEY = "febbox_oauth_return";

/** postMessage type used when OAuth returns on a different origin (e.g. local → prod). */
export const FEBBOX_OAUTH_MESSAGE = "topwaatch:febbox-auth";

/**
 * Returns the configured Febbox redirect URI unchanged.
 * Must exactly match the redirect URI registered at https://www.febbox.com/open/client.
 */
export function resolveFebboxRedirectUri(
  configured: string | null,
): string | null {
  return configured;
}

/**
 * Febbox web-authorize login URL.
 * Docs: https://www.febbox.com/open/client
 *
 * The documented flow for web-authorize clients (/open/client) is:
 *   https://www.febbox.com/login/google?client_id=X&jump=REDIRECT_URI
 * After the user signs in with Google, Febbox redirects to:
 *   REDIRECT_URI?auth_token=TOKEN
 *
 * Do NOT use /open/client_auth as the entry point — that endpoint is for
 * API OAuth clients created at /open/clients (plural) and will return
 * "client not found" for web-authorize clients.
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

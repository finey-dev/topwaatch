/** Session key for where to send the user after Febbox Google login. */
export const FEBBOX_OAUTH_RETURN_KEY = "febbox_oauth_return";

/** postMessage type used when OAuth returns on a different origin (e.g. local → prod). */
export const FEBBOX_OAUTH_MESSAGE = "topwaatch:febbox-auth";

/**
 * Resolve the Febbox OAuth callback URL.
 * Febbox only accepts HTTPS redirect URIs (not http://localhost).
 * When the app runs on a production HTTPS origin, use that origin so the
 * callback matches where the user actually started (e.g. topwaatch.mov vs vercel.app).
 */
export function resolveFebboxRedirectUri(
  configured: string | null,
): string | null {
  if (!configured) return null;

  const origin = window.location.origin;
  const isLocal =
    origin.startsWith("http://localhost") ||
    origin.startsWith("http://127.0.0.1");

  if (isLocal) return configured;
  if (origin.startsWith("https://")) return `${origin}/febbox`;
  return configured;
}

/**
 * Febbox web-authorize login URL.
 * Docs: https://www.febbox.com/open/client
 *
 * Febbox's own /open/client_auth page starts Google login with `jump` pointing
 * at /open/client_auth?client_id=…&redirect_uri=… (client_id is NOT a separate
 * login/google param). Passing client_id directly on login/google causes Febbox
 * to route through client_auth after Google sign-in with a broken session and
 * show "Client ID not found!" in a loop.
 *
 * After Google login, Febbox hits client_auth while authenticated, then redirects
 * to redirect_uri with `auth_token` (docs also show `auto_token`).
 */
export function getFebboxLoginUrl(clientId: string, redirectUri: string): string {
  const clientAuthJump = `/open/client_auth?${new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
  }).toString()}`;

  const params = new URLSearchParams({
    jump: clientAuthJump,
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

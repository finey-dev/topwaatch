import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { conf } from "@/setup/config";
import {
  FEBBOX_OAUTH_MESSAGE,
  getFebboxTokenFromParams,
  resolveFebboxRedirectUri,
} from "@/utils/febbox";

/**
 * HTTPS callback page registered with Febbox.
 * When opened as a popup from localhost, posts the token back and closes.
 * FebboxAuthHandler also consumes the token on this same page for same-origin flows.
 */
export function FebboxCallbackPage() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"connecting" | "sent" | "missing">(
    "connecting",
  );

  useEffect(() => {
    // BrowserRouter exposes the token through useSearchParams; with HashRouter
    // the redirect lands outside the hash so fall back to the raw search string.
    const token =
      getFebboxTokenFromParams(searchParams) ||
      getFebboxTokenFromParams(new URLSearchParams(window.location.search));
    if (!token) {
      setStatus("missing");
      return;
    }

    // Hand token back to the localhost opener (popup flow).
    if (window.opener && !window.opener.closed) {
      const targets = new Set<string>([
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
      ]);
      const redirectUri = resolveFebboxRedirectUri(conf().FEBBOX_REDIRECT_URI);
      if (redirectUri) {
        try {
          targets.add(new URL(redirectUri).origin);
        } catch {
          /* ignore */
        }
      }

      for (const origin of targets) {
        try {
          window.opener.postMessage(
            { type: FEBBOX_OAUTH_MESSAGE, token },
            origin,
          );
        } catch {
          /* ignore cross-origin failures */
        }
      }

      setStatus("sent");
      window.setTimeout(() => {
        try {
          window.close();
        } catch {
          /* ignore */
        }
      }, 400);
      return;
    }

    setStatus("connecting");
  }, [searchParams]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 text-type-secondary">
      {status === "missing" ? (
        <>
          <p className="font-medium text-white">No Febbox token received</p>
          <p className="text-sm">You can close this window and try again.</p>
        </>
      ) : status === "sent" ? (
        <>
          <p className="font-medium text-white">Connected</p>
          <p className="text-sm">
            You can close this window and return to TopWaatch.
          </p>
        </>
      ) : (
        <>
          <p className="font-medium text-white">Connecting Febbox…</p>
          <p className="text-sm">You&apos;ll be redirected in a moment.</p>
        </>
      )}
    </div>
  );
}

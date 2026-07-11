import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { updateSettings } from "@/backend/accounts/settings";
import { conf } from "@/setup/config";
import { useAuthStore } from "@/stores/auth";
import { usePreferencesStore } from "@/stores/preferences";
import {
  FEBBOX_OAUTH_MESSAGE,
  FEBBOX_OAUTH_RETURN_KEY,
  getFebboxTokenFromParams,
} from "@/utils/febbox";

/**
 * Handles Febbox web-authorize:
 * - query token on this origin (production redirect)
 * - postMessage token from HTTPS popup callback while developing on localhost
 */
export function FebboxAuthHandler() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const setFebboxKey = usePreferencesStore((s) => s.setFebboxKey);
  const account = useAuthStore((s) => s.account);
  const backendUrl = useAuthStore((s) => s.backendUrl);
  const processedRef = useRef(false);

  const finish = (token: string) => {
    if (processedRef.current) return;
    processedRef.current = true;

    setFebboxKey(token);

    if (account && backendUrl) {
      updateSettings(backendUrl, account, { febboxKey: token }).catch((err) => {
        console.error("Failed to sync Febbox token to account", err);
      });
    }

    const returnTo =
      sessionStorage.getItem(FEBBOX_OAUTH_RETURN_KEY) || "/settings";
    sessionStorage.removeItem(FEBBOX_OAUTH_RETURN_KEY);
    navigate(returnTo, { replace: true });
  };

  useEffect(() => {
    // Popup callback on the HTTPS redirect host: don't navigate this window;
    // FebboxCallbackPage posts the token to the opener instead.
    if (window.opener && !window.opener.closed) return;

    const token = getFebboxTokenFromParams(searchParams);
    if (!token) return;
    finish(token);
     
  }, [searchParams]);

  useEffect(() => {
    const redirectUri = conf().FEBBOX_REDIRECT_URI;
    if (!redirectUri) return;

    let redirectOrigin: string;
    try {
      redirectOrigin = new URL(redirectUri).origin;
    } catch {
      return;
    }

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== redirectOrigin) return;
      if (event.data?.type !== FEBBOX_OAUTH_MESSAGE) return;
      const token = event.data?.token;
      if (typeof token !== "string" || !token) return;
      finish(token);
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
     
  }, [account, backendUrl]);

  return null;
}

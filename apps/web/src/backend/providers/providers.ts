import {
  makeProviders,
  makeStandardFetcher,
  setFebboxScrapeContext,
  targets,
} from "@topwaatch/providers";

import {
  makeLoadBalancedSimpleProxyFetcher,
  setupM3U8Proxy,
} from "@/backend/providers/fetchers";
import { conf } from "@/setup/config";

// Initialize M3U8 proxy on module load (playback still uses Worker M3U8 routes)
setupM3U8Proxy();

/** Mirror conf().BACKEND_URL for browser-side Nova/Orbit scrapers (manual source pick). */
function syncFebboxBrowserContext() {
  const backendUrl = conf().BACKEND_URL;
  if (backendUrl) {
    const normalized = backendUrl.replace(/\/$/, "");
    setFebboxScrapeContext({ backendUrl: normalized });
    if (typeof window !== "undefined") {
      (window as { __TW_BACKEND_URL__?: string }).__TW_BACKEND_URL__ = normalized;
    }
  }
}

// Eager init so manual source pick (useSourceScraping) has backend URL before getProviders().
syncFebboxBrowserContext();

/**
 * Providers used for metadata listing in settings UI.
 * Manual source selection (useSourceScraping) also runs scrapers through this path.
 */
export function getProviders() {
  setupM3U8Proxy();
  syncFebboxBrowserContext();
  return makeProviders({
    fetcher: makeStandardFetcher(fetch),
    proxiedFetcher: makeLoadBalancedSimpleProxyFetcher(),
    target: targets.BROWSER,
  });
}

export function getAllProviders() {
  return makeProviders({
    fetcher: makeStandardFetcher(fetch),
    proxiedFetcher: makeLoadBalancedSimpleProxyFetcher(),
    target: targets.ANY,
    consistentIpForRequests: true,
  });
}

import {
  makeProviders,
  makeStandardFetcher,
  targets,
} from "@topwaatch/providers";

import {
  makeLoadBalancedSimpleProxyFetcher,
  setupM3U8Proxy,
} from "@/backend/providers/fetchers";

// Initialize M3U8 proxy on module load (playback still uses Worker M3U8 routes)
setupM3U8Proxy();

/**
 * Providers used for metadata listing in settings UI.
 * Actual scraping runs server-side via /scrape/run.
 */
export function getProviders() {
  setupM3U8Proxy();
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

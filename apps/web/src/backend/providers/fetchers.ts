import {
  Fetcher,
  makeSimpleProxyFetcher,
  setM3U8ProxyUrl,
} from "@topwaatch/providers";

import { getApiToken, setApiToken } from "@/backend/helpers/providerApi";
import { getM3U8ProxyUrls, getProxyUrls } from "@/utils/proxyUrls";

function makeLoadbalancedList(getter: () => string[]) {
  let listIndex = -1;
  return () => {
    const fetchers = getter();
    if (listIndex === -1 || listIndex >= fetchers.length) {
      listIndex = Math.floor(Math.random() * fetchers.length);
    }
    const proxyUrl = fetchers[listIndex];
    listIndex = (listIndex + 1) % fetchers.length;
    return proxyUrl;
  };
}

export const getLoadbalancedProxyUrl = makeLoadbalancedList(getProxyUrls);

function getEnabledM3U8ProxyUrls() {
  const allM3U8ProxyUrls = getM3U8ProxyUrls();
  const enabledProxies = localStorage.getItem("m3u8-proxy-enabled");

  if (!enabledProxies) {
    return allM3U8ProxyUrls;
  }

  try {
    const enabled = JSON.parse(enabledProxies);
    return allM3U8ProxyUrls.filter(
      (_url, index) => enabled[index.toString()] !== false,
    );
  } catch {
    return allM3U8ProxyUrls;
  }
}

export const getLoadbalancedM3U8ProxyUrl = makeLoadbalancedList(
  getEnabledM3U8ProxyUrls,
);

async function fetchButWithApiTokens(
  input: RequestInfo | URL,
  init?: RequestInit | undefined,
): Promise<Response> {
  const apiToken = await getApiToken();
  const headers = new Headers(init?.headers);
  if (apiToken) headers.set("X-Token", apiToken);
  const response = await fetch(
    input,
    init
      ? {
          ...init,
          headers,
        }
      : undefined,
  );
  const newApiToken = response.headers.get("X-Token");
  if (newApiToken) setApiToken(newApiToken);
  return response;
}

export function setupM3U8Proxy() {
  const proxyUrl = getLoadbalancedM3U8ProxyUrl();
  if (proxyUrl) {
    setM3U8ProxyUrl(proxyUrl);
  }
}

export function makeLoadBalancedSimpleProxyFetcher() {
  const fetcher: Fetcher = async (a, b) => {
    const currentFetcher = makeSimpleProxyFetcher(
      getLoadbalancedProxyUrl(),
      fetchButWithApiTokens,
    );
    return currentFetcher(a, b);
  };
  return fetcher;
}

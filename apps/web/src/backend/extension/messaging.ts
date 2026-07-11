/**
 * Extension support has been removed. Scraping runs server-side via /scrape/run
 * and outbound fetches go through the Cloudflare Worker proxy.
 * These stubs keep legacy UI checks from crashing.
 */

export const RULE_IDS = {
  PREPARE_STREAM: 1,
  SET_DOMAINS_HLS: 2,
  SET_DOMAINS_HLS_AUDIO: 3,
  MAKE_REQUEST: 4,
};

export type ExtensionHelloResponse = {
  success: boolean;
  version: string;
  allowed: boolean;
  hasPermission: boolean;
};

export type ExtensionMakeRequestResponse<T = unknown> = {
  success: boolean;
  error?: string;
  response?: {
    statusCode: number;
    headers: Record<string, string>;
    finalUrl: string;
    body: T;
  };
};

export function isExtensionActiveCached(): boolean {
  return false;
}

export async function isExtensionActive(): Promise<boolean> {
  return false;
}

export async function extensionInfo(): Promise<ExtensionHelloResponse | null> {
  return null;
}

export async function sendExtensionRequest<T = unknown>(
  _ops: unknown,
): Promise<ExtensionMakeRequestResponse<T> | null> {
  return {
    success: false,
    error: "Browser extension is no longer supported",
  };
}

export async function setDomainRule(
  _ops: unknown,
): Promise<{ success: boolean } | null> {
  return { success: false };
}

export async function sendPage(
  _ops: unknown,
): Promise<{ success: boolean } | null> {
  return { success: false };
}

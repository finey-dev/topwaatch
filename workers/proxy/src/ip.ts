/// <reference types="@cloudflare/workers-types" />

/**
 * Reject destinations that resolve to private / loopback / link-local addresses (SSRF guard).
 * Hostname-based checks cover literal IPs; DNS resolution is best-effort on Workers.
 */

const PRIVATE_IPV4 = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^100\.(6[4-9]|[7-9]\d|1[0-1]\d|12[0-7])\./, // CGNAT 100.64/10
  /^172\.(1[6-9]|2\d|3[0-1])\./,
];

function isPrivateIpv4(ip: string): boolean {
  return PRIVATE_IPV4.some((re) => re.test(ip));
}

function isPrivateIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === "::1" || normalized === "::") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // ULA
  if (normalized.startsWith("fe80")) return true; // link-local
  // IPv4-mapped ::ffff:x.x.x.x
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIpv4(mapped[1]);
  return false;
}

function isPrivateHostname(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host === "0.0.0.0") {
    return true;
  }
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return isPrivateIpv4(host);
  if (host.includes(":")) return isPrivateIpv6(host);
  return false;
}

export function assertPublicDestination(destination: string): URL {
  let url: URL;
  try {
    url = new URL(destination);
  } catch {
    throw new Error("Invalid destination URL");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http and https destinations are allowed");
  }

  if (isPrivateHostname(url.hostname)) {
    throw new Error("Private or loopback destinations are not allowed");
  }

  return url;
}

/// <reference types="@cloudflare/workers-types" />

const headerMap: Record<string, string> = {
  "X-Cookie": "Cookie",
  "X-Referer": "Referer",
  "X-Origin": "Origin",
  "X-User-Agent": "User-Agent",
  "X-X-Real-Ip": "X-Real-Ip",
};

const blacklistedHeaders = new Set([
  "cf-connecting-ip",
  "cf-worker",
  "cf-ray",
  "cf-visitor",
  "cf-ew-via",
  "cdn-loop",
  "x-amzn-trace-id",
  "cf-ipcountry",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-proto",
  "forwarded",
  "x-real-ip",
  "content-length",
  "host",
  ...Object.keys(headerMap).map((k) => k.toLowerCase()),
]);

const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:93.0) Gecko/20100101 Firefox/93.0";

export function getProxyHeaders(incoming: Headers): Headers {
  const output = new Headers();
  output.set("User-Agent", DEFAULT_UA);

  for (const [from, to] of Object.entries(headerMap)) {
    const value = incoming.get(from);
    if (value) output.set(to, value);
  }

  return output;
}

export function mergeForwardHeaders(
  incoming: Headers,
  remapped: Headers,
): Headers {
  const output = new Headers();

  incoming.forEach((value, key) => {
    if (blacklistedHeaders.has(key.toLowerCase())) return;
    if (key.toLowerCase() === "accept-encoding" && value.includes("zstd")) {
      output.set(
        key,
        value
          .split(",")
          .map((x) => x.trim())
          .filter((x) => x !== "zstd")
          .join(", "),
      );
      return;
    }
    output.set(key, value);
  });

  remapped.forEach((value, key) => {
    output.set(key, value);
  });

  return output;
}

export function getAfterResponseHeaders(
  originHeaders: Headers,
  finalUrl: string,
  corsOrigin: string,
): Headers {
  const output = new Headers();
  output.set("Access-Control-Allow-Origin", corsOrigin);
  output.set("Access-Control-Expose-Headers", "*");
  output.set("Access-Control-Allow-Headers", "*");
  output.set("Access-Control-Allow-Methods", "*");
  output.set("Vary", "Origin, Range");
  output.set("X-Final-Destination", finalUrl);

  // Forward media-critical headers so <video> / Range (206) works through /proxy.
  //
  // Never forward content-encoding or content-length. workerd may decompress
  // upstream bodies while leaving the original Content-Length, which causes
  // Chrome's net::ERR_CONTENT_LENGTH_MISMATCH on 206 Partial Content (black
  // player). Chunked transfer + Content-Range is enough for seeking.
  const passThrough = [
    "content-type",
    "content-range",
    "accept-ranges",
    "etag",
    "last-modified",
    "cache-control",
  ];
  for (const key of passThrough) {
    const value = originHeaders.get(key);
    if (value) output.set(key, value);
  }

  // Ensure seekers know ranges are supported even if origin omits the header
  if (!output.has("Accept-Ranges") && originHeaders.has("Content-Range")) {
    output.set("Accept-Ranges", "bytes");
  }

  const setCookie = originHeaders.get("Set-Cookie");
  if (setCookie) output.set("X-Set-Cookie", setCookie);

  return output;
}

export function corsHeaders(corsOrigin: string): Headers {
  return new Headers({
    "Access-Control-Allow-Origin": corsOrigin,
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "*",
    "Access-Control-Expose-Headers": "*",
    Vary: "Origin",
  });
}

export { DEFAULT_UA };

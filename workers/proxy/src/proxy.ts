/// <reference types="@cloudflare/workers-types" />

import {
  DEFAULT_UA,
  getAfterResponseHeaders,
  getProxyHeaders,
} from "./headers";
import { assertPublicDestination } from "./ip";

const PAYLOAD_METHODS = new Set(["PATCH", "POST", "PUT", "DELETE"]);

/** Hop-by-hop / browser-only headers that must not be sent upstream. */
const STRIP_UPSTREAM = new Set([
  "host",
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "accept-encoding",
  "content-length",
  "cookie", // only allow via explicit stream headers / X-Cookie
]);

export function buildOriginHeaders(
  headersParam: string | null,
): Record<string, string> {
  if (!headersParam) return {};
  try {
    const parsed = JSON.parse(headersParam) as Record<string, string>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    throw new Error("Invalid headers format");
  }
}

/** Safe request headers to forward for scrape POSTs (not browser Accept-Encoding). */
const FORWARD_REQUEST = ["content-type", "accept", "accept-language"];

/**
 * Build upstream headers the way P-Stream's simple-proxy did:
 * remapped X-* + stream Referer/Origin + client Range/Content-Type.
 * Do NOT forward browser Accept-Encoding  compressed bodies break media.
 */
function buildUpstreamHeaders(
  request: Request,
  streamHeaders: Record<string, string>,
): Headers {
  const output = getProxyHeaders(request.headers);

  for (const [key, value] of Object.entries(streamHeaders)) {
    if (!value) continue;
    if (STRIP_UPSTREAM.has(key.toLowerCase())) continue;
    output.set(key, value);
  }

  // Scrape POSTs send Content-Type on the proxy request (not in headers=).
  for (const key of FORWARD_REQUEST) {
    const value = request.headers.get(key);
    if (value && !output.has(key)) output.set(key, value);
  }

  // Video players rely on Range → 206; always forward from the browser.
  const range = request.headers.get("Range");
  if (range) output.set("Range", range);

  const ifRange = request.headers.get("If-Range");
  if (ifRange) output.set("If-Range", ifRange);

  // Raw bytes only  compressed bodies break length vs streamed size.
  output.set("Accept-Encoding", "identity");

  if (!output.has("User-Agent")) {
    output.set("User-Agent", DEFAULT_UA);
  }

  return output;
}

export async function handleProxy(
  request: Request,
  corsOrigin: string,
): Promise<Response> {
  const url = new URL(request.url);
  const destination = url.searchParams.get("destination");
  const headersParam = url.searchParams.get("headers");

  if (!destination) {
    return Response.json(
      { message: "Proxy is working as expected (v0.1.0)" },
      {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": corsOrigin,
          "Access-Control-Expose-Headers": "*",
        },
      },
    );
  }

  let target: URL;
  try {
    target = assertPublicDestination(destination);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Invalid destination" },
      {
        status: 400,
        headers: { "Access-Control-Allow-Origin": corsOrigin },
      },
    );
  }

  let streamHeaders: Record<string, string> = {};
  try {
    streamHeaders = buildOriginHeaders(headersParam);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Invalid headers" },
      {
        status: 400,
        headers: { "Access-Control-Allow-Origin": corsOrigin },
      },
    );
  }

  const fetchHeaders = buildUpstreamHeaders(request, streamHeaders);

  let body: ArrayBuffer | undefined;
  if (PAYLOAD_METHODS.has(request.method)) {
    body = await request.arrayBuffer();
  }

  let upstream: Response;
  try {
    upstream = await fetch(target.toString(), {
      method: request.method === "HEAD" ? "HEAD" : request.method,
      headers: fetchHeaders,
      body,
      redirect: "follow",
    });
  } catch (err) {
    return Response.json(
      {
        error: err instanceof Error ? err.message : "Upstream fetch failed",
        destination: target.toString(),
      },
      {
        status: 502,
        headers: {
          "Access-Control-Allow-Origin": corsOrigin,
          "Access-Control-Expose-Headers": "*",
        },
      },
    );
  }

  const responseHeaders = getAfterResponseHeaders(
    upstream.headers,
    upstream.url,
    corsOrigin,
  );

  // Re-stream through a TransformStream so workerd cannot re-attach the
  // upstream Content-Length (that causes ERR_CONTENT_LENGTH_MISMATCH when
  // the streamed byte count diverges from the header).
  let bodyOut: ReadableStream | null = upstream.body;
  if (bodyOut && request.method !== "HEAD") {
    const { readable, writable } = new TransformStream();
    bodyOut.pipeTo(writable).catch(() => {
      /* client aborted or upstream closed */
    });
    bodyOut = readable;
  }

  return new Response(bodyOut, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export { DEFAULT_UA };

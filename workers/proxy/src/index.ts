/// <reference types="@cloudflare/workers-types" />

import { corsHeaders } from "./headers";
import { handleM3u8 } from "./m3u8";
import { renderProxyMetricsText, timedProxy } from "./metrics";
import { handleProxy } from "./proxy";
import { handleTs } from "./ts";

export interface Env {
  ALLOWED_ORIGIN?: string;
  /** Success sample rate for /ts-proxy (default 0.01). Errors always logged. */
  PROXY_METRICS_SAMPLE_TS?: string;
  /** Success sample rate for /m3u8-proxy (default 0.1). */
  PROXY_METRICS_SAMPLE_M3U8?: string;
  /** Success sample rate for /proxy (default 0.1). */
  PROXY_METRICS_SAMPLE_PROXY?: string;
  /** Set to "0" to disable structured console logs (counters still update). */
  PROXY_METRICS_LOG?: string;
}

function resolveCorsOrigin(request: Request, env: Env): string {
  const allowed = env.ALLOWED_ORIGIN?.trim();
  if (!allowed || allowed === "*") return "*";

  const origin = request.headers.get("Origin");
  if (origin && origin === allowed) return origin;

  const extras = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
  ];
  if (origin && extras.includes(origin)) return origin;

  return allowed;
}

function handleOptions(corsOrigin: string): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(corsOrigin),
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const corsOrigin = resolveCorsOrigin(request, env);
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (request.method === "OPTIONS") {
      return handleOptions(corsOrigin);
    }

    // Per-isolate Prometheus text (ephemeral; use with Logpush for fleet view)
    if (path === "/metrics") {
      const headers = corsHeaders(corsOrigin);
      headers.set(
        "Content-Type",
        "text/plain; version=0.0.4; charset=utf-8",
      );
      headers.set("Cache-Control", "no-store");
      return new Response(renderProxyMetricsText(), { status: 200, headers });
    }

    if (path === "/m3u8-proxy") {
      return timedProxy("m3u8", url.searchParams.get("url"), env, () =>
        handleM3u8(request, corsOrigin),
      );
    }

    if (path === "/ts-proxy") {
      return timedProxy("ts", url.searchParams.get("url"), env, () =>
        handleTs(request, corsOrigin),
      );
    }

    if (path === "/" || path === "/proxy") {
      if (path === "/" && !url.searchParams.has("destination")) {
        return new Response("OK", {
          status: 200,
          headers: corsHeaders(corsOrigin),
        });
      }
      return timedProxy(
        "proxy",
        url.searchParams.get("destination"),
        env,
        () => handleProxy(request, corsOrigin),
      );
    }

    return new Response("Not Found", {
      status: 404,
      headers: corsHeaders(corsOrigin),
    });
  },
};

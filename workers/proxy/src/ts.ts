/// <reference types="@cloudflare/workers-types" />

import { corsHeaders, DEFAULT_UA } from "./headers";
import { assertPublicDestination } from "./ip";
import { buildOriginHeaders } from "./proxy";

export async function handleTs(
  request: Request,
  corsOrigin: string,
): Promise<Response> {
  const url = new URL(request.url);
  const targetUrl = url.searchParams.get("url");
  const headersParam = url.searchParams.get("headers");

  if (!targetUrl) {
    return new Response("URL parameter is required", {
      status: 400,
      headers: corsHeaders(corsOrigin),
    });
  }

  let headers: Record<string, string>;
  try {
    headers = buildOriginHeaders(headersParam);
  } catch (err) {
    return new Response(
      err instanceof Error ? err.message : "Invalid headers",
      { status: 400, headers: corsHeaders(corsOrigin) },
    );
  }

  let parsedTarget: URL;
  try {
    parsedTarget = assertPublicDestination(targetUrl);
  } catch (err) {
    return new Response(
      err instanceof Error ? err.message : "Invalid destination",
      { status: 400, headers: corsHeaders(corsOrigin) },
    );
  }

  try {
    const response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "User-Agent": DEFAULT_UA,
        "Accept-Encoding": "identity",
        ...headers,
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch TS file: ${response.status} ${response.statusText}`,
      );
    }

    const outHeaders = corsHeaders(corsOrigin);
    const upstreamType = response.headers.get("Content-Type");
    let contentType = upstreamType || "video/mp2t";
    if (!upstreamType) {
      const path = parsedTarget.pathname.toLowerCase();
      if (path.endsWith(".mp4") || path.includes("init.mp4")) {
        contentType = "video/mp4";
      } else if (path.endsWith(".m4s")) {
        contentType = "video/iso.segment";
      }
    }
    outHeaders.set("Content-Type", contentType);
    outHeaders.set("Cache-Control", "public, max-age=3600");

    // Pass response.body directly  avoids routing every chunk through the
    // JS heap via TransformStream, which burns CPU budget on the free plan.
    return new Response(response.body, {
      status: 200,
      headers: outHeaders,
    });
  } catch (err) {
    return new Response(
      err instanceof Error ? err.message : "Error proxying TS file",
      { status: 500, headers: corsHeaders(corsOrigin) },
    );
  }
}

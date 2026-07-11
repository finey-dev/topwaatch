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

  try {
    assertPublicDestination(targetUrl);
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
    outHeaders.set(
      "Content-Type",
      response.headers.get("Content-Type") || "video/mp2t",
    );
    outHeaders.set("Cache-Control", "public, max-age=3600");

    let bodyOut: ReadableStream | null = response.body;
    if (bodyOut) {
      const { readable, writable } = new TransformStream();
      bodyOut.pipeTo(writable).catch(() => {});
      bodyOut = readable;
    }

    return new Response(bodyOut, {
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

import { buildOgResponse } from "../lib/og/handler";

export const config = {
  runtime: "edge",
};

export async function GET(request: Request): Promise<Response> {
  return buildOgResponse(request);
}

export async function HEAD(request: Request): Promise<Response> {
  const response = await buildOgResponse(request);
  return new Response(null, {
    status: response.status,
    headers: response.headers,
  });
}

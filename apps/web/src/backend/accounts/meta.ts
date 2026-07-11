import { ofetch } from "ofetch";

export interface MetaResponse {
  version: string;
  name: string;
  description?: string;
  hasCaptcha: boolean;
  captchaClientKey?: string;
}

function unwrapTrpcData<T>(body: unknown): T {
  const b = body as { result?: { data?: { json?: T } | T } };
  const data = b?.result?.data;
  if (data && typeof data === "object" && data !== null && "json" in data) {
    return (data as { json: T }).json;
  }
  return data as T;
}

export async function getBackendMeta(url: string): Promise<MetaResponse> {
  const body = await ofetch<unknown>("/trpc/meta.get", {
    baseURL: url,
  });
  const meta = unwrapTrpcData<MetaResponse>(body);

  return {
    ...meta,
    name: meta.name.replace(/\\'/g, "'"),
    description: meta.description?.replace(/\\'/g, "'"),
  };
}

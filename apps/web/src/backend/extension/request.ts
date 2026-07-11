export function convertBodyToObject(body: unknown): unknown {
  return body;
}

export function getBodyTypeFromBody(
  _body: unknown,
): "string" | "FormData" | "URLSearchParams" | "object" | undefined {
  return undefined;
}

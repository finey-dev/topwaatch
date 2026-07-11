import { createAuthClient } from "better-auth/react";

import { conf } from "@/setup/config";

export function getAuthBaseUrl(): string {
  const url = conf().BACKEND_URL;
  if (!url) {
    throw new Error("BACKEND_URL is not configured");
  }
  return url.replace(/\/$/, "");
}

export const authClient = createAuthClient({
  baseURL: getAuthBaseUrl(),
  fetchOptions: {
    credentials: "include",
  },
});

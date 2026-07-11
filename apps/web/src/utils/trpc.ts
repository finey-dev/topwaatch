import { QueryClient } from "@tanstack/react-query";
import type { AppRouter } from "@topwaatch/api/routers/index";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";

import { conf } from "@/setup/config";
import { useAuthStore } from "@/stores/auth";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

function getTrpcBaseUrl(): string {
  const custom = useAuthStore.getState().backendUrl;
  const fromConfig = conf().BACKEND_URL;
  const url = custom ?? fromConfig;
  if (!url) {
    throw new Error("BACKEND_URL is not configured");
  }
  return `${url.replace(/\/$/, "")}/trpc`;
}

/**
 * httpBatchLink in our tRPC version types `url` as string only.
 * We resolve the backend URL at module load; changing backendUrl in settings
 * reloads the page, which recreates this client.
 */
export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: getTrpcBaseUrl(),
      fetch(url, options) {
        return fetch(url, {
          ...options,
          credentials: "include",
        });
      },
    }),
  ],
});

export const trpc = createTRPCOptionsProxy<AppRouter>({
  client: trpcClient,
  queryClient,
});

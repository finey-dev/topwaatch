import { useAuthStore } from "@/stores/auth";

export async function hasProxyCheck(): Promise<boolean> {
  const hasProxy = Boolean(useAuthStore.getState().proxySet);
  return hasProxy;
}

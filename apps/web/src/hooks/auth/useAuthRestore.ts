import { useRef } from "react";
import { useAsync, useInterval } from "react-use";

import { useAuth } from "@/hooks/auth/useAuth";
import { authClient } from "@/lib/auth-client";
import { useAuthStore } from "@/stores/auth";

const AUTH_CHECK_INTERVAL = 12 * 60 * 60 * 1000;

function defaultProfile() {
  return {
    colorA: "#553DB6",
    colorB: "#9A78F0",
    icon: "user",
  };
}

export function useAuthRestore() {
  const { account } = useAuthStore();
  const { restore } = useAuth();
  const hasRestored = useRef(false);

  useInterval(() => {
    const current = useAuthStore.getState().account;
    if (current) restore(current);
  }, AUTH_CHECK_INTERVAL);

  const result = useAsync(async () => {
    if (hasRestored.current) return;

    let accountToRestore = account;

    // Cookie session may exist without a persisted local account (fresh login / cleared store)
    if (!accountToRestore) {
      const session = await authClient.getSession();
      if (session.data?.user) {
        accountToRestore = {
          token: "",
          seed: "",
          sessionId: session.data.session.id,
          userId: session.data.user.id,
          deviceName: "Web",
          nickname: session.data.user.name || "User",
          image: session.data.user.image ?? null,
          profile: defaultProfile(),
        };
        useAuthStore.getState().setAccount(accountToRestore);
      }
    }

    if (!accountToRestore) {
      hasRestored.current = true;
      return;
    }

    await restore(accountToRestore).finally(() => {
      hasRestored.current = true;
    });
  }, []);

  return result;
}

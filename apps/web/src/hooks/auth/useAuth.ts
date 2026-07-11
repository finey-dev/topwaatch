import { useCallback } from "react";

import { bookmarkMediaToInput } from "@/backend/accounts/bookmarks";
import { importBookmarks, importProgress } from "@/backend/accounts/import";
import { progressMediaItemToInputs } from "@/backend/accounts/progress";
import {
  UserResponse,
  getBookmarks,
  getProgress,
  getUser,
  getWatchHistory,
} from "@/backend/accounts/user";
import { getGroupOrder } from "@/backend/accounts/groupOrder";
import { getSettings } from "@/backend/accounts/settings";
import { useAuthData } from "@/hooks/auth/useAuthData";
import { useBackendUrl } from "@/hooks/auth/useBackendUrl";
import { authClient } from "@/lib/auth-client";
import { AccountWithToken, useAuthStore } from "@/stores/auth";
import { BookmarkMediaItem } from "@/stores/bookmarks";
import { ProgressMediaItem } from "@/stores/progress";
import { queryClient } from "@/utils/trpc";

export interface RegistrationData {
  email: string;
  password: string;
  name: string;
  userData?: {
    device?: string;
    profile?: {
      colorA: string;
      colorB: string;
      icon: string;
    };
  };
}

export interface LoginData {
  email: string;
  password: string;
  userData?: {
    device?: string;
  };
}

function defaultProfile() {
  return {
    colorA: "#553DB6",
    colorB: "#9A78F0",
    icon: "user",
  };
}

export function useAuth() {
  const profile = useAuthStore((s) => s.account?.profile);
  const loggedIn = !!useAuthStore((s) => s.account);
  const backendUrl = useBackendUrl();
  const {
    logout: userDataLogout,
    login: userDataLogin,
    syncData,
  } = useAuthData();

  const login = useCallback(
    async (loginData: LoginData) => {
      const result = await authClient.signIn.email({
        email: loginData.email.trim(),
        password: loginData.password,
      });

      if (result.error) {
        const message = result.error.message || "Failed to sign in";
        if (
          message.includes("ACCOUNT_DEACTIVATED") ||
          message.toLowerCase().includes("deactivated")
        ) {
          throw new Error("ACCOUNT_DEACTIVATED");
        }
        throw new Error(message);
      }

      const user = await getUser();
      queryClient.invalidateQueries();
      return userDataLogin(
        {
          token: "",
          session: { id: user.session.id },
        },
        user.user,
        user.session,
        "",
      );
    },
    [userDataLogin],
  );

  const logout = useCallback(async () => {
    try {
      await authClient.signOut();
    } catch {
      // ignore sign-out network failures
    }
    queryClient.clear();
    await userDataLogout();
  }, [userDataLogout]);

  const disconnectFromBackend = useCallback(async () => {
    try {
      await authClient.signOut();
    } catch {
      // ignore
    }
    queryClient.clear();
    useAuthStore.getState().removeAccount();
  }, []);

  const register = useCallback(
    async (registerData: RegistrationData) => {
      const result = await authClient.signUp.email({
        email: registerData.email.trim(),
        password: registerData.password,
        name: registerData.name.trim(),
      });

      if (result.error) {
        throw new Error(result.error.message || "Failed to sign up");
      }

      // Ensure profile exists with preferred nickname/colors when provided
      if (registerData.userData?.profile || registerData.name) {
        try {
          const { editUser } = await import("@/backend/accounts/user");
          await editUser(backendUrl ?? "", {
            token: "",
            userId: result.data?.user.id ?? "",
            sessionId: "",
            seed: "",
            deviceName: registerData.userData?.device ?? "Web",
            nickname: registerData.name.trim(),
            profile: registerData.userData?.profile ?? defaultProfile(),
          }, {
            nickname: registerData.name.trim(),
            profile: registerData.userData?.profile,
          });
        } catch {
          // profile creation is best-effort on first login restore
        }
      }

      const user = await getUser();
      queryClient.invalidateQueries();
      return userDataLogin(
        {
          token: "",
          session: { id: user.session.id },
        },
        user.user,
        user.session,
        "",
      );
    },
    [backendUrl, userDataLogin],
  );

  const importData = useCallback(
    async (
      account: AccountWithToken,
      progressItems: Record<string, ProgressMediaItem>,
      bookmarks: Record<string, BookmarkMediaItem>,
    ) => {
      if (!backendUrl) return;
      if (
        Object.keys(progressItems).length === 0 &&
        Object.keys(bookmarks).length === 0
      ) {
        return;
      }

      const progressInputs = Object.entries(progressItems).flatMap(
        ([tmdbId, item]) => progressMediaItemToInputs(tmdbId, item),
      );

      const bookmarkInputs = Object.entries(bookmarks).map(([tmdbId, item]) =>
        bookmarkMediaToInput(tmdbId, item),
      );

      await Promise.all([
        importProgress(backendUrl, account, progressInputs),
        importBookmarks(backendUrl, account, bookmarkInputs),
      ]);
    },
    [backendUrl],
  );

  const restore = useCallback(
    async (account: AccountWithToken) => {
      let user: { user: UserResponse; session: Awaited<ReturnType<typeof getUser>>["session"] };
      try {
        user = await getUser();
      } catch (err) {
        const anyError: any = err;
        const code = anyError?.data?.code ?? anyError?.shape?.data?.code;
        const status = anyError?.response?.status;
        if (
          code === "UNAUTHORIZED" ||
          status === 401 ||
          status === 403 ||
          status === 400
        ) {
          await logout();
          return;
        }
        console.error(err);
        throw err;
      }

      const [bookmarks, progress, watchHistory, settings, groupOrder] =
        await Promise.all([
          getBookmarks(backendUrl ?? "", account),
          getProgress(backendUrl ?? "", account),
          getWatchHistory(backendUrl ?? "", account),
          getSettings(backendUrl ?? "", account),
          getGroupOrder(backendUrl ?? "", account),
        ]);

      const { setAccount } = useAuthStore.getState();
      setAccount({
        ...account,
        userId: user.user.id,
        sessionId: user.session.id,
        nickname: user.user.nickname,
        profile: user.user.profile,
        image: user.user.image ?? null,
        token: "",
        seed: "",
      });

      syncData(
        user.user,
        user.session,
        progress,
        bookmarks,
        watchHistory,
        settings,
        groupOrder,
      );
    },
    [backendUrl, syncData, logout],
  );

  return {
    loggedIn,
    profile,
    login,
    logout,
    disconnectFromBackend,
    register,
    restore,
    importData,
  };
}

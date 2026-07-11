import { TRPCError } from "@trpc/server";

import type { Context } from "../context";

export function requireUserId(ctx: Context): string {
  if (!ctx.session?.user?.id) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required",
    });
  }
  return ctx.session.user.id;
}

export function assertSelf(userId: string, sessionUserId: string) {
  if (userId !== sessionUserId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Cannot access other user information",
    });
  }
}

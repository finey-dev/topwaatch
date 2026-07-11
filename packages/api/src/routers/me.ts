import { session as sessionTable } from "@topwaatch/db/schema/auth";
import { userProfile } from "@topwaatch/db/schema/user-profile";
import { TRPCError } from "@trpc/server";
import { and, eq, gt } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure, router } from "../index";
import { requireUserId } from "../lib/user";

export const meRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const userId = requireUserId(ctx);

    const profile = await ctx.db.query.userProfile.findFirst({
      where: eq(userProfile.userId, userId),
    });

    return {
      user: {
        id: ctx.session!.user.id,
        name: ctx.session!.user.name,
        email: ctx.session!.user.email,
        image: ctx.session!.user.image,
        nickname: profile?.nickname ?? ctx.session!.user.name,
        profile: profile?.profile ?? null,
        ratings: profile?.ratings ?? [],
      },
      session: {
        id: ctx.session!.session.id,
        userId: ctx.session!.user.id,
        expiresAt: ctx.session!.session.expiresAt,
      },
    };
  }),

  /**
   * List the signed-in user's own sessions.
   * Avoids Better Auth `/list-sessions`, which requires a "fresh" login (SESSION_NOT_FRESH).
   */
  listSessions: protectedProcedure.query(async ({ ctx }) => {
    const userId = requireUserId(ctx);
    const now = new Date();

    const rows = await ctx.db.query.session.findMany({
      where: and(eq(sessionTable.userId, userId), gt(sessionTable.expiresAt, now)),
      orderBy: (fields, { desc }) => [desc(fields.updatedAt)],
    });

    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      token: row.token,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      expiresAt: row.expiresAt,
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
    }));
  }),

  /**
   * Revoke one of the signed-in user's sessions (by session id or token).
   * Never accepts another user's session.
   */
  revokeSession: protectedProcedure
    .input(z.object({ sessionId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx);

      const existing = await ctx.db.query.session.findFirst({
        where: and(
          eq(sessionTable.userId, userId),
          eq(sessionTable.id, input.sessionId),
        ),
        columns: { id: true },
      });

      // Also allow revoke by token value (Better Auth client used token before)
      const byToken =
        existing ??
        (await ctx.db.query.session.findFirst({
          where: and(
            eq(sessionTable.userId, userId),
            eq(sessionTable.token, input.sessionId),
          ),
          columns: { id: true },
        }));

      if (!byToken) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found",
        });
      }

      await ctx.db
        .delete(sessionTable)
        .where(
          and(eq(sessionTable.id, byToken.id), eq(sessionTable.userId, userId)),
        );

      return { success: true as const };
    }),
});

import { account, session, user } from "@topwaatch/db/schema/auth";
import { bookmarks } from "@topwaatch/db/schema/bookmarks";
import { listItems, lists } from "@topwaatch/db/schema/lists";
import { progressItems } from "@topwaatch/db/schema/progress";
import { userGroupOrder } from "@topwaatch/db/schema/user-group-order";
import { userProfile } from "@topwaatch/db/schema/user-profile";
import { userSettings } from "@topwaatch/db/schema/user-settings";
import { watchHistory } from "@topwaatch/db/schema/watch-history";
import { TRPCError } from "@trpc/server";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure, router } from "../index";
import { requireUserId } from "../lib/user";

const userProfileSchema = z.object({
  profile: z
    .object({
      icon: z.string(),
      colorA: z.string(),
      colorB: z.string(),
    })
    .optional(),
  nickname: z.string().min(1).max(255).optional(),
});

const deleteAccountSchema = z.object({
  /** Must match the signed-in user's email  prevents accidental / cross-account deletes. */
  confirmEmail: z.string().email(),
});

export const profileRouter = router({
  update: protectedProcedure.input(userProfileSchema).mutation(async ({ ctx, input }) => {
    const userId = requireUserId(ctx);
    const validatedBody = userProfileSchema.parse(input);

    const existing = await ctx.db.query.userProfile.findFirst({
      where: eq(userProfile.userId, userId),
    });

    const nickname =
      validatedBody.nickname ?? existing?.nickname ?? ctx.session!.user.name ?? "User";
    const profile =
      validatedBody.profile ??
      existing?.profile ?? {
        icon: "generic",
        colorA: "#000000",
        colorB: "#000000",
      };

    const [row] = await ctx.db
      .insert(userProfile)
      .values({
        userId,
        nickname,
        profile,
        ratings: existing?.ratings ?? [],
        lastLoggedInAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userProfile.userId,
        set: {
          ...(validatedBody.nickname !== undefined ? { nickname: validatedBody.nickname } : {}),
          ...(validatedBody.profile !== undefined ? { profile: validatedBody.profile } : {}),
          updatedAt: new Date(),
        },
      })
      .returning();

    if (!row) throw new Error("Failed to update profile");
    return {
      id: userId,
      nickname: row.nickname,
      profile: row.profile,
      ratings: row.ratings,
      lastLoggedInAt: row.lastLoggedInAt,
    };
  }),

  /**
   * Soft-disable the signed-in account. Data is retained; all sessions are revoked.
   * The user cannot sign in again until an admin reactivates (via support email).
   */
  deactivateAccount: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = requireUserId(ctx);

    await ctx.db.transaction(async (tx) => {
      const [row] = await tx
        .update(user)
        .set({ deactivatedAt: new Date(), updatedAt: new Date() })
        .where(eq(user.id, userId))
        .returning({ id: user.id });

      if (!row) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Account not found",
        });
      }

      // Only the authenticated user's sessions
      await tx.delete(session).where(eq(session.userId, userId));
    });

    return { success: true as const, message: "Account deactivated" };
  }),

  /**
   * Permanently delete the signed-in user's account and all app data owned by them.
   * Identity comes only from the session  never from a client-supplied user id.
   */
  deleteAccount: protectedProcedure
    .input(deleteAccountSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx);
      const sessionEmail = ctx.session!.user.email?.trim().toLowerCase();
      const confirmEmail = input.confirmEmail.trim().toLowerCase();

      if (!sessionEmail || confirmEmail !== sessionEmail) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Email confirmation does not match the signed-in account",
        });
      }

      await ctx.db.transaction(async (tx) => {
        // Re-load user inside the transaction and verify id + email still match session
        const existing = await tx.query.user.findFirst({
          where: eq(user.id, userId),
          columns: { id: true, email: true },
        });

        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Account not found",
          });
        }

        if (existing.email.trim().toLowerCase() !== sessionEmail) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Cannot delete another user's account",
          });
        }

        await tx.delete(bookmarks).where(eq(bookmarks.userId, userId));
        await tx.delete(progressItems).where(eq(progressItems.userId, userId));
        await tx.delete(watchHistory).where(eq(watchHistory.userId, userId));

        const userLists = await tx.query.lists.findMany({
          where: eq(lists.userId, userId),
          columns: { id: true },
        });
        const listIds = userLists.map((list) => list.id);

        if (listIds.length > 0) {
          await tx.delete(listItems).where(inArray(listItems.listId, listIds));
        }

        await tx.delete(lists).where(eq(lists.userId, userId));
        await tx.delete(userGroupOrder).where(eq(userGroupOrder.userId, userId));
        await tx.delete(userSettings).where(eq(userSettings.id, userId));
        await tx.delete(userProfile).where(eq(userProfile.userId, userId));

        // Auth rows for this user only (session/account also cascade on user delete)
        await tx.delete(session).where(eq(session.userId, userId));
        await tx.delete(account).where(eq(account.userId, userId));
        await tx.delete(user).where(eq(user.id, userId));
      });

      return { success: true as const, message: "User account deleted successfully" };
    }),
});

export const ratingsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = requireUserId(ctx);

    const profile = await ctx.db.query.userProfile.findFirst({
      where: eq(userProfile.userId, userId),
      columns: { ratings: true },
    });

    return {
      userId,
      ratings: profile?.ratings ?? [],
    };
  }),

  upsert: protectedProcedure
    .input(
      z.object({
        tmdb_id: z.number(),
        type: z.enum(["movie", "tv"]),
        rating: z.number().min(0).max(10),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx);
      const validatedBody = input;

      const existing = await ctx.db.query.userProfile.findFirst({
        where: eq(userProfile.userId, userId),
      });

      const currentRatings = Array.isArray(existing?.ratings) ? [...existing!.ratings] : [];
      const existingRatingIndex = currentRatings.findIndex(
        (rating: { tmdb_id?: number; tmdbId?: string; type?: string }) =>
          Number(rating.tmdb_id ?? rating.tmdbId) === validatedBody.tmdb_id &&
          rating.type === validatedBody.type,
      );

      const nextRating = {
        tmdbId: String(validatedBody.tmdb_id),
        type: validatedBody.type,
        rating: validatedBody.rating,
      };

      if (existingRatingIndex >= 0) {
        currentRatings[existingRatingIndex] = nextRating;
      } else {
        currentRatings.push(nextRating);
      }

      await ctx.db
        .insert(userProfile)
        .values({
          userId,
          nickname: existing?.nickname ?? ctx.session!.user.name ?? "User",
          profile: existing?.profile ?? {
            icon: "generic",
            colorA: "#000000",
            colorB: "#000000",
          },
          ratings: currentRatings,
        })
        .onConflictDoUpdate({
          target: userProfile.userId,
          set: {
            ratings: currentRatings,
            updatedAt: new Date(),
          },
        });

      return {
        userId,
        rating: {
          tmdb_id: validatedBody.tmdb_id,
          type: validatedBody.type,
          rating: validatedBody.rating,
        },
      };
    }),
});

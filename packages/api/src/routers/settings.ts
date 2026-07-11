import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";

import { userSettings } from "@topwaatch/db/schema/user-settings";

import { protectedProcedure, router } from "../index";
import { requireUserId } from "../lib/user";
import {
  buildPartialSettingsUpdate,
  buildSettingsWriteData,
  formatUserSettings,
  userSettingsSchema,
} from "../schemas/settings";
import { user } from "@topwaatch/db/schema/auth";

export const settingsRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const userId = requireUserId(ctx);

    const account = await ctx.db.query.user.findFirst({
      where: eq(user.id, userId),
      columns: { id: true },
    });

    if (!account) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    const settings = await ctx.db.query.userSettings.findFirst({
      where: eq(userSettings.id, userId),
    });

    return formatUserSettings(userId, settings ?? null);
  }),

  update: protectedProcedure.input(userSettingsSchema).mutation(async ({ ctx, input }) => {
    const userId = requireUserId(ctx);
    const validatedBody = userSettingsSchema.parse(input);
    const createData = buildSettingsWriteData(validatedBody);
    const updateData = buildPartialSettingsUpdate(input as Record<string, unknown>, createData);

    const [settings] = await ctx.db
      .insert(userSettings)
      .values({
        id: userId,
        ...createData,
      })
      .onConflictDoUpdate({
        target: userSettings.id,
        set: updateData,
      })
      .returning();

    if (!settings) throw new Error("Failed to update settings");
    return formatUserSettings(userId, settings);
  }),
});

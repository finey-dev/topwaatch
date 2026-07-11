import { userGroupOrder } from "@topwaatch/db/schema/user-group-order";
import { eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { z } from "zod";

import { protectedProcedure, router } from "../index";
import { requireUserId } from "../lib/user";

const groupOrderSchema = z.array(z.string()).max(30);

export const groupOrderRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const userId = requireUserId(ctx);

    const groupOrder = await ctx.db.query.userGroupOrder.findFirst({
      where: eq(userGroupOrder.userId, userId),
    });

    return {
      groupOrder: groupOrder?.groupOrder ?? [],
    };
  }),

  update: protectedProcedure.input(groupOrderSchema).mutation(async ({ ctx, input }) => {
    const userId = requireUserId(ctx);
    const validatedGroupOrder = groupOrderSchema.parse(input);

    const [groupOrder] = await ctx.db
      .insert(userGroupOrder)
      .values({
        id: uuidv7(),
        userId,
        groupOrder: validatedGroupOrder,
      })
      .onConflictDoUpdate({
        target: userGroupOrder.userId,
        set: {
          groupOrder: validatedGroupOrder,
          updatedAt: new Date(),
        },
      })
      .returning();

    if (!groupOrder) throw new Error("Failed to update group order");
    return {
      groupOrder: groupOrder.groupOrder,
    };
  }),
});

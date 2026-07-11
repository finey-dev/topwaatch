import { listItems, lists } from "@topwaatch/db/schema/lists";
import { and, eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { uuidv7 } from "uuidv7";
import { z } from "zod";

import { protectedProcedure, publicProcedure, router } from "../index";
import { requireUserId } from "../lib/user";

const listItemSchema = z.object({
  tmdb_id: z.string(),
  type: z.enum(["movie", "tv"]),
});

const createListSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(255).optional().nullable(),
  items: z.array(listItemSchema).optional(),
  public: z.boolean().optional(),
});

const updateListSchema = z.object({
  list_id: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(255).optional().nullable(),
  public: z.boolean().optional(),
  addItems: z.array(listItemSchema).optional(),
  removeItems: z.array(listItemSchema).optional(),
});

function formatList(row: typeof lists.$inferSelect, items: Array<typeof listItems.$inferSelect>) {
  return {
    id: row.id,
    user_id: row.userId,
    name: row.name,
    description: row.description,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    public: row.isPublic,
    list_items: items.map((item) => ({
      id: item.id,
      list_id: item.listId,
      tmdb_id: item.tmdbId,
      added_at: item.addedAt,
      type: item.type,
    })),
  };
}

export const listsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = requireUserId(ctx);

    const userLists = await ctx.db.query.lists.findMany({
      where: eq(lists.userId, userId),
      with: { items: true },
    });

    return {
      lists: userLists.map((list) => formatList(list, list.items)),
    };
  }),

  create: protectedProcedure.input(createListSchema).mutation(async ({ ctx, input }) => {
    const userId = requireUserId(ctx);
    const validatedBody = createListSchema.parse(input);

    const existing = await ctx.db.query.lists.findFirst({
      where: and(eq(lists.userId, userId), eq(lists.name, validatedBody.name)),
    });

    if (existing) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "A list with this name already exists",
      });
    }

    const now = new Date();

    const result = await ctx.db.transaction(async (tx) => {
      const [newList] = await tx
        .insert(lists)
        .values({
          id: uuidv7(),
          userId,
          name: validatedBody.name,
          description: validatedBody.description ?? null,
          isPublic: validatedBody.public ?? false,
          updatedAt: now,
        })
        .returning();

      if (!newList) throw new Error("Failed to create list");

      if (validatedBody.items && validatedBody.items.length > 0) {
        await tx.insert(listItems).values(
          validatedBody.items.map((item) => ({
            id: uuidv7(),
            listId: newList.id,
            tmdbId: item.tmdb_id,
            type: item.type,
          })),
        );
      }

      const items = await tx.query.listItems.findMany({
        where: eq(listItems.listId, newList.id),
      });

      return formatList(newList, items);
    });

    return {
      list: result,
      message: "List created successfully",
    };
  }),

  update: protectedProcedure.input(updateListSchema).mutation(async ({ ctx, input }) => {
    const userId = requireUserId(ctx);
    const validatedBody = updateListSchema.parse(input);

    const list = await ctx.db.query.lists.findFirst({
      where: eq(lists.id, validatedBody.list_id),
      with: { items: true },
    });

    if (!list) {
      throw new TRPCError({ code: "NOT_FOUND", message: "List not found" });
    }

    if (list.userId !== userId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Cannot modify lists you don't own",
      });
    }

    const result = await ctx.db.transaction(async (tx) => {
      if (
        validatedBody.name ||
        validatedBody.description !== undefined ||
        validatedBody.public !== undefined
      ) {
        await tx
          .update(lists)
          .set({
            name: validatedBody.name ?? list.name,
            description:
              validatedBody.description !== undefined
                ? validatedBody.description
                : list.description,
            isPublic: validatedBody.public ?? list.isPublic,
            updatedAt: new Date(),
          })
          .where(eq(lists.id, list.id));
      }

      if (validatedBody.addItems && validatedBody.addItems.length > 0) {
        const existingTmdbIds = list.items.map((item) => item.tmdbId);
        const itemsToAdd = validatedBody.addItems.filter(
          (item) => !existingTmdbIds.includes(item.tmdb_id),
        );

        if (itemsToAdd.length > 0) {
          await tx.insert(listItems).values(
            itemsToAdd.map((item) => ({
              id: uuidv7(),
              listId: list.id,
              tmdbId: item.tmdb_id,
              type: item.type,
            })),
          );
        }
      }

      if (validatedBody.removeItems && validatedBody.removeItems.length > 0) {
        const tmdbIdsToRemove = validatedBody.removeItems.map((item) => item.tmdb_id);
        await tx
          .delete(listItems)
          .where(
            and(eq(listItems.listId, list.id), inArray(listItems.tmdbId, tmdbIdsToRemove)),
          );
      }

      const updatedList = await tx.query.lists.findFirst({
        where: eq(lists.id, list.id),
      });
      const items = await tx.query.listItems.findMany({
        where: eq(listItems.listId, list.id),
      });

      return formatList(updatedList!, items);
    });

    return {
      list: result,
      message: "List updated successfully",
    };
  }),

  delete: protectedProcedure
    .input(z.object({ listId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx);

      const list = await ctx.db.query.lists.findFirst({
        where: eq(lists.id, input.listId),
      });

      if (!list) {
        throw new TRPCError({ code: "NOT_FOUND", message: "List not found" });
      }

      if (list.userId !== userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot delete lists you don't own",
        });
      }

      await ctx.db.transaction(async (tx) => {
        await tx.delete(listItems).where(eq(listItems.listId, input.listId));
        await tx.delete(lists).where(eq(lists.id, input.listId));
      });

      return {
        id: input.listId,
        message: "List deleted successfully",
      };
    }),

  getPublic: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const list = await ctx.db.query.lists.findFirst({
        where: eq(lists.id, input.id),
        with: { items: true },
      });

      if (!list) {
        throw new TRPCError({ code: "NOT_FOUND", message: "List not found" });
      }

      if (!list.isPublic) {
        throw new TRPCError({ code: "FORBIDDEN", message: "List is not public" });
      }

      return formatList(list, list.items);
    }),
});

import { relations } from "drizzle-orm";
import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { user } from "./auth";

export const userGroupOrder = pgTable(
  "user_group_order",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),
    groupOrder: text("group_order").array().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [index("user_group_order_user_id_idx").on(table.userId)],
);

export const userGroupOrderRelations = relations(userGroupOrder, ({ one }) => ({
  user: one(user, {
    fields: [userGroupOrder.userId],
    references: [user.id],
  }),
}));

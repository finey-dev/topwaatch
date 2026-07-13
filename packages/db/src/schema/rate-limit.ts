import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/** Fixed-window counters shared across all serverless instances. */
export const rateLimitBuckets = pgTable("rate_limit_buckets", {
  key: text("key").primaryKey(),
  windowStart: timestamp("window_start", { withTimezone: true, mode: "date" }).notNull(),
  count: integer("count").notNull().default(0),
});

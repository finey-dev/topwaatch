import { auth } from "@topwaatch/auth";
import { db } from "@topwaatch/db";
import { session as sessionTable, user } from "@topwaatch/db/schema/auth";
import { eq } from "drizzle-orm";
import type { Context as HonoContext } from "hono";
// Required for declaration emit: db client types reference Pool.
import type { Pool } from "pg";

export type CreateContextOptions = {
  context: HonoContext;
};

export async function createContext({ context }: CreateContextOptions) {
  const session = await auth.api.getSession({
    headers: context.req.raw.headers,
  });

  // Stale cookies while deactivated must not authorize API calls.
  if (session?.user?.id) {
    const row = await db.query.user.findFirst({
      where: eq(user.id, session.user.id),
      columns: { deactivatedAt: true },
    });
    if (row?.deactivatedAt) {
      await db.delete(sessionTable).where(eq(sessionTable.userId, session.user.id));
      return {
        session: null,
        db,
        clientIp:
          context.req.header("cf-connecting-ip") ||
          context.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
          "unknown",
      };
    }
  }

  return {
    session,
    db,
    clientIp:
      context.req.header("cf-connecting-ip") ||
      context.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown",
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;

export type { Pool };

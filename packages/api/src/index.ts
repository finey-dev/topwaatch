import { initTRPC, TRPCError } from "@trpc/server";

import type { Context } from "./context";
import { assertRateLimit, rateLimitKey } from "./lib/rate-limit";

export const t = initTRPC.context<Context>().create();

export const router = t.router;

export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required",
      cause: "No session",
    });
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
    },
  });
});

/** Public procedure with per-user / per-IP scrape rate limiting. */
export const rateLimitedProcedure = publicProcedure.use(({ ctx, next }) => {
  const key = rateLimitKey(ctx.session?.user?.id, ctx.clientIp);
  assertRateLimit(key);
  return next({ ctx });
});

/** Authenticated + rate-limited  use when Better Auth is wired on all clients. */
export const protectedRateLimitedProcedure = protectedProcedure.use(
  ({ ctx, next }) => {
    const key = rateLimitKey(ctx.session.user.id, ctx.clientIp);
    assertRateLimit(key);
    return next({ ctx });
  },
);

export {
  notFoundPayload,
  runScrapeForUser,
  scrapeInputSchema,
  type NotFoundPayload,
  type ScrapeInput,
  type ScrapeResult,
  type SourceAttempt,
} from "./lib/scrape";

export {
  storeScrapeResult,
  takeScrapeResult,
} from "./lib/scrape-result-cache";

export {
  assertRateLimit,
  checkRateLimit,
  rateLimitKey,
} from "./lib/rate-limit";

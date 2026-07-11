import { expo } from "@better-auth/expo";
import { createDb } from "@topwaatch/db";
import * as schema from "@topwaatch/db/schema/auth";
import { env } from "@topwaatch/env/server";
import { betterAuth, APIError } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { eq } from "drizzle-orm";

const isProd = env.NODE_ENV === "production";

/** Stable code returned when a deactivated user tries to sign in. */
export const ACCOUNT_DEACTIVATED_CODE = "ACCOUNT_DEACTIVATED";

export const ACCOUNT_DEACTIVATED_MESSAGE =
  "ACCOUNT_DEACTIVATED: This account is deactivated. You cannot sign in. To reactivate your account, email topwaatch@gmail.com.";

export function createAuth() {
  const db = createDb();

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: schema,
    }),
    trustedOrigins: [
      env.CORS_ORIGIN,
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "topwaatch://",
      "exp://",
      "http://localhost:8081",
    ],
    emailAndPassword: {
      enabled: true,
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    user: {
      additionalFields: {
        deactivatedAt: {
          type: "date",
          required: false,
          // Clients must not set this via profile update  only server mutations.
          input: false,
        },
      },
    },
    databaseHooks: {
      session: {
        create: {
          // Deactivated accounts cannot create sessions / sign in.
          before: async (session) => {
            const row = await db.query.user.findFirst({
              where: eq(schema.user.id, session.userId),
              columns: { deactivatedAt: true },
            });
            if (row?.deactivatedAt) {
              throw new APIError("FORBIDDEN", {
                message: ACCOUNT_DEACTIVATED_MESSAGE,
              });
            }
          },
        },
      },
    },
    advanced: {
      // Secure + SameSite=None breaks cookies on local HTTP (Vite ↔ API).
      defaultCookieAttributes: isProd
        ? {
            sameSite: "none",
            secure: true,
            httpOnly: true,
          }
        : {
            sameSite: "lax",
            secure: false,
            httpOnly: true,
          },
    },
    plugins: [expo()],
  });
}

export const auth = createAuth();

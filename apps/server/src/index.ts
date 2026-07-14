import { trpcServer } from "@hono/trpc-server";
import { createContext } from "@topwaatch/api/context";
import { appRouter } from "@topwaatch/api/routers/index";
import { auth } from "@topwaatch/auth";
import { env } from "@topwaatch/env/server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { setupMetrics } from "./lib/metrics";
import { febboxRoutes } from "./routes/febbox";
import { metricsRoutes } from "./routes/metrics";
import { scrapeSseRoutes } from "./routes/scrape-sse";

const app = new Hono();

const corsOrigins = new Set(
  [
    env.CORS_ORIGIN,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8081",
    // Tauri 2 desktop webview origins
    "http://tauri.localhost",
    "https://tauri.localhost",
    "tauri://localhost",
  ].filter(Boolean),
);

app.use(logger());
app.use(
  "/*",
  cors({
    origin: (origin) => (origin && corsOrigins.has(origin) ? origin : null),
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "Accept",
      "trpc-accept",
      "x-trpc-source",
    ],
    credentials: true,
  }),
);

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    createContext: (_opts, context) => {
      return createContext({ context });
    },
  }),
);

// SSE scrape progress (EventSource)  business logic in @topwaatch/api
app.route("/", scrapeSseRoutes);

// Anonymous provider / captcha Prometheus metrics
app.route("/", metricsRoutes);

// Febbox ui-cookie traffic / validity
app.route("/", febboxRoutes);

app.get("/", (c) => {
  return c.text("OK");
});

// Warm metrics on boot (idempotent)
setupMetrics().catch(() => {
  /* ignore  first request will retry */
});

export default app;

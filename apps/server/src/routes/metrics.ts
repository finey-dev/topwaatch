import { Hono } from "hono";
import { z } from "zod";

import {
  METRICS_CONTENT_TYPE,
  getMetricsSummary,
  recordCaptchaMetrics,
  recordProviderMetrics,
  renderMetricsText,
  setupMetrics,
} from "../lib/metrics";

/**
 * Anonymous provider / captcha telemetry (ported from P-Stream).
 * No auth  same as the original backend.
 */
export const metricsRoutes = new Hono();

const providerItemSchema = z.object({
  tmdbId: z.string(),
  type: z.string(),
  title: z.string(),
  seasonId: z.string().optional(),
  episodeId: z.string().optional(),
  status: z.string(),
  providerId: z.string(),
  embedId: z.string().optional(),
  errorMessage: z.string().optional(),
  fullError: z.string().optional(),
});

const providersBodySchema = z.object({
  items: z.array(providerItemSchema).min(1).max(50),
  tool: z.string().optional(),
  batchId: z.string().optional(),
});

const captchaBodySchema = z.object({
  success: z.boolean(),
});

function metricsError(err: unknown): { message: string; status: 400 | 503 } {
  if (err instanceof z.ZodError) {
    return {
      message: err.issues.map((i) => i.message).join("; ") || "Invalid metrics payload",
      status: 400,
    };
  }
  const message =
    err instanceof Error ? err.message : "Failed to process metrics";
  if (message === "metrics not initialized") return { message, status: 503 };
  return { message, status: 400 };
}

metricsRoutes.post("/metrics/providers", async (c) => {
  try {
    await setupMetrics();
    const body = providersBodySchema.parse(await c.req.json());
    const hostname = (c.req.header("origin") ?? "<UNKNOWN>").slice(0, 255);
    recordProviderMetrics(body.items, hostname, body.tool);
    return c.json(true);
  } catch (err) {
    const { message, status } = metricsError(err);
    return c.json({ error: message }, status);
  }
});

metricsRoutes.put("/metrics/providers", async (c) => {
  try {
    await setupMetrics();
    const body = providersBodySchema.parse(await c.req.json());
    const hostname = (c.req.header("origin") ?? "<UNKNOWN>").slice(0, 255);
    recordProviderMetrics(body.items, hostname, body.tool);
    return c.json(true);
  } catch (err) {
    const { message, status } = metricsError(err);
    return c.json({ error: message }, status);
  }
});

metricsRoutes.post("/metrics/captcha", async (c) => {
  try {
    await setupMetrics();
    const body = captchaBodySchema.parse(await c.req.json());
    recordCaptchaMetrics(body.success);
    return c.json(true);
  } catch (err) {
    const { message, status } = metricsError(err);
    return c.json({ error: message }, status);
  }
});

/** Prometheus scrape endpoint (admin ConfigValuesPart). */
metricsRoutes.get("/metrics", async (c) => {
  await setupMetrics();
  return c.text(renderMetricsText(), 200, {
    "Content-Type": METRICS_CONTENT_TYPE,
  });
});

/** JSON summary for the settings provider-health UI. */
metricsRoutes.get("/metrics/providers/summary", async (c) => {
  try {
    await setupMetrics();
    return c.json(getMetricsSummary());
  } catch (err) {
    const { message, status } = metricsError(err);
    return c.json({ error: message }, status);
  }
});

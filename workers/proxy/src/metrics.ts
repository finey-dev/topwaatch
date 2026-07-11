/// <reference types="@cloudflare/workers-types" />

/**
 * Lightweight proxy observability:
 * - In-isolate counters (GET /metrics)
 * - Structured JSON logs (errors always; successes sampled)
 * Never logs response bodies or full signed URLs.
 */

export type ProxyRoute = "proxy" | "m3u8" | "ts";

export type ProxyMetricEvent = {
  route: ProxyRoute;
  host: string;
  status: number;
  ms: number;
  bytes?: number;
  ok: boolean;
  error?: string;
};

type CounterKey = string;

const counters = new Map<CounterKey, number>();

function inc(name: string, labels: Record<string, string>, value = 1): void {
  const key = `${name}\0${Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join(",")}`;
  counters.set(key, (counters.get(key) ?? 0) + value);
}

function escapeLabel(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/"/g, '\\"');
}

/** Hostname only  strips userinfo / path / query (tokens, signatures). */
export function metricHost(destination: string | null | undefined): string {
  if (!destination) return "<none>";
  try {
    return new URL(destination).hostname || "<invalid>";
  } catch {
    return "<invalid>";
  }
}

export function sampleRateForRoute(
  route: ProxyRoute,
  env?: {
    PROXY_METRICS_SAMPLE_TS?: string;
    PROXY_METRICS_SAMPLE_M3U8?: string;
    PROXY_METRICS_SAMPLE_PROXY?: string;
  },
): number {
  const parse = (raw: string | undefined, fallback: number) => {
    if (raw == null || raw === "") return fallback;
    const n = Number(raw);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(1, Math.max(0, n));
  };

  if (route === "ts") return parse(env?.PROXY_METRICS_SAMPLE_TS, 0.01);
  if (route === "m3u8") return parse(env?.PROXY_METRICS_SAMPLE_M3U8, 0.1);
  return parse(env?.PROXY_METRICS_SAMPLE_PROXY, 0.1);
}

function shouldLog(
  event: ProxyMetricEvent,
  sampleRate: number,
  loggingEnabled: boolean,
): boolean {
  if (!loggingEnabled) return false;
  if (!event.ok || event.status >= 400) return true;
  return Math.random() < sampleRate;
}

/**
 * Record counters always; emit a structured log when sampled / on error.
 * Safe to call on the hot path  no network I/O.
 */
export function recordProxyMetric(
  event: ProxyMetricEvent,
  env?: {
    PROXY_METRICS_SAMPLE_TS?: string;
    PROXY_METRICS_SAMPLE_M3U8?: string;
    PROXY_METRICS_SAMPLE_PROXY?: string;
    PROXY_METRICS_LOG?: string;
  },
): void {
  const statusClass = `${Math.floor(event.status / 100)}xx`;
  const outcome = event.ok && event.status < 400 ? "ok" : "error";

  // Counters stay low-cardinality (no host). Host only appears in sampled logs.
  inc("tw_proxy_requests_total", {
    route: event.route,
    status_class: statusClass,
    outcome,
  });

  inc("tw_proxy_latency_ms_sum", {
    route: event.route,
    outcome,
  }, event.ms);

  if (event.bytes != null && event.bytes > 0) {
    inc("tw_proxy_bytes_sum", {
      route: event.route,
    }, event.bytes);
  }

  const loggingEnabled = env?.PROXY_METRICS_LOG !== "0";
  const rate = sampleRateForRoute(event.route, env);
  if (!shouldLog(event, rate, loggingEnabled)) return;

  // Structured single-line JSON for wrangler tail / Logpush
  console.log(
    JSON.stringify({
      msg: "proxy_request",
      route: event.route,
      host: event.host.slice(0, 128),
      status: event.status,
      ms: event.ms,
      bytes: event.bytes,
      ok: event.ok,
      error: event.error?.slice(0, 200),
    }),
  );
}

export function renderProxyMetricsText(): string {
  const lines = [
    "# HELP tw_proxy_requests_total Proxied requests by route/status/outcome",
    "# TYPE tw_proxy_requests_total counter",
  ];

  const byName = new Map<string, Array<{ labels: string; value: number }>>();
  for (const [key, value] of counters) {
    const [name, labelStr = ""] = key.split("\0");
    if (!name) continue;
    const list = byName.get(name) ?? [];
    list.push({ labels: labelStr, value });
    byName.set(name, list);
  }

  // Ensure help/type for other series
  const extras: Record<string, string> = {
    tw_proxy_latency_ms_sum: "Sum of proxy request latency in milliseconds",
    tw_proxy_bytes_sum: "Sum of upstream Content-Length when known",
  };

  for (const [name, entries] of byName) {
    if (name !== "tw_proxy_requests_total") {
      lines.push(`# HELP ${name} ${extras[name] ?? name}`);
      lines.push(`# TYPE ${name} counter`);
    }
    for (const { labels, value } of entries) {
      if (!labels) {
        lines.push(`${name} ${value}`);
        continue;
      }
      const labelParts = labels.split(",").filter(Boolean);
      const formatted = labelParts
        .map((part) => {
          const eq = part.indexOf("=");
          if (eq < 0) return `${part}=""`;
          const k = part.slice(0, eq);
          const v = part.slice(eq + 1);
          return `${k}="${escapeLabel(v)}"`;
        })
        .join(",");
      lines.push(`${name}{${formatted}} ${value}`);
    }
  }

  lines.push("");
  return lines.join("\n");
}

export async function timedProxy<T extends Response>(
  route: ProxyRoute,
  destination: string | null,
  env: Parameters<typeof recordProxyMetric>[1],
  run: () => Promise<T>,
): Promise<T> {
  const started = Date.now();
  const host = metricHost(destination);
  try {
    const response = await run();
    const bytesHeader = response.headers.get("Content-Length");
    const bytes = bytesHeader ? Number(bytesHeader) : undefined;
    recordProxyMetric(
      {
        route,
        host,
        status: response.status,
        ms: Date.now() - started,
        bytes: Number.isFinite(bytes) ? bytes : undefined,
        ok: response.status < 400,
      },
      env,
    );
    return response;
  } catch (err) {
    recordProxyMetric(
      {
        route,
        host,
        status: 502,
        ms: Date.now() - started,
        ok: false,
        error: err instanceof Error ? err.message : "unknown error",
      },
      env,
    );
    throw err;
  }
}

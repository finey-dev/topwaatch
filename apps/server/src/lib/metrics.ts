/**
 * Lightweight in-memory Prometheus counters (no prom-client dep).
 * Enough for POST /metrics/providers|captcha and GET /metrics scrape.
 */

type Labels = Record<string, string>;

class Counter {
  private readonly values = new Map<string, number>();

  constructor(
    readonly name: string,
    readonly help: string,
    readonly labelNames: string[],
  ) {}

  inc(labels: Labels, value = 1): void {
    const key = this.labelNames.map((n) => labels[n] ?? "").join("\0");
    this.values.set(key, (this.values.get(key) ?? 0) + value);
  }

  entries(): Array<{ labels: Labels; value: number }> {
    const out: Array<{ labels: Labels; value: number }> = [];
    for (const [key, value] of this.values) {
      const parts = key.split("\0");
      const labels: Labels = {};
      this.labelNames.forEach((name, i) => {
        labels[name] = parts[i] ?? "";
      });
      out.push({ labels, value });
    }
    return out;
  }

  render(): string {
    const lines = [
      `# HELP ${this.name} ${this.help}`,
      `# TYPE ${this.name} counter`,
    ];
    for (const [key, value] of this.values) {
      const parts = key.split("\0");
      const labelStr = this.labelNames
        .map((name, i) => `${name}="${escapeLabel(parts[i] ?? "")}"`)
        .join(",");
      lines.push(
        labelStr
          ? `${this.name}{${labelStr}} ${value}`
          : `${this.name} ${value}`,
      );
    }
    return lines.join("\n");
  }
}

function escapeLabel(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/"/g, '\\"');
}

export type Metrics = {
  captchaSolves: Counter;
  providerHostnames: Counter;
  providerStatuses: Counter;
  watchMetrics: Counter;
  toolMetrics: Counter;
};

let metrics: Metrics | null = null;

function createMetrics(): Metrics {
  return {
    captchaSolves: new Counter(
      "mw_captcha_solves",
      "Number of captcha solves by success status",
      ["success"],
    ),
    providerHostnames: new Counter(
      "mw_provider_hostname_count",
      "Number of requests by provider hostname",
      ["hostname"],
    ),
    providerStatuses: new Counter(
      "mw_provider_status_count",
      "Number of provider requests by status",
      ["provider_id", "status"],
    ),
    watchMetrics: new Counter(
      "mw_media_watch_count",
      "Number of media watch events",
      ["title", "tmdb_full_id", "provider_id", "success"],
    ),
    toolMetrics: new Counter(
      "mw_provider_tool_count",
      "Number of provider tool usages",
      ["tool"],
    ),
  };
}

/** Idempotent  safe to call on every request / hot reload. */
export async function setupMetrics(): Promise<Metrics> {
  if (!metrics) metrics = createMetrics();
  return metrics;
}

export function getMetrics(): Metrics {
  if (!metrics) throw new Error("metrics not initialized");
  return metrics;
}

export function renderMetricsText(): string {
  const m = getMetrics();
  return [
    m.captchaSolves.render(),
    m.providerHostnames.render(),
    m.providerStatuses.render(),
    m.watchMetrics.render(),
    m.toolMetrics.render(),
    "",
  ].join("\n");
}

export const METRICS_CONTENT_TYPE =
  "text/plain; version=0.0.4; charset=utf-8";

export type ProviderMetricItem = {
  tmdbId: string;
  type: string;
  title: string;
  seasonId?: string;
  episodeId?: string;
  status: string;
  providerId: string;
  embedId?: string;
  errorMessage?: string;
  fullError?: string;
};

export function recordProviderMetrics(
  items: ProviderMetricItem[],
  hostname: string,
  tool?: string,
): void {
  const m = getMetrics();

  m.providerHostnames.inc({ hostname });

  for (const item of items) {
    m.providerStatuses.inc({
      provider_id: item.embedId ?? item.providerId,
      status: item.status,
    });
  }

  const reversed = [...items].reverse();
  const lastSuccessful = items.find((v) => v.status === "success");
  const lastItem = reversed[0];

  if (lastItem) {
    m.watchMetrics.inc({
      tmdb_full_id: `${lastItem.type}-${lastItem.tmdbId}`,
      provider_id: lastSuccessful?.providerId ?? lastItem.providerId,
      title: lastItem.title,
      success: String(!!lastSuccessful),
    });
  }

  if (tool) {
    m.toolMetrics.inc({ tool });
  }
}

export function recordCaptchaMetrics(success: boolean): void {
  getMetrics().captchaSolves.inc({ success: String(success) });
}

export type ProviderStatusSummary = {
  providerId: string;
  success: number;
  failed: number;
  notfound: number;
  other: number;
  total: number;
  successRate: number;
};

export type MetricsSummary = {
  providers: ProviderStatusSummary[];
  hostnames: Array<{ hostname: string; count: number }>;
  tools: Array<{ tool: string; count: number }>;
  captcha: { success: number; failed: number };
  totalRequests: number;
};

/** Structured summary for the settings UI (parsed from in-memory counters). */
export function getMetricsSummary(): MetricsSummary {
  const m = getMetrics();

  const byProvider = new Map<
    string,
    { success: number; failed: number; notfound: number; other: number }
  >();

  for (const { labels, value } of m.providerStatuses.entries()) {
    const id = labels.provider_id || "unknown";
    const row = byProvider.get(id) ?? {
      success: 0,
      failed: 0,
      notfound: 0,
      other: 0,
    };
    const status = (labels.status || "").toLowerCase();
    if (status === "success") row.success += value;
    else if (status === "failed" || status === "failure") row.failed += value;
    else if (status === "notfound") row.notfound += value;
    else row.other += value;
    byProvider.set(id, row);
  }

  const providers: ProviderStatusSummary[] = [...byProvider.entries()]
    .map(([providerId, counts]) => {
      const total =
        counts.success + counts.failed + counts.notfound + counts.other;
      return {
        providerId,
        ...counts,
        total,
        successRate: total > 0 ? counts.success / total : 0,
      };
    })
    .sort((a, b) => b.total - a.total);

  const hostnames = m.providerHostnames
    .entries()
    .map(({ labels, value }) => ({
      hostname: labels.hostname || "<UNKNOWN>",
      count: value,
    }))
    .sort((a, b) => b.count - a.count);

  const tools = m.toolMetrics
    .entries()
    .map(({ labels, value }) => ({
      tool: labels.tool || "unknown",
      count: value,
    }))
    .sort((a, b) => b.count - a.count);

  let captchaSuccess = 0;
  let captchaFailed = 0;
  for (const { labels, value } of m.captchaSolves.entries()) {
    if (labels.success === "true") captchaSuccess += value;
    else captchaFailed += value;
  }

  return {
    providers,
    hostnames,
    tools,
    captcha: { success: captchaSuccess, failed: captchaFailed },
    totalRequests: hostnames.reduce((sum, h) => sum + h.count, 0),
  };
}

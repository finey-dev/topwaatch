import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/buttons/Button";
import { Icon, Icons } from "@/components/Icon";
import { Heading1 } from "@/components/utils/Text";
import { conf } from "@/setup/config";

type ProviderStatusSummary = {
  providerId: string;
  success: number;
  failed: number;
  notfound: number;
  other: number;
  total: number;
  successRate: number;
};

type MetricsSummary = {
  providers: ProviderStatusSummary[];
  hostnames: Array<{ hostname: string; count: number }>;
  tools: Array<{ tool: string; count: number }>;
  captcha: { success: number; failed: number };
  totalRequests: number;
};

function getMetricsBackendUrl(): string | null {
  const config = conf();
  return config.BACKEND_URLS.length > 0
    ? config.BACKEND_URLS[0]
    : config.BACKEND_URL;
}

function formatPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

function statusTone(rate: number): string {
  if (rate >= 0.6) return "text-green-400";
  if (rate >= 0.3) return "text-amber-400";
  return "text-red-400";
}

function barTone(rate: number): string {
  if (rate >= 0.6) return "bg-green-500";
  if (rate >= 0.3) return "bg-amber-500";
  return "bg-red-500";
}

export function ProviderMetricsPart() {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<MetricsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const backendUrl = getMetricsBackendUrl();
    if (!backendUrl) {
      setError("No backend URL configured.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${backendUrl}/metrics/providers/summary`);
      if (!res.ok) {
        throw new Error(`Failed to load metrics (${res.status})`);
      }
      const data = (await res.json()) as MetricsSummary;
      setSummary(data);
    } catch (err) {
      setSummary(null);
      setError(
        err instanceof Error ? err.message : "Failed to load provider metrics",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mt-10">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <Heading1 border className="!mb-1">
            {t("settings.metrics.title", "Provider health")}
          </Heading1>
          <p className="text-sm text-type-secondary max-w-xl">
            {t(
              "settings.metrics.description",
              "Anonymous scrape results collected while people watch. Shows which sources succeed most often on this backend (resets when the server restarts).",
            )}
          </p>
        </div>
        <Button theme="secondary" onClick={load} disabled={loading}>
          <Icon icon={Icons.TACHOMETER} className="mr-2" />
          {t("settings.metrics.refresh", "Refresh")}
        </Button>
      </div>

      {loading && !summary ? (
        <p className="text-type-secondary text-sm">
          {t("settings.metrics.loading", "Loading metrics…")}
        </p>
      ) : null}

      {error ? (
        <div className="rounded-xl bg-dropdown-background/30 ring-1 ring-white/5 px-4 py-3 text-sm text-type-secondary">
          {error}
        </div>
      ) : null}

      {summary && !error ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              label={t("settings.metrics.totalScrapes", "Scrapes reported")}
              value={String(summary.totalRequests)}
            />
            <StatCard
              label={t("settings.metrics.providersTracked", "Providers tracked")}
              value={String(summary.providers.length)}
            />
            <StatCard
              label={t("settings.metrics.captchaOk", "Captcha solves")}
              value={String(summary.captcha.success)}
            />
            <StatCard
              label={t("settings.metrics.captchaFail", "Captcha fails")}
              value={String(summary.captcha.failed)}
            />
          </div>

          {summary.providers.length === 0 ? (
            <p className="text-sm text-type-secondary">
              {t(
                "settings.metrics.empty",
                "No provider data yet. Play a title and metrics will show up here.",
              )}
            </p>
          ) : (
            <div className="rounded-xl bg-dropdown-background/30 ring-1 ring-white/5 overflow-hidden">
              <div className="hidden md:grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_4.5rem_4.5rem_4.5rem_4.5rem] gap-3 px-4 py-2 text-xs font-bold uppercase tracking-wider text-type-secondary border-b border-white/5">
                <span>{t("settings.metrics.colProvider", "Provider")}</span>
                <span>{t("settings.metrics.colRate", "Success rate")}</span>
                <span className="text-right">
                  {t("settings.metrics.colSuccess", "OK")}
                </span>
                <span className="text-right">
                  {t("settings.metrics.colFailed", "Fail")}
                </span>
                <span className="text-right">
                  {t("settings.metrics.colNotFound", "Miss")}
                </span>
                <span className="text-right">
                  {t("settings.metrics.colTotal", "Total")}
                </span>
              </div>
              <ul className="divide-y divide-white/5">
                {summary.providers.map((row) => (
                  <li
                    key={row.providerId}
                    className="px-4 py-3 grid grid-cols-1 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_4.5rem_4.5rem_4.5rem_4.5rem] gap-2 md:gap-3 items-center"
                  >
                    <p className="text-white font-medium truncate">
                      {row.providerId}
                    </p>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${barTone(row.successRate)}`}
                          style={{
                            width: `${Math.max(row.successRate * 100, 2)}%`,
                          }}
                        />
                      </div>
                      <span
                        className={`text-sm font-semibold tabular-nums shrink-0 ${statusTone(row.successRate)}`}
                      >
                        {formatPercent(row.successRate)}
                      </span>
                    </div>
                    <span className="text-sm text-type-secondary tabular-nums md:text-right">
                      <span className="md:hidden text-type-secondary/70 mr-1">
                        OK
                      </span>
                      {row.success}
                    </span>
                    <span className="text-sm text-type-secondary tabular-nums md:text-right">
                      <span className="md:hidden text-type-secondary/70 mr-1">
                        Fail
                      </span>
                      {row.failed}
                    </span>
                    <span className="text-sm text-type-secondary tabular-nums md:text-right">
                      <span className="md:hidden text-type-secondary/70 mr-1">
                        Miss
                      </span>
                      {row.notfound}
                    </span>
                    <span className="text-sm text-white tabular-nums md:text-right font-medium">
                      <span className="md:hidden text-type-secondary/70 mr-1">
                        Total
                      </span>
                      {row.total}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {summary.tools.length > 0 ? (
            <div className="flex flex-wrap gap-2 text-xs text-type-secondary">
              <span className="font-semibold uppercase tracking-wider">
                {t("settings.metrics.tools", "Scrape path")}
              </span>
              {summary.tools.map((tool) => (
                <span
                  key={tool.tool}
                  className="rounded-md bg-white/5 px-2 py-1 text-white/80"
                >
                  {tool.tool}: {tool.count}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function StatCard(props: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-dropdown-background/30 ring-1 ring-white/5 px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-wider text-type-secondary">
        {props.label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-white tabular-nums">
        {props.value}
      </p>
    </div>
  );
}

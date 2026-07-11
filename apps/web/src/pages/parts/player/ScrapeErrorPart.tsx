import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";

import { Button } from "@/components/buttons/Button";
import { Icons } from "@/components/Icon";
import { IconPill } from "@/components/layout/IconPill";
import { useModal } from "@/components/overlays/Modal";
import { Paragraph } from "@/components/text/Paragraph";
import { Title } from "@/components/text/Title";
import { ScrapingItems, ScrapingSegment } from "@/hooks/useProviderScrape";
import { ErrorContainer, ErrorLayout } from "@/pages/layouts/ErrorLayout";
import { usePreferencesStore } from "@/stores/preferences";

import { ErrorCardInModal } from "../errors/ErrorCard";

export interface ScrapeErrorPartProps {
  data: {
    sources: Record<string, ScrapingSegment>;
    sourceOrder: ScrapingItems[];
  };
}

export function ScrapeErrorPart(props: ScrapeErrorPartProps) {
  const { t } = useTranslation();
  const modal = useModal("error");
  const location = useLocation();
  const febboxKey = usePreferencesStore((s) => s.febboxKey);

  const error = useMemo(() => {
    const data = props.data;
    const lines: string[] = [];
    lines.push(`=== SCRAPE FAILURE ===`);
    lines.push(`Time: ${new Date().toISOString()}`);
    lines.push(`URL: ${location.pathname}${location.search}`);
    lines.push(`Online: ${navigator.onLine}`);
    lines.push(`Has febbox key: ${!!febboxKey}`);
    lines.push(`User Agent: ${navigator.userAgent}`);
    lines.push("");
    lines.push(`=== SOURCE ORDER (${data.sourceOrder.length}) ===`);
    data.sourceOrder.forEach((s, i) => {
      const childCount = s.children?.length ?? 0;
      lines.push(
        `  ${i + 1}. ${s.id}${childCount > 0 ? ` (+${childCount} embeds)` : ""}`,
      );
    });
    lines.push("");
    lines.push(`=== SOURCE RESULTS (${Object.keys(data.sources).length}) ===`);
    Object.values(data.sources).forEach((v) => {
      lines.push(`--- ${v.id} ---`);
      lines.push(`Status: ${v.status}`);
      if (v.percentage !== undefined) lines.push(`Progress: ${v.percentage}%`);
      if (v.reason) lines.push(`Reason: ${v.reason}`);
      if (v.error) {
        if (v.error instanceof Error) {
          lines.push(`Error: ${v.error.name}: ${v.error.message}`);
          if (v.error.stack) lines.push(`Stack:\n${v.error.stack}`);
        } else if (typeof v.error === "object") {
          const name = (v.error as any).name ?? "unknown";
          const msg =
            (v.error as any).message ?? JSON.stringify(v.error, null, 2);
          lines.push(`Error: ${name}: ${msg}`);
          const stack = (v.error as any).stack;
          if (stack) lines.push(`Stack:\n${stack}`);
        } else {
          lines.push(`Error: ${String(v.error)}`);
        }
      }
      lines.push("");
    });
    return lines.join("\n");
  }, [props, location, febboxKey]);

  return (
    <ErrorLayout>
      <ErrorContainer>
        <IconPill icon={Icons.WAND}>
          {t("player.scraping.notFound.badge")}
        </IconPill>
        <Title>{t("player.scraping.notFound.title")}</Title>
        <Paragraph>{t("player.scraping.notFound.text")}</Paragraph>
        <div className="flex gap-3">
          <Button
            href="/"
            theme="secondary"
            padding="md:px-12 p-2.5"
            className="mt-6"
          >
            {t("player.scraping.notFound.homeButton")}
          </Button>
          <Button
            onClick={() => modal.show()}
            theme="purple"
            padding="md:px-12 p-2.5"
            className="mt-6"
          >
            {t("player.scraping.notFound.detailsButton")}
          </Button>
        </div>
        {/* <Button
          onClick={() => navigate("/discover")}
          theme="secondary"
          padding="md:px-12 p-2.5"
          className="mt-6"
        >
          {t("player.scraping.notFound.discoverButton")}
        </Button> */}
        {!febboxKey ? (
          <div className="flex flex-col max-w-md gap-3 items-center py-3">
            <Paragraph>{t("player.scraping.notFound.onboarding")}</Paragraph>
            <Button
              href="/settings#settings-connection"
              theme="purple"
              className="w-fit"
            >
              {t("player.scraping.notFound.onboardingButton")}
            </Button>
          </div>
        ) : null}
      </ErrorContainer>
      {error ? (
        <ErrorCardInModal
          id={modal.id}
          onClose={() => modal.hide()}
          error={error}
        />
      ) : null}
    </ErrorLayout>
  );
}

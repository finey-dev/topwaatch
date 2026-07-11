import { ScrapeMedia } from "@topwaatch/providers";
import React, { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { getCachedMetadata } from "@/backend/helpers/providerApi";
import { Button } from "@/components/buttons/Button";
import { Loading } from "@/components/layout/Loading";
import {
  useEmbedScraping,
  useSourceScraping,
} from "@/components/player/hooks/useSourceSelection";
import { Menu } from "@/components/player/internals/ContextMenu";
import { SelectableLink } from "@/components/player/internals/ContextMenu/Links";
import { usePreferencesStore } from "@/stores/preferences";
import {
  hasTopWaatchCinemaSetup,
  isTopWaatchPremiumSource,
  prioritizeCinemaSourceItems,
  TW_CINEMA_SETUP_PATH,
} from "@/utils/topwaatchSources";

// Embed option component
function EmbedOption(props: {
  embedId: string;
  url: string;
  sourceId: string;
  routerId: string;
}) {
  const { t } = useTranslation();
  const unknownEmbedName = t("player.menus.sources.unknownOption");

  const embedName = useMemo(() => {
    if (!props.embedId) return unknownEmbedName;
    const sourceMeta = getCachedMetadata().find((s) => s.id === props.embedId);
    return sourceMeta?.name ?? unknownEmbedName;
  }, [props.embedId, unknownEmbedName]);

  const { run, errored, loading, notFound } = useEmbedScraping(
    props.routerId,
    props.sourceId,
    props.url,
    props.embedId,
  );

  let rightSide;
  if (loading) {
    rightSide = undefined; // Let SelectableLink handle loading
  } else if (notFound) {
    rightSide = (
      <div className="flex items-center text-video-scraping-noresult">
        <div className="w-4 h-4 rounded-full border-2 border-current bg-current flex items-center justify-center">
          <div className="w-2 h-0.5 bg-background-main rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <SelectableLink
      loading={loading}
      error={errored && !notFound}
      onClick={run}
      rightSide={rightSide}
    >
      <span className="flex flex-col">
        <span>{embedName}</span>
      </span>
    </SelectableLink>
  );
}

// Embed selection view (when a source is selected)
function EmbedSelectionView(props: {
  sourceId: string;
  routerId: string;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const { run, notfound, loading, items, errored } = useSourceScraping(
    props.sourceId,
    props.routerId,
  );

  const sourceName = useMemo(() => {
    if (!props.sourceId) return "...";
    const sourceMeta = getCachedMetadata().find((s) => s.id === props.sourceId);
    return sourceMeta?.name ?? "...";
  }, [props.sourceId]);

  const lastSourceId = useRef<string | null>(null);
  useEffect(() => {
    if (lastSourceId.current === props.sourceId) return;
    lastSourceId.current = props.sourceId;
    if (!props.sourceId) return;
    run();
  }, [run, props.sourceId]);

  let content: ReactNode = null;
  if (loading)
    content = (
      <Menu.TextDisplay noIcon>
        <Loading />
      </Menu.TextDisplay>
    );
  else if (notfound)
    content = (
      <Menu.TextDisplay
        title={t("player.menus.sources.noStream.title") ?? undefined}
      >
        {t("player.menus.sources.noStream.text")}
      </Menu.TextDisplay>
    );
  else if (items?.length === 0)
    content = (
      <Menu.TextDisplay
        title={t("player.menus.sources.noEmbeds.title") ?? undefined}
      >
        {t("player.menus.sources.noEmbeds.text")}
      </Menu.TextDisplay>
    );
  else if (errored)
    content = (
      <Menu.TextDisplay
        title={t("player.menus.sources.failed.title") ?? undefined}
      >
        {t("player.menus.sources.failed.text")}
      </Menu.TextDisplay>
    );
  else if (items && props.sourceId)
    content = items.map((v) => (
      <EmbedOption
        key={`${v.embedId}-${v.url}`}
        embedId={v.embedId}
        url={v.url}
        routerId={props.routerId}
        sourceId={props.sourceId}
      />
    ));

  return (
    <>
      <Menu.BackLink onClick={props.onBack}>{sourceName}</Menu.BackLink>
      <Menu.Section>{content}</Menu.Section>
    </>
  );
}

// Main source selection view
export function SourceSelectPart(props: { media: ScrapeMedia }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [selectedSourceId, setSelectedSourceId] = React.useState<string | null>(
    null,
  );
  const [showCinemaSetupPrompt, setShowCinemaSetupPrompt] = useState(false);
  const routerId = "manualSourceSelect";
  const preferredSourceOrder = usePreferencesStore((s) => s.sourceOrder);
  const enableSourceOrder = usePreferencesStore((s) => s.enableSourceOrder);
  const lastSuccessfulSource = usePreferencesStore(
    (s) => s.lastSuccessfulSource,
  );
  const enableLastSuccessfulSource = usePreferencesStore(
    (s) => s.enableLastSuccessfulSource,
  );
  const febboxKey = usePreferencesStore((s) => s.febboxKey);
  const cinemaReady = hasTopWaatchCinemaSetup(febboxKey);

  const sources = useMemo(() => {
    const metaType = props.media.type;
    if (!metaType) return [];
    const allSources = getCachedMetadata()
      .filter((v) => v.type === "source")
      .filter((v) => v.mediaTypes?.includes(metaType));

    let ordered = allSources;

    if (!enableSourceOrder || preferredSourceOrder.length === 0) {
      if (enableLastSuccessfulSource && lastSuccessfulSource) {
        const lastSourceIndex = ordered.findIndex(
          (s) => s.id === lastSuccessfulSource,
        );
        if (lastSourceIndex !== -1) {
          const lastSource = ordered.splice(lastSourceIndex, 1)[0];
          ordered = [lastSource, ...ordered];
        }
      }
    } else {
      const orderedSources = [];
      const remainingSources = [...allSources];

      if (enableLastSuccessfulSource && lastSuccessfulSource) {
        const lastSourceIndex = remainingSources.findIndex(
          (s) => s.id === lastSuccessfulSource,
        );
        if (lastSourceIndex !== -1) {
          orderedSources.push(remainingSources[lastSourceIndex]);
          remainingSources.splice(lastSourceIndex, 1);
        }
      }

      for (const sourceId of preferredSourceOrder) {
        const sourceIndex = remainingSources.findIndex(
          (s) => s.id === sourceId,
        );
        if (sourceIndex !== -1) {
          orderedSources.push(remainingSources[sourceIndex]);
          remainingSources.splice(sourceIndex, 1);
        }
      }

      orderedSources.push(...remainingSources);
      ordered = orderedSources;
    }

    return prioritizeCinemaSourceItems(ordered, febboxKey);
  }, [
    props.media.type,
    preferredSourceOrder,
    enableSourceOrder,
    lastSuccessfulSource,
    enableLastSuccessfulSource,
    febboxKey,
  ]);

  if (showCinemaSetupPrompt) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <div className="w-full max-w-md h-[50vh] flex flex-col">
          <Menu.CardWithScrollable>
            <Menu.BackLink onClick={() => setShowCinemaSetupPrompt(false)}>
              {t("player.menus.sources.title")}
            </Menu.BackLink>
            <Menu.Section className="space-y-4 pb-4">
              <p className="text-white font-bold">
                {t("player.menus.sources.cinemaNotSetup.title")}
              </p>
              <p className="text-type-secondary text-sm">
                {t("player.menus.sources.cinemaNotSetup.text")}
              </p>
              <Button
                theme="purple"
                className="w-full"
                onClick={() => navigate(TW_CINEMA_SETUP_PATH)}
              >
                {t("player.menus.sources.cinemaNotSetup.cta")}
              </Button>
            </Menu.Section>
          </Menu.CardWithScrollable>
        </div>
      </div>
    );
  }

  if (selectedSourceId) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <div className="w-full max-w-md h-[50vh] flex flex-col">
          <Menu.CardWithScrollable>
            <EmbedSelectionView
              sourceId={selectedSourceId}
              routerId={routerId}
              onBack={() => setSelectedSourceId(null)}
            />
          </Menu.CardWithScrollable>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex items-center justify-center">
      <div className="w-full max-w-md h-[50vh] flex flex-col">
        <Menu.CardWithScrollable>
          <Menu.Title>{t("player.menus.sources.title")}</Menu.Title>
          <Menu.Section className="pb-4">
            {sources.map((v) => (
              <SelectableLink
                key={v.id}
                onClick={() => {
                  if (isTopWaatchPremiumSource(v.id) && !cinemaReady) {
                    setShowCinemaSetupPrompt(true);
                    return;
                  }
                  setSelectedSourceId(v.id);
                }}
              >
                {v.name}
                {isTopWaatchPremiumSource(v.id) && !cinemaReady ? (
                  <span className="ml-2 text-xs text-type-secondary">
                    {t("player.menus.sources.cinemaNotSetup.badge")}
                  </span>
                ) : null}
              </SelectableLink>
            ))}
          </Menu.Section>
        </Menu.CardWithScrollable>
      </div>
    </div>
  );
}

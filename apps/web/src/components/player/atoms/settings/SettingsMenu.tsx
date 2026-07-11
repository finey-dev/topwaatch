import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { getCachedMetadata } from "@/backend/helpers/providerApi";
import { Toggle } from "@/components/buttons/Toggle";
import { Icon, Icons } from "@/components/Icon";
import { useCaptions } from "@/components/player/hooks/useCaptions";
import { Menu } from "@/components/player/internals/ContextMenu";
import { useChromecastAvailable } from "@/hooks/useChromecastAvailable";
import { useOverlayRouter } from "@/hooks/useOverlayRouter";
import { usePlayerStore } from "@/stores/player/store";
import { qualityToString } from "@/stores/player/utils/qualities";
import { useSubtitleStore } from "@/stores/subtitles";
import { isSafari } from "@/utils/detectFeatures";
import { getPrettyLanguageNameFromLocale } from "@/utils/language";
import { getArtemisVariantMeta, getVariantMeta } from "@/lib/providerExtras";
import {
  isTopWaatchNova,
  isTopWaatchOrbit,
  TW_SOURCE_LABELS,
} from "@/utils/topwaatchSources";

export function SettingsMenu({ id }: { id: string }) {
  const { t } = useTranslation();
  const router = useOverlayRouter(id);
  const currentQuality = usePlayerStore((s) => s.currentQuality);
  const currentAudioTrack = usePlayerStore((s) => s.currentAudioTrack);
  const selectedCaptionLanguage = usePlayerStore(
    (s) => s.caption.selected?.language,
  );
  const subtitlesEnabled = useSubtitleStore((s) => s.enabled);
  const currentSourceId = usePlayerStore((s) => s.sourceId);
  const currentEmbedId = usePlayerStore(
    (s) => (s as any).embedId as string | null,
  );
  const sourceName = useMemo(() => {
    if (!currentSourceId) return "...";
    if (TW_SOURCE_LABELS[currentSourceId]) {
      return TW_SOURCE_LABELS[currentSourceId];
    }
    const source = getCachedMetadata().find(
      (src) => src.id === currentSourceId,
    );
    return source?.name ?? "...";
  }, [currentSourceId]);
  const embedName = useMemo(() => {
    if (!currentEmbedId) return undefined;
    const meta = getCachedMetadata().find((s) => s.id === currentEmbedId);
    return meta?.name;
  }, [currentEmbedId]);
  const { toggleLastUsed } = useCaptions();

  const selectedLanguagePretty = selectedCaptionLanguage
    ? (getPrettyLanguageNameFromLocale(selectedCaptionLanguage) ??
      t("player.menus.subtitles.unknownLanguage"))
    : undefined;

  const selectedAudioLanguagePretty = currentAudioTrack
    ? (getPrettyLanguageNameFromLocale(currentAudioTrack.language) ??
      currentAudioTrack.label ??
      t("player.menus.subtitles.unknownLanguage"))
    : undefined;

  // const source = usePlayerStore((s) => s.source);
  // Download menu currently shows a coming-soon notice for all sources.
  // const downloadable = source?.type === "file" || source?.type === "hls";

  const display = usePlayerStore((s) => s.display);
  const canAirplay = usePlayerStore((s) => s.interface.canAirplay);
  const chromecastAvailable = useChromecastAvailable();
  const isOrbit = isTopWaatchOrbit(currentSourceId);
  const castPlatformAvailable = !!chromecastAvailable || canAirplay || isSafari;

  const requestCast = () => {
    if (!isOrbit) return;
    const ctx = (window as any).cast?.framework?.CastContext?.getInstance?.();
    if (ctx?.requestSession) {
      ctx.requestSession().catch(() => {});
      return;
    }

    display?.startAirplay();
  };

  const variantMeta = isTopWaatchNova(currentSourceId)
    ? getVariantMeta()
    : isTopWaatchOrbit(currentSourceId)
      ? getArtemisVariantMeta()
      : null;
  const hasVariants = (variantMeta?.variants?.length ?? 0) > 1;

  return (
    <Menu.Card>
      <Menu.Section grid>
        <Menu.ChevronLink
          box
          onClick={() => router.navigate("/quality")}
          rightText={currentQuality ? qualityToString(currentQuality) : ""}
        >
          {t("player.menus.settings.qualityItem")}
          <span className="text-type-secondary text-sm">
            {currentQuality
              ? qualityToString(currentQuality)
              : t("player.menus.quality.auto")}
          </span>
        </Menu.ChevronLink>
        <Menu.ChevronLink
          box
          onClick={() => router.navigate("/source")}
          rightText={sourceName}
        >
          {t("player.menus.settings.sourceItem")}
          <span className="text-type-secondary text-sm">{sourceName}</span>
          {embedName && (
            <span className="text-type-secondary text-xs">{embedName}</span>
          )}
        </Menu.ChevronLink>
        <Menu.ChevronLink
          box
          onClick={() => router.navigate("/captions")}
          rightText={sourceName}
        >
          {t("player.menus.settings.subtitleItem")}
          <span className="text-type-secondary text-sm">
            {selectedLanguagePretty ?? t("player.menus.subtitles.offChoice")}
          </span>
        </Menu.ChevronLink>
        {currentAudioTrack ? (
          <Menu.ChevronLink
            box
            onClick={() => router.navigate("/audio")}
            rightText={selectedAudioLanguagePretty ?? undefined}
          >
            {t("player.menus.settings.audioItem")}
            <span className="text-type-secondary text-sm">
              {selectedAudioLanguagePretty}
            </span>
          </Menu.ChevronLink>
        ) : (
          <Menu.ChevronLink
            box
            onClick={() => router.navigate("/audio")}
            disabled
          >
            {t("player.menus.settings.audioItem")}
            <span className="text-type-secondary text-sm">
              {t("player.menus.audio.default")}
            </span>
          </Menu.ChevronLink>
        )}
      </Menu.Section>
      <Menu.Section>
        <Menu.Link
          clickable
          onClick={() => router.navigate("/download")}
          rightSide={<Icon className="text-xl" icon={Icons.DOWNLOAD} />}
        >
          {t("player.menus.settings.downloadItem")}
        </Menu.Link>
        {/* Previous download gating  restore with stream downloads
        <Menu.Link
          clickable
          onClick={() =>
            router.navigate(downloadable ? "/download" : "/download/unable")
          }
          rightSide={<Icon className="text-xl" icon={Icons.DOWNLOAD} />}
          className={downloadable ? "opacity-100" : "opacity-50"}
        >
          {t("player.menus.settings.downloadItem")}
        </Menu.Link>
        */}
        {castPlatformAvailable ? (
          <Menu.Link
            clickable={isOrbit}
            disabled={!isOrbit}
            onClick={requestCast}
            rightSide={<Icon className="text-xl" icon={Icons.CASTING} />}
          >
            <span className="flex flex-col">
              {t("player.menus.settings.castItem")}
              {!isOrbit && (
                <span className="text-type-secondary text-xs">
                  Available on TopWaatch Orbit
                </span>
              )}
            </span>
          </Menu.Link>
        ) : null}
      </Menu.Section>
      {hasVariants ? (
        <Menu.Section>
          <Menu.ChevronLink
            onClick={() => router.navigate("/variant")}
            rightText={`${variantMeta!.variants!.length}`}
          >
            {isTopWaatchOrbit(currentSourceId)
              ? "Orbit editions"
              : "Nova editions"}
          </Menu.ChevronLink>
        </Menu.Section>
      ) : null}
      <Menu.Section>
        <Menu.Link
          rightSide={
            <Toggle
              enabled={subtitlesEnabled}
              onClick={() => toggleLastUsed().catch(() => {})}
            />
          }
        >
          {t("player.menus.settings.enableSubtitles")}
        </Menu.Link>
        <Menu.ChevronLink onClick={() => router.navigate("/playback")}>
          {t("player.menus.settings.playbackItem")}
        </Menu.ChevronLink>
        <Menu.ChevronLink
          onClick={() => router.navigate("/playback/skip-segments")}
        >
          {t("player.skipTime.skipSegments")}
        </Menu.ChevronLink>
      </Menu.Section>
    </Menu.Card>
  );
}

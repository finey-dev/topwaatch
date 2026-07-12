import { useCallback, useState } from "react";

import { isOrgDirectFileUrl } from "@topwaatch/providers";

import {
  ArtemisFileVariant,
  FileVariant,
  febboxPlaybackHeaders,
  getArtemisVariantMeta,
  getVariantMeta,
  resolveArtemisVariant,
  resolveArtemisVariantAsync,
  resolveVariant,
} from "@/lib/providerExtras";
import {
  isTopWaatchNova,
  isTopWaatchOrbit,
} from "@/utils/topwaatchSources";

import { Toggle } from "@/components/buttons/Toggle";
import { Menu } from "@/components/player/internals/ContextMenu";
import { useOverlayRouter } from "@/hooks/useOverlayRouter";
import { usePlayerStore } from "@/stores/player/store";


type AnyVariant = FileVariant | ArtemisFileVariant;


type VariantMode = "orbit" | "nova" | null;

function formatVariantLabel(v: AnyVariant): string {
  const parts: string[] = [];
  if (v.quality) parts.push(v.quality);
  if (v.codec) parts.push(v.codec);
  if (v.tag === "bw") parts.push("B&W");
  else if (v.tag === "dv") parts.push("Dolby Vision");
  else if (v.tag === "hdr") parts.push("HDR");
  else if (v.tag === "remux") parts.push("REMUX");
  return parts.length > 0 ? parts.join(" · ") : v.name;
}

function getUserToken(): string | null {
  try {
    if (typeof window === "undefined") return null;
    const prefData = window.localStorage.getItem("__MW::preferences");
    if (!prefData) return null;
    const parsed = JSON.parse(prefData);
    return parsed?.state?.febboxKey || null;
  } catch {
    return null;
  }
}

export function VariantView({ id }: { id: string }) {
  const router = useOverlayRouter(id);
  const setSource = usePlayerStore((s) => s.setSource);
  const setCaption = usePlayerStore((s) => s.setCaption);
  const progressTime = usePlayerStore((s) => s.progress.time);
  const currentSourceId = usePlayerStore((s) => s.sourceId);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);


 
  let mode: VariantMode = null;
  let novaMeta: ReturnType<typeof getVariantMeta> = null;
  let orbitMeta: ReturnType<typeof getArtemisVariantMeta> = null;

  if (isTopWaatchOrbit(currentSourceId)) {
    orbitMeta = getArtemisVariantMeta();
    if (orbitMeta?.variants && orbitMeta.variants.length > 0) {
      mode = "orbit";
    }
  } else if (isTopWaatchNova(currentSourceId)) {
    novaMeta = getVariantMeta();
    if (
      novaMeta?.variants &&
      novaMeta.variants.length > 0 &&
      novaMeta.shareKey
    ) {
      mode = "nova";
    }
  }

  const variants: AnyVariant[] =
    mode === "orbit"
      ? (orbitMeta?.variants ?? [])
      : mode === "nova"
      ? (novaMeta?.variants ?? [])
      : [];

  const hasBW = variants.some((v) => v.tag === "bw");
  const hasColor = variants.some((v) => v.tag !== "bw");
  const [showBW, setShowBW] = useState(false);

  const displayed = hasBW && hasColor
    ? variants.filter((v) => (showBW ? v.tag === "bw" : v.tag !== "bw"))
    : variants;

  const switchToVariant = useCallback(
    async (variant: AnyVariant) => {
      setLoading(variant.fid);
      setError(null);
      try {
        if (mode === "orbit") {
          const res =
            resolveArtemisVariant(variant.fid) ??
            (await resolveArtemisVariantAsync(variant.fid));
          if (!res?.url) {
            setError(variant.fid);
            return;
          }
          setSource(
            { type: "hls", url: res.url, headers: res.headers },
            [],
            progressTime,
          );
          setCaption(null);
          router.close();
          return;
        }

        if (mode === "nova") {
          const token = getUserToken();
          const shareKey = novaMeta?.shareKey ?? "";
          if (!token || !shareKey) return;

          const result = await resolveVariant(variant.fid, shareKey, token);
          if (!result?.streams || Object.keys(result.streams).length === 0) {
            setError(variant.fid);
            return;
          }

          const captions = result.subtitles
            ? Object.entries(result.subtitles).map(([key, sub]) => ({
                id: sub.subtitle_link,
                language:
                  key.split("_")[0].charAt(0).toUpperCase() +
                  key.split("_")[0].slice(1),
                url: sub.subtitle_link,
                needsProxy: false,
                type: sub.subtitle_link.toLowerCase().endsWith(".vtt")
                  ? "vtt"
                  : "srt",
              }))
            : [];

          const parsed: Record<string, { url: string; type: "hls" | "mp4" }> =
            {};
          for (const [quality, entry] of Object.entries(result.streams)) {
            if (quality === "AUTO") {
              parsed.auto = { url: entry.url, type: entry.type };
            } else if (quality === "4K") {
              parsed["2160"] = { url: entry.url, type: entry.type };
            } else if (quality === "ORG") {
              if (entry.type === "hls" || isOrgDirectFileUrl(entry.url)) {
                parsed.unknown = { url: entry.url, type: entry.type };
              }
            } else {
              const num = parseInt(quality.replace("P", ""), 10);
              if (!Number.isNaN(num))
                parsed[String(num)] = { url: entry.url, type: entry.type };
            }
          }

          const hlsStream =
            parsed.auto ??
            parsed["2160"] ??
            parsed["1080"] ??
            parsed["720"] ??
            parsed["480"] ??
            parsed["360"] ??
            parsed.unknown;

          if (hlsStream?.type === "hls") {
            setSource(
              {
                type: "hls",
                url: hlsStream.url,
                headers: febboxPlaybackHeaders(token),
              },
              captions,
              progressTime,
            );
          } else {
            const qualities: Record<string, { type: "mp4"; url: string }> = {};
            if (parsed["2160"])
              qualities["4k"] = { type: "mp4", url: parsed["2160"].url };
            if (parsed["1080"])
              qualities["1080"] = { type: "mp4", url: parsed["1080"].url };
            if (parsed["720"])
              qualities["720"] = { type: "mp4", url: parsed["720"].url };
            if (parsed["480"])
              qualities["480"] = { type: "mp4", url: parsed["480"].url };
            if (parsed["360"])
              qualities["360"] = { type: "mp4", url: parsed["360"].url };
            if (parsed.unknown)
              qualities.unknown = { type: "mp4", url: parsed.unknown.url };
            setSource({ type: "file", qualities }, captions, progressTime);
          }
          setCaption(null);
          router.close();
        }
      } catch {
        setError(variant.fid);
      } finally {
        setLoading(null);
      }
    },
    [mode, novaMeta, setSource, setCaption, progressTime, router],
  );

  return (
    <>
      <Menu.BackLink onClick={() => router.navigate("/")}>
        {mode === "orbit" ? "Orbit editions" : "Nova editions"}
      </Menu.BackLink>

      {hasBW && hasColor ? (
        <Menu.Section>
          <Menu.Link
            rightSide={
              <Toggle enabled={showBW} onClick={() => setShowBW(!showBW)} />
            }
          >
            Black & White
          </Menu.Link>
        </Menu.Section>
      ) : null}

      <Menu.Section>
        {displayed.map((v) => (
          <Menu.SelectableLink
            key={v.fid}
            onClick={() => switchToVariant(v)}
            loading={loading === v.fid}
            error={error === v.fid ? "Failed" : undefined}
          >
            <div className="flex flex-col gap-0.5">
              <span>{formatVariantLabel(v)}</span>
              {v.size ? (
                <span className="text-type-secondary text-xs">{v.size}</span>
              ) : null}
            </div>
          </Menu.SelectableLink>
        ))}
      </Menu.Section>
    </>
  );
}

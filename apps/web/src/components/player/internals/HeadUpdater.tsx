import { useTranslation } from "react-i18next";

import { LinkPreview } from "@/components/LinkPreview";
import { usePlayerStore } from "@/stores/player/store";

export function HeadUpdater() {
  const { t } = useTranslation();
  const meta = usePlayerStore((s) => s.meta);

  if (!meta) return null;

  let documentTitle: string;
  if (
    meta.type === "show" &&
    meta.season?.number != null &&
    meta.episode?.number != null
  ) {
    documentTitle = t("global.pages.pagetitle", {
      title: `${meta.title}: S${meta.season.number}E${meta.episode.number}`,
    });
  } else {
    documentTitle = t("global.pages.pagetitle", { title: meta.title });
  }

  return (
    <LinkPreview
      title={documentTitle}
      description={meta.overview}
      image={meta.poster}
      imageAlt={`Watch ${meta.title} on TopWaatch`}
      type="video.other"
    />
  );
}

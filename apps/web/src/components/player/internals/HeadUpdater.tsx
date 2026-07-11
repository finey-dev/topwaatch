import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";

import { usePlayerStore } from "@/stores/player/store";

export function HeadUpdater() {
  const { t } = useTranslation();
  const meta = usePlayerStore((s) => s.meta);

  if (!meta) return null;

  let documentTitle: string;
  if (meta.type === "show" && meta.season?.number != null && meta.episode?.number != null) {
    documentTitle = t("global.pages.pagetitle", {
      title: `${meta.title}: Season ${meta.season.number} Episode ${meta.episode.number}`,
    });
  } else {
    documentTitle = t("global.pages.pagetitle", { title: meta.title });
  }

  return (
    <Helmet>
      <title>{documentTitle}</title>
    </Helmet>
  );
}

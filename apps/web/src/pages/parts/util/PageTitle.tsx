import { useTranslation } from "react-i18next";

import { LinkPreview } from "@/components/LinkPreview";

export interface PageTitleProps {
  /** i18n key for the page name, or pass `title` for a raw string */
  k?: string;
  title?: string;
  /** When true, formats as "TopWaatch - {page}" */
  subpage?: boolean;
  /** Plain description override */
  description?: string;
  /** i18n key for meta description */
  descriptionKey?: string;
  image?: string | null;
  noIndex?: boolean;
}

export function PageTitle(props: PageTitleProps) {
  const { t } = useTranslation();

  const pageName = props.title ?? (props.k ? t(props.k) : t("global.name"));
  const documentTitle = props.subpage
    ? t("global.pages.pagetitle", { title: pageName })
    : pageName;
  const description =
    props.description ??
    (props.descriptionKey ? t(props.descriptionKey) : undefined);

  return (
    <LinkPreview
      title={documentTitle}
      description={description}
      image={props.image}
      noIndex={props.noIndex}
    />
  );
}

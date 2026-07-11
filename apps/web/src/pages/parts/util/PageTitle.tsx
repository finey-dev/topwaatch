import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";

export interface PageTitleProps {
  /** i18n key for the page name, or pass `title` for a raw string */
  k?: string;
  title?: string;
  /** When true, formats as "TopWaatch - {page}" */
  subpage?: boolean;
}

export function PageTitle(props: PageTitleProps) {
  const { t } = useTranslation();

  const pageName = props.title ?? (props.k ? t(props.k) : t("global.name"));
  const documentTitle = props.subpage
    ? t("global.pages.pagetitle", { title: pageName })
    : pageName;

  return (
    <Helmet>
      <title>{documentTitle}</title>
    </Helmet>
  );
}

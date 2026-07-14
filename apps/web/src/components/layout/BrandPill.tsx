import classNames from "classnames";
import { useTranslation } from "react-i18next";

import { TOPWAATCH_LOGO_SRC } from "@/assets/brand";
import { useIsMobile } from "@/hooks/useIsMobile";

export function BrandPill(props: {
  clickable?: boolean;
  header?: boolean;
  backgroundClass?: string;
}) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  return (
    <div
      className={classNames(
        "flex items-center rounded-full px-3 py-1.5 backdrop-blur-lg",
        props.backgroundClass ?? "bg-pill-background bg-opacity-50",
        props.clickable
          ? "transition-[transform,background-color] hover:scale-105 hover:bg-pill-backgroundHover active:scale-95"
          : "",
      )}
    >
      <img
        src={TOPWAATCH_LOGO_SRC}
        alt={t("global.name")}
        className={classNames(
          "h-12 w-auto object-contain object-left",
          isMobile && props.header && "h-9 ssm:h-14",
        )}
        draggable={false}
      />
    </div>
  );
}

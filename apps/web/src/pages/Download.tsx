import classNames from "classnames";
import { useTranslation } from "react-i18next";

import { ThiccContainer } from "@/components/layout/ThinContainer";
import { Heading1, Heading2, Paragraph } from "@/components/utils/Text";
import { PageTitle } from "@/pages/parts/util/PageTitle";

import { SubPageLayout } from "./layouts/SubPageLayout";
import {
  DOWNLOAD_PLATFORMS,
  type DownloadPlatform,
  type DownloadVariant,
  type PlatformReleaseStatus,
} from "./download/platforms";

function StatusBadge(props: { status: PlatformReleaseStatus }) {
  const { t } = useTranslation();
  const isAvailable = props.status === "available";

  return (
    <span
      className={classNames(
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide sm:px-3 sm:py-1 sm:text-xs",
        isAvailable
          ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30"
          : "bg-amber-500/10 text-amber-200/90 ring-1 ring-amber-500/20",
      )}
    >
      {isAvailable
        ? t("download.status.available")
        : t("download.status.comingSoon")}
    </span>
  );
}

function VariantRow(props: {
  platformId: DownloadPlatform["id"];
  variant: DownloadVariant;
}) {
  const { t } = useTranslation();
  const label = t(
    `download.platforms.${props.platformId}.variants.${props.variant.id}.name`,
  );
  const isAvailable =
    props.variant.status === "available" && props.variant.downloadUrl;

  return (
    <div className="rounded-xl border border-white/5 bg-black/15 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-white">{label}</p>
        <StatusBadge status={props.variant.status} />
      </div>

      <div className="mt-3">
        {isAvailable ? (
          <a
            href={props.variant.downloadUrl}
            className="inline-flex h-9 w-full items-center justify-center rounded-lg bg-buttons-purple text-sm font-semibold text-white transition-transform duration-200 hover:scale-[1.01] hover:bg-buttons-purpleHover active:scale-[0.99]"
            download
            rel="noreferrer"
          >
            {t("download.status.download")}
          </a>
        ) : (
          <p className="text-xs text-type-text/75 sm:text-sm">
            {t("download.status.comingSoonDetail")}
          </p>
        )}
      </div>
    </div>
  );
}

function PlatformCard(props: { platform: DownloadPlatform }) {
  const { t } = useTranslation();
  const copy = t(`download.platforms.${props.platform.id}`, {
    returnObjects: true,
  }) as { name: string; description: string };

  return (
    <div className="flex flex-col rounded-2xl border border-onboarding-border bg-onboarding-card/40 p-6 transition-colors duration-300 hover:border-onboarding-border/80 hover:bg-onboarding-card/55">
      <div className="mb-5">
        <div className="mb-3 flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
            <img
              src={props.platform.iconSrc}
              alt=""
              className="h-full w-full object-contain"
              draggable={false}
            />
          </div>
          <Heading2 className="!m-0 !text-xl">{copy.name}</Heading2>
        </div>
        <Paragraph className="!my-0 w-full text-type-text">
          {copy.description}
        </Paragraph>
      </div>

      <div className="border-t border-white/5 pt-5">
        <div className="h-72 space-y-3 overflow-y-auto overscroll-contain pr-1">
          {props.platform.variants.map((variant) => (
            <VariantRow
              key={variant.id}
              platformId={props.platform.id}
              variant={variant}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function DownloadPage() {
  const { t } = useTranslation();

  return (
    <SubPageLayout>
      <PageTitle
        subpage
        k="global.pages.download"
        descriptionKey="download.metaDescription"
      />
      <ThiccContainer classNames="pb-24">
        <Heading1>{t("download.title")}</Heading1>
        <Paragraph className="max-w-3xl text-lg text-type-text">
          {t("download.description")}
        </Paragraph>
        <Paragraph className="max-w-3xl text-type-text/80">
          {t("download.independentReleases")}
        </Paragraph>

        <div className="mt-10 grid items-start gap-5 lg:grid-cols-3">
          {DOWNLOAD_PLATFORMS.map((platform) => (
            <PlatformCard key={platform.id} platform={platform} />
          ))}
        </div>
      </ThiccContainer>
    </SubPageLayout>
  );
}

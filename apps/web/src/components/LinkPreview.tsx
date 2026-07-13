import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";

import {
  DEFAULT_DESCRIPTION,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_WIDTH,
  SITE_NAME,
  defaultOgImageUrl,
  isDefaultOgImage,
  toAbsoluteUrl,
  truncateDescription,
} from "@/utils/siteMeta";

export type LinkPreviewProps = {
  title: string;
  description?: string;
  /** Absolute URL or site-relative path. Defaults to embed-preview.png */
  image?: string | null;
  imageWidth?: number;
  imageHeight?: number;
  imageAlt?: string;
  /** Canonical URL override */
  url?: string;
  type?: "website" | "video.other" | "video.movie" | "video.tv_show" | "video.episode";
  noIndex?: boolean;
};

export function LinkPreview({
  title,
  description,
  image,
  imageWidth,
  imageHeight,
  imageAlt,
  url,
  type = "website",
  noIndex = false,
}: LinkPreviewProps) {
  const location = useLocation();

  const metaDescription = truncateDescription(description ?? DEFAULT_DESCRIPTION);
  const canonicalUrl =
    url ?? toAbsoluteUrl(`${location.pathname}${location.search}${location.hash}`);
  const imageUrl = image ? toAbsoluteUrl(image) : defaultOgImageUrl();
  const alt = imageAlt ?? `${SITE_NAME} — ${title}`;
  const useDefaultDimensions = isDefaultOgImage(image);
  const width = useDefaultDimensions ? OG_IMAGE_WIDTH : imageWidth;
  const height = useDefaultDimensions ? OG_IMAGE_HEIGHT : imageHeight;

  return (
    <Helmet prioritizeSeoTags>
      <title>{title}</title>
      <meta name="description" content={metaDescription} />
      <link rel="canonical" href={canonicalUrl} />
      {noIndex ? <meta name="robots" content="noindex,nofollow" /> : null}

      {/* Open Graph — Facebook, Discord, Slack, LinkedIn, iMessage, WhatsApp, Telegram */}
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="en_US" />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={metaDescription} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:image:secure_url" content={imageUrl} />
      <meta property="og:image:type" content="image/png" />
      {width ? (
        <meta property="og:image:width" content={String(width)} />
      ) : null}
      {height ? (
        <meta property="og:image:height" content={String(height)} />
      ) : null}
      <meta property="og:image:alt" content={alt} />

      {/* X / Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={metaDescription} />
      <meta name="twitter:image" content={imageUrl} />
      <meta name="twitter:image:alt" content={alt} />

      {/* Google / schema.org hints */}
      <meta itemProp="name" content={title} />
      <meta itemProp="description" content={metaDescription} />
      <meta itemProp="image" content={imageUrl} />
    </Helmet>
  );
}

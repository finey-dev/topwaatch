import {
  DEFAULT_DESCRIPTION,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_WIDTH,
  SITE_NAME,
  defaultOgImageUrl,
  escapeHtml,
  truncateDescription,
} from "./constants";

export type OgDocumentInput = {
  origin: string;
  canonicalPath: string;
  title: string;
  description: string;
  imageUrl: string;
  imageType: "image/png" | "image/jpeg";
  imageAlt: string;
  ogType: "website" | "video.movie" | "video.tv_show" | "video.other";
  imageWidth?: number;
  imageHeight?: number;
};

export function renderOgHtml(input: OgDocumentInput): string {
  const canonicalUrl = `${input.origin}${input.canonicalPath.startsWith("/") ? input.canonicalPath : `/${input.canonicalPath}`}`;
  const description = escapeHtml(truncateDescription(input.description));
  const title = escapeHtml(input.title);
  const imageUrl = escapeHtml(input.imageUrl);
  const imageAlt = escapeHtml(input.imageAlt);
  const imageType = escapeHtml(input.imageType);
  const ogType = escapeHtml(input.ogType);
  const siteName = escapeHtml(SITE_NAME);
  const width = input.imageWidth ?? OG_IMAGE_WIDTH;
  const height = input.imageHeight ?? OG_IMAGE_HEIGHT;

  return `<!doctype html>
<html lang="en" dir="ltr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />

    <meta property="og:site_name" content="${siteName}" />
    <meta property="og:locale" content="en_US" />
    <meta property="og:type" content="${ogType}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta property="og:image" content="${imageUrl}" />
    <meta property="og:image:secure_url" content="${imageUrl}" />
    <meta property="og:image:type" content="${imageType}" />
    <meta property="og:image:width" content="${width}" />
    <meta property="og:image:height" content="${height}" />
    <meta property="og:image:alt" content="${imageAlt}" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${imageUrl}" />
    <meta name="twitter:image:alt" content="${imageAlt}" />

    <meta itemprop="name" content="${title}" />
    <meta itemprop="description" content="${description}" />
    <meta itemprop="image" content="${imageUrl}" />

    <meta http-equiv="refresh" content="0;url=${escapeHtml(canonicalUrl)}" />
  </head>
  <body>
    <p><a href="${escapeHtml(canonicalUrl)}">${siteName}</a></p>
    <script>location.replace(${JSON.stringify(canonicalUrl)});</script>
  </body>
</html>`;
}

export function buildDefaultOgDocument(origin: string, canonicalPath: string) {
  const imageUrl = defaultOgImageUrl(origin);
  return renderOgHtml({
    origin,
    canonicalPath,
    title: `${SITE_NAME} | Watch movies and shows with bookmarks, progress, and history that follow you`,
    description: DEFAULT_DESCRIPTION,
    imageUrl,
    imageType: "image/png",
    imageAlt: `${SITE_NAME} — Watch movies and shows with bookmarks, progress, and history that follow you`,
    ogType: "website",
    imageWidth: OG_IMAGE_WIDTH,
    imageHeight: OG_IMAGE_HEIGHT,
  });
}

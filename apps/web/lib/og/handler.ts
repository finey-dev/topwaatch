import {
  DEFAULT_DESCRIPTION,
  SITE_NAME,
  defaultOgImageUrl,
  resolveSiteOrigin,
  truncateDescription,
} from "./constants";
import { extractMediaSlug } from "./path";
import { renderOgHtml } from "./render-html";
import { decodeTMDBSlug, fetchOgMediaPayload } from "./tmdb";

export async function buildOgResponse(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const origin = resolveSiteOrigin(request);
  const canonicalPath = url.searchParams.get("path") ?? "/";

  const slug = extractMediaSlug(canonicalPath);
  if (!slug) {
    return htmlResponse(
      renderOgHtml({
        origin,
        canonicalPath,
        title: `${SITE_NAME} | Watch movies and shows with bookmarks, progress, and history that follow you`,
        description: DEFAULT_DESCRIPTION,
        imageUrl: defaultOgImageUrl(origin),
        imageType: "image/png",
        imageAlt: `${SITE_NAME} — Watch movies and shows with bookmarks, progress, and history that follow you`,
        ogType: "website",
      }),
    );
  }

  const decoded = decodeTMDBSlug(slug);
  if (!decoded) {
    return htmlResponse(
      renderOgHtml({
        origin,
        canonicalPath,
        title: `${SITE_NAME} - Details`,
        description: DEFAULT_DESCRIPTION,
        imageUrl: defaultOgImageUrl(origin),
        imageType: "image/png",
        imageAlt: SITE_NAME,
        ogType: "website",
      }),
    );
  }

  try {
    const payload = await fetchOgMediaPayload(decoded);
    if (!payload) throw new Error("TMDB payload missing");

    return htmlResponse(
      renderOgHtml({
        origin,
        canonicalPath,
        title: payload.pageTitle,
        description: payload.description,
        imageUrl: payload.image ?? defaultOgImageUrl(origin),
        imageType: payload.imageType,
        imageAlt: `Watch ${payload.title} on ${SITE_NAME}`,
        ogType: payload.ogType,
        imageWidth: payload.image ? 780 : undefined,
        imageHeight: payload.image ? 1170 : undefined,
      }),
    );
  } catch {
    return htmlResponse(
      renderOgHtml({
        origin,
        canonicalPath,
        title: `${SITE_NAME} - Details`,
        description: DEFAULT_DESCRIPTION,
        imageUrl: defaultOgImageUrl(origin),
        imageType: "image/png",
        imageAlt: SITE_NAME,
        ogType: "website",
      }),
    );
  }
}

function htmlResponse(html: string): Response {
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}

export { truncateDescription };

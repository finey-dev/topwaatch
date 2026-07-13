/** User-agents that fetch link previews without running app JavaScript. */
const CRAWLER_PATTERN =
  /bot|crawl|spider|slurp|mediapartners|facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|discordbot|telegrambot|whatsapp|applebot|embedly|preview|vkshare|pinterest/i;

export function isSocialCrawler(userAgent: string | null): boolean {
  if (!userAgent) return false;
  return CRAWLER_PATTERN.test(userAgent);
}

/** Extract the TMDB slug from /details/* or /media/* paths. */
export function extractMediaSlug(pathname: string): string | null {
  const details = pathname.match(/^\/details\/([^/?#]+)/);
  if (details?.[1]) return decodeURIComponent(details[1]);

  const media = pathname.match(/^\/media\/([^/?#]+)/);
  if (media?.[1]) return decodeURIComponent(media[1]);

  return null;
}

export function isOgEligiblePath(pathname: string): boolean {
  return pathname.startsWith("/details/") || pathname.startsWith("/media/");
}

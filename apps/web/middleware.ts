import { isOgEligiblePath, isSocialCrawler } from "./lib/og/path";

export const config = {
  matcher: ["/details/:path*", "/media/:path*"],
};

export default async function middleware(request: Request) {
  const url = new URL(request.url);
  if (!isOgEligiblePath(url.pathname)) return;

  const userAgent = request.headers.get("user-agent");
  if (!isSocialCrawler(userAgent)) return;

  const ogUrl = new URL("/api/og", url.origin);
  ogUrl.searchParams.set("path", url.pathname);

  return fetch(ogUrl.toString(), {
    headers: request.headers,
  });
}

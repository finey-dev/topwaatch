import { Analytics } from "@vercel/analytics/react";
import { useLocation } from "react-router-dom";

import { isDesktopShell } from "@/utils/isDesktopShell";

/**
 * Vercel Web Analytics with React Router route tracking.
 * Skipped in the desktop shell (bundled app, not served from Vercel).
 */
export function VercelAnalytics() {
  const { pathname, search } = useLocation();

  if (isDesktopShell()) return null;

  return (
    <Analytics route={pathname} path={`${pathname}${search}`} />
  );
}

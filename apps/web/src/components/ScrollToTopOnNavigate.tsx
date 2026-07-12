import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import { trackPageView } from "@/setup/ga";

/**
 * Reset window scroll to the top whenever the route pathname changes.
 * Prevents landing mid-page after navigating from a scrolled previous view.
 */
export function ScrollToTopOnNavigate() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
    trackPageView(pathname + search);
  }, [pathname, search]);

  return null;
}

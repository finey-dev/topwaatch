import ReactGA from "react-ga4";

import { GA_ID } from "@/setup/constants";

if (GA_ID) {
  ReactGA.initialize([
    {
      trackingId: GA_ID,
      gaOptions: {
        send_page_view: false,
      },
    },
  ]);
}

export function trackPageView(path: string) {
  if (!GA_ID) return;
  ReactGA.send({ hitType: "pageview", page: path });
}

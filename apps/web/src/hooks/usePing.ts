import { useEffect, useRef } from "react";

import { useBannerStore } from "@/stores/banner";

async function pingOnline(): Promise<boolean> {
  try {
    const response = await fetch("/ping.txt", { cache: "no-store" });
    return response.ok;
  } catch {
    return false;
  }
}

export function useOnlineListener() {
  const updateOnline = useBannerStore((s) => s.updateOnline);
  const ref = useRef<boolean>(true);

  useEffect(() => {
    let counter = 0;
    let abort: AbortController | null = null;

    const runCheck = async () => {
      if (!navigator.onLine) {
        updateOnline(false);
        ref.current = false;
        return;
      }

      if (abort) abort.abort();
      abort = new AbortController();
      try {
        const response = await fetch("/ping.txt", {
          cache: "no-store",
          signal: abort.signal,
        });
        if (!response.ok) throw new Error("offline");
        updateOnline(true);
        ref.current = true;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        updateOnline(false);
        ref.current = false;
      }
    };

    const handleOffline = () => {
      updateOnline(false);
      ref.current = false;
    };

    const handleOnline = () => {
      ref.current = true;
      counter = 0;
      void runCheck();
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    if (!navigator.onLine) {
      updateOnline(false);
      ref.current = false;
    } else {
      void runCheck();
    }

    const interval = setInterval(() => {
      counter += 1;
      if (ref.current && counter < 10) return;
      counter = 0;
      void runCheck();
    }, 5000);

    return () => {
      clearInterval(interval);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      if (abort) abort.abort();
    };
  }, [updateOnline]);
}

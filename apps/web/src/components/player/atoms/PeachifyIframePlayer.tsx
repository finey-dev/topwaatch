import { useEffect, useRef } from "react";

import { usePlayerStore } from "@/stores/player/store";
import { useProgressStore } from "@/stores/progress/index";

const PEACHIFY_ORIGIN = "https://peachify.pro";

/**
 * Peachify postMessage event shapes (subset we care about).
 */
interface PeachifyPlayerEvent {
  type: "PLAYER_EVENT";
  data: {
    event: "play" | "pause" | "seeked" | "ended" | "timeupdate";
    currentTime: number;
    duration: number;
    tmdbId?: number;
    mediaType?: "movie" | "tv";
    season?: number;
    episode?: number;
  };
}

interface PeachifyMediaData {
  type: "MEDIA_DATA";
  data: Record<string, unknown>;
}

type PeachifyMessage = PeachifyPlayerEvent | PeachifyMediaData;

function isPeachifyMessage(data: unknown): data is PeachifyMessage {
  return (
    typeof data === "object" &&
    data !== null &&
    "type" in data &&
    (data.type === "PLAYER_EVENT" || data.type === "MEDIA_DATA")
  );
}

/**
 * Full-screen iframe player for Peachify.
 * Renders when `source.type === "iframe"` and syncs playback progress back to
 * the TopWaatch progress store via the postMessage API.
 */
export function PeachifyIframePlayer() {
  const source = usePlayerStore((s) => s.source);
  const meta = usePlayerStore((s) => s.meta);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const updateItem = useProgressStore((s) => s.updateItem);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== PEACHIFY_ORIGIN) return;
      if (!isPeachifyMessage(event.data)) return;

      const msg = event.data;

      if (msg.type === "MEDIA_DATA") {
        // Store the full Peachify progress object in localStorage so it persists
        // across page refreshes and can be used for continue-watching.
        try {
          localStorage.setItem(
            "peachifyProgress",
            JSON.stringify(msg.data),
          );
        } catch {
          /* storage quota exceeded  ignore */
        }
        return;
      }

      if (msg.type === "PLAYER_EVENT") {
        const { event: playerEvent, currentTime, duration } = msg.data;

        // Mirror time/duration updates into the TopWaatch progress store so
        // other parts of the UI (e.g. continue-watching, autoSync) stay in sync.
        if (
          (playerEvent === "timeupdate" || playerEvent === "seeked") &&
          meta &&
          duration > 0
        ) {
          updateItem({
            meta,
            progress: { watched: currentTime, duration },
          });
        }
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [meta, updateItem]);

  if (!source || source.type !== "iframe") return null;

  return (
    <div className="absolute inset-0 z-10 bg-black">
      <iframe
        ref={iframeRef}
        src={source.embedUrl}
        className="w-full h-full border-0"
        allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
        allowFullScreen
        title="Peachify Player"
        referrerPolicy="origin"
        sandbox="allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-popups allow-presentation"
      />
    </div>
  );
}

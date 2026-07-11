import { useCallback, useEffect, useRef, useState } from "react";

import { useSkipTimeSource } from "@/components/player/hooks/useSkipTime";
import { useSkipTracking } from "@/components/player/hooks/useSkipTracking";
import { usePlayerStore } from "@/stores/player/store";

type SkipEvent = NonNullable<ReturnType<typeof useSkipTracking>["latestSkip"]>;

/**
 * Tracks completed skip sessions locally (backward-movement confidence).
 * External analytics reporting was removed with the legacy skips host.
 */
interface PendingSkip {
  skip: SkipEvent;
  originalConfidence: number;
  startTime: number;
  endTime: number;
  hasBackwardMovement: boolean;
  skipTimeSource: "introdb" | "theintrodb" | null;
  timer: ReturnType<typeof setTimeout>;
}

export function SkipTracker() {
  const { latestSkip } = useSkipTracking(20);
  const lastLoggedSkipRef = useRef<number>(0);
  const [pendingSkips, setPendingSkips] = useState<PendingSkip[]>([]);
  const lastPlayerTimeRef = useRef<number>(0);

  const meta = usePlayerStore((s) => s.meta);
  const progress = usePlayerStore((s) => s.progress);
  const skipTimeSource = useSkipTimeSource();

  const createPendingSkip = useCallback(
    (skip: SkipEvent) => {
      const timer = setTimeout(() => {
        setPendingSkips((prev) =>
          prev.filter((p) => p.skip.timestamp !== skip.timestamp),
        );
      }, 5000);

      return {
        skip,
        originalConfidence: skip.confidence,
        startTime: skip.startTime,
        endTime: skip.endTime,
        hasBackwardMovement: false,
        skipTimeSource,
        timer,
      };
    },
    [skipTimeSource],
  );

  useEffect(() => {
    if (!latestSkip || !meta) return;

    if (latestSkip.timestamp === lastLoggedSkipRef.current) return;

    const pendingSkip = createPendingSkip(latestSkip);
    setPendingSkips((prev) => [...prev, pendingSkip as PendingSkip]);

    lastLoggedSkipRef.current = latestSkip.timestamp;
  }, [latestSkip, meta, createPendingSkip]);

  useEffect(() => {
    const currentTime = progress.time;

    if (
      lastPlayerTimeRef.current > 0 &&
      currentTime < lastPlayerTimeRef.current
    ) {
      setPendingSkips((prev) =>
        prev.map((pending) => {
          const isWithinSkipRange =
            currentTime >= pending.startTime && currentTime <= pending.endTime;
          if (isWithinSkipRange && !pending.hasBackwardMovement) {
            return { ...pending, hasBackwardMovement: true };
          }
          return pending;
        }),
      );
    }

    lastPlayerTimeRef.current = currentTime;
  }, [progress.time]);

  useEffect(() => {
    return () => {
      pendingSkips.forEach((pending) => {
        clearTimeout(pending.timer);
      });
    };
  }, [pendingSkips]);

  return null;
}

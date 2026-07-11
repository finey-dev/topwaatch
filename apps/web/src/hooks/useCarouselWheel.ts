import { useEffect, useRef } from "react";

/**
 * Attach a non-passive wheel listener so horizontal trackpad gestures
 * can call preventDefault without the browser warning.
 */
export function useCarouselWheel(
  element: HTMLElement | null,
  enabled = true,
) {
  const isScrollingRef = useRef(false);
  const browser = typeof window !== "undefined" && !!window.chrome;

  useEffect(() => {
    if (!element || !enabled) return;

    const onWheel = (e: WheelEvent) => {
      if (isScrollingRef.current) return;
      isScrollingRef.current = true;

      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.stopPropagation();
        e.preventDefault();
      }

      if (browser) {
        window.setTimeout(() => {
          isScrollingRef.current = false;
        }, 345);
      } else {
        isScrollingRef.current = false;
      }
    };

    element.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      element.removeEventListener("wheel", onWheel);
    };
  }, [element, enabled, browser]);
}

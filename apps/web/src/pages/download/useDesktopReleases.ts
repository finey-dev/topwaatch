import { useQuery } from "@tanstack/react-query";

import {
  DESKTOP_RELEASE_TAG_PREFIX,
  DESKTOP_RELEASES_REPO,
  type DesktopManifest,
  fetchLatestDesktopManifest,
} from "./releaseSources";

const REFETCH_MS = 60_000;

export function useDesktopReleases() {
  return useQuery({
    queryKey: ["desktop-releases", DESKTOP_RELEASES_REPO, DESKTOP_RELEASE_TAG_PREFIX],
    queryFn: fetchLatestDesktopManifest,
    staleTime: REFETCH_MS,
    refetchInterval: REFETCH_MS,
    refetchOnWindowFocus: true,
  });
}

export { type DesktopManifest };

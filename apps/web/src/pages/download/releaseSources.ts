import {
  DOWNLOAD_PLATFORMS,
  type DownloadPlatform,
  type DownloadVariant,
  type LinuxVariantId,
  type PlatformReleaseStatus,
  type WindowsVariantId,
} from "./platforms";

export const DESKTOP_RELEASES_REPO =
  import.meta.env.VITE_DESKTOP_RELEASES_REPO ?? "finey-dev/topwaatch";

export const DESKTOP_RELEASE_TAG_PREFIX =
  import.meta.env.VITE_DESKTOP_RELEASE_TAG_PREFIX ?? "desktop-v";

export const DESKTOP_MANIFEST_URL =
  import.meta.env.VITE_DESKTOP_MANIFEST_URL ??
  `https://raw.githubusercontent.com/${DESKTOP_RELEASES_REPO}/master/apps/desktop/releases/desktop-manifest.json`;

export type DesktopVariantId = LinuxVariantId | WindowsVariantId;

export interface DesktopManifestVariant {
  available: boolean;
  url: string | null;
  fileName?: string;
}

export interface DesktopManifest {
  version: string;
  tag: string | null;
  publishedAt: string | null;
  repo?: string;
  variants: Record<DesktopVariantId, DesktopManifestVariant>;
}

const DESKTOP_VARIANT_IDS: DesktopVariantId[] = [
  "appImageX64",
  "appImageArm",
  "debianUbuntu",
  "fedora",
  "installer",
];

async function fetchJson<T>(url: string): Promise<T | null> {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) return null;
  return response.json() as Promise<T>;
}

function assetMatchesVariant(assetName: string, variantId: DesktopVariantId): boolean {
  switch (variantId) {
    case "appImageX64":
      return /\.AppImage$/i.test(assetName) && /(amd64|x86_64|x64)/i.test(assetName);
    case "appImageArm":
      return /\.AppImage$/i.test(assetName) && /(aarch64|arm64|arm)/i.test(assetName);
    case "debianUbuntu":
      return /\.deb$/i.test(assetName) && /(amd64|x86_64|x64)/i.test(assetName);
    case "fedora":
      return /\.rpm$/i.test(assetName) && /(x86_64|amd64|x64)/i.test(assetName);
    case "installer":
      return (
        /-setup\.exe$/i.test(assetName) ||
        (/\.exe$/i.test(assetName) && /(x64|x86_64|amd64)/i.test(assetName)) ||
        /\.msi$/i.test(assetName)
      );
    default:
      return false;
  }
}

function manifestFromGithubRelease(release: GitHubRelease): DesktopManifest {
  const variants = Object.fromEntries(
    DESKTOP_VARIANT_IDS.map((id) => [id, { available: false, url: null }]),
  ) as DesktopManifest["variants"];

  for (const asset of release.assets ?? []) {
    for (const variantId of DESKTOP_VARIANT_IDS) {
      if (!assetMatchesVariant(asset.name, variantId)) continue;
      variants[variantId] = {
        available: true,
        url: asset.browser_download_url,
        fileName: asset.name,
      };
    }
  }

  return {
    version: release.tag_name.replace(DESKTOP_RELEASE_TAG_PREFIX, ""),
    tag: release.tag_name,
    publishedAt: release.published_at,
    repo: DESKTOP_RELEASES_REPO,
    variants,
  };
}

interface GitHubRelease {
  tag_name: string;
  published_at: string;
  assets?: Array<{ name: string; browser_download_url: string }>;
}

async function fetchLatestDesktopReleaseFromGithub(): Promise<DesktopManifest | null> {
  const response = await fetch(
    `https://api.github.com/repos/${DESKTOP_RELEASES_REPO}/releases?per_page=30`,
    {
      headers: {
        Accept: "application/vnd.github+json",
      },
    },
  );

  if (!response.ok) return null;

  const releases = (await response.json()) as GitHubRelease[];
  const latestDesktopRelease = releases.find((release) =>
    release.tag_name?.startsWith(DESKTOP_RELEASE_TAG_PREFIX),
  );

  if (!latestDesktopRelease) return null;

  const manifestAsset = latestDesktopRelease.assets?.find(
    (asset) => asset.name === "desktop-manifest.json",
  );

  if (manifestAsset) {
    return fetchJson<DesktopManifest>(manifestAsset.browser_download_url);
  }

  return manifestFromGithubRelease(latestDesktopRelease);
}

export async function fetchLatestDesktopManifest(): Promise<DesktopManifest | null> {
  const manifestFromRepo = await fetchJson<DesktopManifest>(DESKTOP_MANIFEST_URL);
  if (
    manifestFromRepo?.variants &&
    manifestFromRepo.version &&
    manifestFromRepo.version !== "0.0.0"
  ) {
    return manifestFromRepo;
  }

  return fetchLatestDesktopReleaseFromGithub();
}

function resolveVariant(
  variantId: DesktopVariantId,
  manifest: DesktopManifest | null,
): DownloadVariant {
  const remote = manifest?.variants?.[variantId];
  if (remote?.available && remote.url) {
    return {
      id: variantId,
      status: "available" as PlatformReleaseStatus,
      downloadUrl: remote.url,
    };
  }

  return {
    id: variantId,
    status: "coming_soon" as PlatformReleaseStatus,
  };
}

export function mergeDesktopPlatforms(manifest: DesktopManifest | null): DownloadPlatform[] {
  return DOWNLOAD_PLATFORMS.filter(
    (platform) => platform.id === "linux" || platform.id === "windows",
  ).map((platform) => ({
    ...platform,
    variants: platform.variants.map((variant) =>
      resolveVariant(variant.id as DesktopVariantId, manifest),
    ),
  }));
}

export function mergeAllPlatforms(
  manifest: DesktopManifest | null,
): DownloadPlatform[] {
  const desktopById = new Map(
    mergeDesktopPlatforms(manifest).map((platform) => [platform.id, platform]),
  );

  return DOWNLOAD_PLATFORMS.map((platform) => {
    if (platform.id === "android") return platform;
    return desktopById.get(platform.id) ?? platform;
  });
}

export function getDesktopVersionLabel(manifest: DesktopManifest | null): string | null {
  if (!manifest?.version || manifest.version === "0.0.0") return null;
  return manifest.version;
}

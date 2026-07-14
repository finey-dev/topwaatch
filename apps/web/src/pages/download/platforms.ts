export type PlatformReleaseStatus = "coming_soon" | "available";

export type PlatformId = "android" | "linux" | "windows";

export type AndroidVariantId = "devices" | "tv";
export type LinuxVariantId = "appImageX64" | "appImageArm" | "debianUbuntu" | "fedora";
export type WindowsVariantId = "installerExe" | "installerMsi";

export type PlatformVariantId =
  | AndroidVariantId
  | LinuxVariantId
  | WindowsVariantId;

export interface DownloadVariant {
  id: PlatformVariantId;
  status: PlatformReleaseStatus;
  downloadUrl?: string;
}

export interface DownloadPlatform {
  id: PlatformId;
  iconSrc: string;
  variants: DownloadVariant[];
}

export const DOWNLOAD_PLATFORMS: DownloadPlatform[] = [
  {
    id: "android",
    iconSrc: "/platforms/android.svg",
    variants: [
      { id: "devices", status: "coming_soon" },
      { id: "tv", status: "coming_soon" },
    ],
  },
  {
    id: "linux",
    iconSrc: "/platforms/linux.svg",
    variants: [
      { id: "appImageX64", status: "coming_soon" },
      { id: "appImageArm", status: "coming_soon" },
      { id: "debianUbuntu", status: "coming_soon" },
      { id: "fedora", status: "coming_soon" },
    ],
  },
  {
    id: "windows",
    iconSrc: "/platforms/windows.svg",
    variants: [
      { id: "installerExe", status: "coming_soon" },
      { id: "installerMsi", status: "coming_soon" },
    ],
  },
];

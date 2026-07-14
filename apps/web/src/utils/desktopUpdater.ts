import { isDesktopShell } from "@/utils/isDesktopShell";

export type DesktopUpdateStatus =
  | "idle"
  | "checking"
  | "downloading"
  | "installing"
  | "restarting"
  | "up-to-date"
  | "error";

export type DesktopUpdateProgress = {
  status: DesktopUpdateStatus;
  version?: string;
  progress?: number;
  error?: string;
};

export async function getDesktopAppVersion(): Promise<string | null> {
  if (!isDesktopShell()) return null;
  const { getVersion } = await import("@tauri-apps/api/app");
  return getVersion();
}

export async function checkAndInstallDesktopUpdate(
  onProgress: (progress: DesktopUpdateProgress) => void,
): Promise<void> {
  if (!isDesktopShell()) return;

  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    const { relaunch } = await import("@tauri-apps/plugin-process");

    onProgress({ status: "checking" });

    const update = await check();
    if (!update) {
      onProgress({ status: "up-to-date" });
      return;
    }

    onProgress({
      status: "downloading",
      version: update.version,
      progress: 0,
    });

    let downloaded = 0;
    let contentLength = 0;

    await update.downloadAndInstall((event) => {
      switch (event.event) {
        case "Started":
          contentLength = event.data.contentLength ?? 0;
          onProgress({
            status: "downloading",
            version: update.version,
            progress: 0,
          });
          break;
        case "Progress":
          downloaded += event.data.chunkLength;
          if (contentLength > 0) {
            onProgress({
              status: "downloading",
              version: update.version,
              progress: Math.round((downloaded / contentLength) * 100),
            });
          }
          break;
        case "Finished":
          onProgress({ status: "installing", version: update.version });
          break;
        default:
          break;
      }
    });

    onProgress({ status: "restarting", version: update.version });
    await relaunch();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown update error";
    onProgress({ status: "error", error: message });
    throw error;
  }
}

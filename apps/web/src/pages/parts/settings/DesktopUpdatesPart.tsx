import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/buttons/Button";
import { useIsDesktopApp } from "@/hooks/useIsDesktopApp";
import {
  checkAndInstallDesktopUpdate,
  DesktopUpdateProgress,
  getDesktopAppVersion,
} from "@/utils/desktopUpdater";

export function DesktopUpdatesPart() {
  const { t } = useTranslation();
  const isDesktopApp = useIsDesktopApp();
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const [updateState, setUpdateState] = useState<DesktopUpdateProgress>({
    status: "idle",
  });
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!isDesktopApp) return;
    getDesktopAppVersion()
      .then((version) => setAppVersion(version))
      .catch(() => setAppVersion(null));
  }, [isDesktopApp]);

  const handleCheckForUpdates = useCallback(async () => {
    setIsBusy(true);
    setUpdateState({ status: "checking" });
    try {
      await checkAndInstallDesktopUpdate(setUpdateState);
    } catch {
      // Error state is set by the updater utility.
    } finally {
      setIsBusy(false);
    }
  }, []);

  if (!isDesktopApp) return null;

  const statusMessage = (() => {
    switch (updateState.status) {
      case "checking":
        return t("settings.sidebar.info.updates.checking");
      case "downloading":
        return updateState.progress != null
          ? t("settings.sidebar.info.updates.downloading", {
              progress: updateState.progress,
            })
          : t("settings.sidebar.info.updates.downloadingUnknown");
      case "installing":
        return t("settings.sidebar.info.updates.installing");
      case "restarting":
        return t("settings.sidebar.info.updates.restarting");
      case "up-to-date":
        return t("settings.sidebar.info.updates.upToDate");
      case "error":
        return (
          updateState.error ??
          t("settings.sidebar.info.updates.failed")
        );
      default:
        return null;
    }
  })();

  return (
    <div className="col-span-2 space-y-2 pt-1">
      {appVersion ? (
        <p className="text-type-dimmed text-xs">
          {t("settings.sidebar.info.desktopVersion", { version: appVersion })}
        </p>
      ) : null}
      <Button
        className="w-full"
        theme="secondary"
        disabled={isBusy}
        onClick={handleCheckForUpdates}
      >
        {t("settings.sidebar.info.updates.checkButton")}
      </Button>
      {statusMessage ? (
        <p
          className={
            updateState.status === "error"
              ? "text-type-danger text-xs"
              : "text-type-secondary text-xs"
          }
        >
          {statusMessage}
        </p>
      ) : null}
    </div>
  );
}

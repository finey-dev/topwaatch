import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/buttons/Button";
import { Icon, Icons } from "@/components/Icon";
import { useBannerStore } from "@/stores/banner";

export function OfflineHomePart(props: { showLoggedInHint?: boolean }) {
  const { t } = useTranslation();
  const updateOnline = useBannerStore((s) => s.updateOnline);
  const [checking, setChecking] = useState(false);

  const retry = useCallback(async () => {
    setChecking(true);
    try {
      const response = await fetch("/ping.txt", { cache: "no-store" });
      if (!response.ok) throw new Error("offline");
      updateOnline(true);
    } catch {
      updateOnline(false);
    } finally {
      setChecking(false);
    }
  }, [updateOnline]);

  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-largeCard-background">
        <Icon icon={Icons.UNPLUG} className="text-3xl text-type-dimmed" />
      </div>
      <h2 className="text-xl font-semibold text-white">
        {t("home.offline.title")}
      </h2>
      <p className="mt-3 max-w-md text-type-dimmed">
        {t("home.offline.description")}
      </p>
      {props.showLoggedInHint ? (
        <p className="mt-2 max-w-md text-sm text-type-dimmed">
          {t("home.offline.loggedInHint")}
        </p>
      ) : null}
      <Button
        className="mt-8"
        theme="purple"
        onClick={retry}
        disabled={checking}
      >
        {checking ? t("home.offline.checking") : t("home.offline.retry")}
      </Button>
    </div>
  );
}

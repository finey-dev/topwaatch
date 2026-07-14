import { useTranslation } from "react-i18next";

import { SidebarSection } from "@/components/layout/Sidebar";
import { DesktopUpdatesPart } from "@/pages/parts/settings/DesktopUpdatesPart";
import { conf } from "@/setup/config";

export function AppInfoPart() {
  const { t } = useTranslation();
  const hostname = location.hostname;

  return (
    <SidebarSection
      className="text-sm"
      title={t("settings.sidebar.info.title")}
    >
      <div className="px-3 py-3.5 rounded-lg bg-largeCard-background bg-opacity-50 grid grid-cols-2 gap-4">
        <div className="col-span-2 space-y-1">
          <p className="text-type-dimmed font-medium">
            {t("settings.sidebar.info.appName")}
          </p>
          <p className="text-white">{t("global.name")}</p>
        </div>

        <div className="col-span-2 space-y-1">
          <p className="text-type-dimmed font-medium">
            {t("settings.sidebar.info.hostname")}
          </p>
          <p className="text-white">{hostname}</p>
        </div>

        <div className="col-span-2 space-y-1">
          <p className="text-type-dimmed font-medium">
            {t("settings.sidebar.info.appVersion")}
          </p>
          <p className="text-type-dimmed px-2 py-1 rounded bg-settings-sidebar-badge inline-block">
            {conf().APP_VERSION}
          </p>
        </div>

        <DesktopUpdatesPart />
      </div>
    </SidebarSection>
  );
}

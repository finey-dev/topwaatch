import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { IconPatch } from "@/components/buttons/IconPatch";
import { Icons } from "@/components/Icon";
import { useModal } from "@/components/overlays/Modal";
import { OverlayPortal } from "@/components/overlays/OverlayDisplay";
import { Flare } from "@/components/utils/Flare";
import { conf } from "@/setup/config";
import { useAuthStore } from "@/stores/auth";
import { usePreferencesStore } from "@/stores/preferences";
import {
  hasTopWaatchCinemaSetup,
  TW_CINEMA_SETUP_PATH,
} from "@/utils/topwaatchSources";

const MODAL_ID = "febbox-recommendation";

/**
 * Prompt on the home page for logged-in users without Febbox / TopWaatch Cinema.
 * Shown again on each visit to the root page until they connect Febbox.
 */
export function FebboxRecommendationModal() {
  const { t } = useTranslation();
  const modal = useModal(MODAL_ID);
  const navigate = useNavigate();
  const account = useAuthStore((s) => s.account);
  const febboxKey = usePreferencesStore((s) => s.febboxKey);
  const [dismissedThisVisit, setDismissedThisVisit] = useState(false);

  const needsSetup =
    Boolean(account) &&
    conf().ALLOW_FEBBOX_KEY &&
    !hasTopWaatchCinemaSetup(febboxKey);

  const shouldShow = needsSetup && !dismissedThisVisit;

  useEffect(() => {
    if (shouldShow) modal.show();
    else modal.hide();
  }, [shouldShow, modal]);

  const dismiss = useCallback(() => {
    setDismissedThisVisit(true);
    modal.hide();
  }, [modal]);

  const goToSetup = useCallback(() => {
    setDismissedThisVisit(true);
    modal.hide();
    navigate(TW_CINEMA_SETUP_PATH);
  }, [modal, navigate]);

  if (!shouldShow) return null;

  return (
    <OverlayPortal darken close={dismiss} show={modal.isShown}>
      <div className="flex absolute inset-0 items-center justify-center p-4 overflow-hidden">
        <div className="overflow-y-auto max-h-[85vh] pointer-events-auto">
          <Flare.Base className="group rounded-3xl bg-background-main transition-colors duration-300 focus:relative focus:z-10 w-full max-w-lg p-6 bg-mediaCard-hoverBackground bg-opacity-60 backdrop-filter backdrop-blur-lg shadow-lg">
            <div className="overflow-y-auto overflow-x-hidden max-h-[85vh]">
              <Flare.Light
                flareSize={300}
                cssColorVar="--colors-mediaCard-hoverAccent"
                backgroundClass="bg-modal-background duration-100"
                className="rounded-3xl bg-background-main group-hover:opacity-100"
              />
              <Flare.Child className="pointer-events-auto relative">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-white">
                    {t("home.febboxRecommendation.title")}
                  </h2>
                  <button
                    type="button"
                    className="text-type-secondary hover:text-white transition-transform hover:scale-95"
                    onClick={dismiss}
                  >
                    <IconPatch icon={Icons.X} />
                  </button>
                </div>
                <div className="space-y-4 text-base text-type-secondary">
                  <p>{t("home.febboxRecommendation.body")}</p>
                  <p className="text-sm">{t("home.febboxRecommendation.note")}</p>
                  <div className="flex flex-col gap-2 pt-1">
                    <button
                      type="button"
                      onClick={goToSetup}
                      className="block w-full text-center bg-purple-500/90 hover:bg-purple-500 text-white py-2.5 px-4 rounded-xl transition-colors font-semibold"
                    >
                      {t("home.febboxRecommendation.setupCta")}
                    </button>
                    <button
                      type="button"
                      onClick={dismiss}
                      className="block w-full text-center bg-video-context-light/10 hover:bg-video-context-light/20 text-white py-2 px-4 rounded-xl transition-colors text-sm"
                    >
                      {t("home.febboxRecommendation.dismiss")}
                    </button>
                  </div>
                </div>
              </Flare.Child>
            </div>
          </Flare.Base>
        </div>
      </div>
    </OverlayPortal>
  );
}

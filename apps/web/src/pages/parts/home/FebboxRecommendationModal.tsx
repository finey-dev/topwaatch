import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { IconPatch } from "@/components/buttons/IconPatch";
import { Icons } from "@/components/Icon";
import { useModal } from "@/components/overlays/Modal";
import { OverlayPortal } from "@/components/overlays/OverlayDisplay";
import { Flare } from "@/components/utils/Flare";
import { conf } from "@/setup/config";
import { useAuthStore } from "@/stores/auth";
import { usePreferencesStore } from "@/stores/preferences";

const MODAL_ID = "febbox-recommendation";
const STORAGE_KEY = "topwaatch::febbox-recommendation-dismissed";

function hasFebboxKey(key: string | null | undefined): boolean {
  return Boolean(key && key.trim().length > 0);
}

/**
 * One-time prompt for logged-in users who have not connected a Febbox account.
 */
export function FebboxRecommendationModal() {
  const modal = useModal(MODAL_ID);
  const navigate = useNavigate();
  const account = useAuthStore((s) => s.account);
  const febboxKey = usePreferencesStore((s) => s.febboxKey);
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    if (!conf().ALLOW_FEBBOX_KEY) return;
    if (!account) return;
    if (hasFebboxKey(febboxKey)) return;

    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") return;
    } catch {
      // ignore
    }

    setShouldShow(true);
  }, [account, febboxKey]);

  useEffect(() => {
    if (shouldShow) modal.show();
  }, [shouldShow, modal]);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
    setShouldShow(false);
    modal.hide();
  }, [modal]);

  const goToSetup = useCallback(() => {
    dismiss();
    navigate("/settings#settings-connection");
  }, [dismiss, navigate]);

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
                    Connect TopWaatch Cinema
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
                  <p>
                    For the best streaming experience, we recommend connecting a
                    free{" "}
                    <span className="text-white">Febbox</span> account. This
                    unlocks TopWaatch Nova and Orbit  premium 4K sources with
                    fast load times.
                  </p>
                  <p className="text-sm">
                    Don&apos;t have a Febbox account yet? We&apos;ll walk you
                    through creating one and linking it in Settings using the
                    manual setup guide.
                  </p>
                  <div className="flex flex-col gap-2 pt-1">
                    <button
                      type="button"
                      onClick={goToSetup}
                      className="block w-full text-center bg-purple-500/90 hover:bg-purple-500 text-white py-2.5 px-4 rounded-xl transition-colors font-semibold"
                    >
                      Set up in Settings
                    </button>
                    <button
                      type="button"
                      onClick={dismiss}
                      className="block w-full text-center bg-video-context-light/10 hover:bg-video-context-light/20 text-white py-2 px-4 rounded-xl transition-colors text-sm"
                    >
                      Maybe later
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

import { useCallback, useEffect, useState } from "react";
import { IconPatch } from "@/components/buttons/IconPatch";
import { Icons } from "@/components/Icon";
import { useModal } from "@/components/overlays/Modal";
import { OverlayPortal } from "@/components/overlays/OverlayDisplay";
import { Flare } from "@/components/utils/Flare";

const MODAL_ID = "rebrand-notice";

const REBRAND_VERSION = "topwaatch-2026-07-10";
const STORAGE_KEY = "topwaatch::rebrand-seen";

/**
 * One-time rebrand / announcement modal.
 * Currently unused on HomePage  keep for a future TopWaatch announcement.
 */
export function RevivalAnnouncementModal() {
  const modal = useModal(MODAL_ID);
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) !== REBRAND_VERSION) {
        setShouldShow(true);
      }
    } catch {
      setShouldShow(true);
    }
  }, []);

  useEffect(() => {
    if (shouldShow) modal.show();
  }, [shouldShow, modal]);

  const handleClose = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, REBRAND_VERSION);
    } catch {
      // ignore
    }
    setShouldShow(false);
    modal.hide();
  }, [modal]);

  if (!shouldShow) return null;

  return (
    <OverlayPortal darken close={handleClose} show={modal.isShown}>
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
                    Welcome to TopWaatch
                  </h2>
                  <button
                    type="button"
                    className="text-type-secondary hover:text-white transition-transform hover:scale-95"
                    onClick={handleClose}
                  >
                    <IconPatch icon={Icons.X} />
                  </button>
                </div>
                <div className="space-y-4 text-base text-type-secondary">
                  <p className="text-white font-bold border-l-2 border-blue-400 pl-3">
                    TopWaatch is here
                  </p>
                  <p>
                    Watch movies and TV with cloud sync, no browser extension
                    required. Update your bookmarks if you&apos;re coming from
                    an older site  your account data stays with you when you
                    sign in.
                  </p>
                  <p className="text-sm text-type-secondary">
                    Join our Discord for support, updates, and to be part of the
                    community.
                  </p>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="block w-full text-center bg-video-context-light/10 hover:bg-video-context-light/20 text-white py-2 px-4 rounded-xl transition-colors"
                  >
                    Got it, do not show this again
                  </button>
                </div>
              </Flare.Child>
            </div>
          </Flare.Base>
        </div>
      </div>
    </OverlayPortal>
  );
}

import classNames from "classnames";
import { useCallback, useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";

import { IconPatch } from "@/components/buttons/IconPatch";
import { Icons } from "@/components/Icon";
import { Flare } from "@/components/utils/Flare";
import { useOverlayStack } from "@/stores/interface/overlayStack";

import { DetailsContent } from "./DetailsContent";
import { DetailsSkeleton } from "./DetailsSkeleton";
import { OverlayPortal } from "../../../OverlayDisplay";
import { DetailsModalProps } from "../../types";
import { fetchDetailsContent } from "../../utils/fetchDetailsContent";

export function DetailsModal({
  id,
  data: _data,
  minimal: _minimal,
}: DetailsModalProps) {
  // Player details modal should always be minimal (hide episode carousel and movie watch button)
  const minimal = _minimal || id === "player-details";
  const { hideModal, isModalVisible, modalStack, getModalData } =
    useOverlayStack();
  const [detailsData, setDetailsData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const modalIndex = modalStack.indexOf(id);
  const zIndex = modalIndex >= 0 ? 1000 + modalIndex : 999;

  const hide = useCallback(() => hideModal(id), [hideModal, id]);
  const isShown = isModalVisible(id);
  const modalData = getModalData(id);

  // Only show modal if there's data to display
  const shouldShow = Boolean(isShown && (modalData?.id || _data?.id));

  useEffect(() => {
    const fetchDetails = async () => {
      // Use data from overlayStack or fallback to props for backward compatibility
      const data = modalData || _data;
      if (!data?.id || !data?.type) return;

      setIsLoading(true);
      try {
        const details = await fetchDetailsContent(data.id, data.type);
        setDetailsData(details);
      } catch (err) {
        console.error("Failed to fetch media details:", err);
      } finally {
        setIsLoading(false);
      }
    };

    if (shouldShow) {
      fetchDetails();
    }
  }, [shouldShow, modalData, _data]);

  useEffect(() => {
    if (isShown && !modalData?.id && !_data?.id && !isLoading) {
      hide();
    }
  }, [isShown, modalData, _data, isLoading, hide]);

  return (
    <OverlayPortal
      darken
      close={hide}
      show={shouldShow}
      durationClass="duration-500"
      zIndex={zIndex}
    >
      <Helmet>
        <html data-no-scroll />
      </Helmet>
      <div className="flex absolute inset-0 items-center justify-center pt-safe">
        <Flare.Base
          className={classNames(
            "group -m-[0.705em] rounded-3xl bg-background-main",
            "max-h-[900px] max-w-[1200px]",
            "bg-mediaCard-hoverBackground/60 backdrop-filter backdrop-blur-lg shadow-lg overflow-hidden",
            "h-[97%] w-[95%]",
            "relative",
          )}
        >
          <div className="transition-transform duration-300 h-full relative">
            <Flare.Light
              flareSize={300}
              cssColorVar="--colors-mediaCard-hoverAccent"
              backgroundClass="bg-modal-background duration-100"
              className="rounded-3xl bg-background-main group-hover:opacity-100 transition-opacity duration-300"
            />
            <div className="absolute right-4 top-4 z-50 pointer-events-auto">
              <button
                type="button"
                className="text-s font-semibold text-type-secondary hover:text-white transition-transform hover:scale-95 select-none"
                onClick={hide}
              >
                <IconPatch icon={Icons.X} />
              </button>
            </div>
            <Flare.Child className="pointer-events-auto relative h-full overflow-y-auto scrollbar-none select-text">
              <div className="select-text">
                {isLoading || !detailsData ? (
                  <DetailsSkeleton />
                ) : (
                  <DetailsContent data={detailsData} minimal={minimal} />
                )}
              </div>
            </Flare.Child>
          </div>
        </Flare.Base>
      </div>
    </OverlayPortal>
  );
}

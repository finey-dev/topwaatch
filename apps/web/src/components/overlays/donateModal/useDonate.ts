import { useOverlayStack } from "@/stores/interface/overlayStack";

const DONATE_MODAL_ID = "donate";

export function useDonate() {
  const { showModal, hideModal, isModalVisible } = useOverlayStack();

  return {
    openDonate: () => showModal(DONATE_MODAL_ID),
    closeDonate: () => hideModal(DONATE_MODAL_ID),
    isDonateOpen: () => isModalVisible(DONATE_MODAL_ID),
  };
}

import { useConsentStore } from "../../stores/consentStore";
import { PermissionConsentModal } from "./PermissionConsentModal";
import { PermissionBlockedModal } from "./PermissionBlockedModal";

/**
 * Single app-level mount point for the consent and blocked modals. Reads
 * state from `useConsentStore` so the modals survive pill ↔ full window-mode
 * transitions (which unmount PillModeBar/TitleBar).
 */
export function DeviceConsentGate() {
  const consentPrompt = useConsentStore((s) => s.consentPrompt);
  const blockedPrompt = useConsentStore((s) => s.blockedPrompt);
  const handleAllow = useConsentStore((s) => s.handleAllow);
  const handleDeny = useConsentStore((s) => s.handleDeny);
  const handleBlockedReset = useConsentStore((s) => s.handleBlockedReset);
  const closeBlocked = useConsentStore((s) => s.closeBlocked);

  return (
    <>
      {consentPrompt && (
        <PermissionConsentModal
          device={consentPrompt}
          onAllow={handleAllow}
          onDeny={handleDeny}
        />
      )}
      {blockedPrompt && (
        <PermissionBlockedModal
          device={blockedPrompt}
          onAllowNow={handleBlockedReset}
          onClose={closeBlocked}
        />
      )}
    </>
  );
}

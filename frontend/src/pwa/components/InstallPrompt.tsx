import { Download, X } from 'lucide-react';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
/** Offer browser-native installation or concise iOS instructions.
 * @returns {JSX.Element | null} Contextual install controls. */
export function InstallPrompt() {
  const { canInstall, showIosHint, install, dismiss } = useInstallPrompt();
  if (!canInstall && !showIosHint) {
    return null;
  }
  return (
    <div className="install-prompt">
      {canInstall ? (
        <button
          className="button secondary"
          onClick={() => void install()}
        >
          <Download size={16} />
          Install Folio
        </button>
      ) : (
        <p>On iPhone or iPad: tap Share, then Add to Home Screen to keep Folio close.</p>
      )}
      <button
        className="icon-button"
        aria-label="Dismiss install suggestion"
        onClick={dismiss}
      >
        <X size={15} />
      </button>
    </div>
  );
}

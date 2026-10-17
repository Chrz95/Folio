import { CloudOff, RefreshCw, Check, X } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useServiceWorkerUpdate } from '../hooks/useServiceWorkerUpdate';
import { environment } from '../../app/config/environment';
/** Keep connection and update state visible without silently reloading an active form.
 * @returns {JSX.Element} Live PWA feedback. */
export function PwaNotices() {
  const isOnline = useOnlineStatus();
  const { isUpdateReady, isOfflineReady, update, dismissOffline } = useServiceWorkerUpdate();
  return (
    <div
      className="pwa-notices"
      aria-live="polite"
    >
      {!isOnline && (
        <div className="pwa-notice">
          <CloudOff size={16} />
          {environment.isDemo
            ? 'Offline · your preview is saved on this device.'
            : 'You’re offline. Reconnect to load data or save changes.'}
        </div>
      )}
      {isUpdateReady && (
        <div className="pwa-notice">
          <RefreshCw size={16} />A fresh version of Folio is ready. Save any open form before updating.
          <button
            className="text-button"
            onClick={() => void update?.()}
          >
            Update now
          </button>
        </div>
      )}
      {isOfflineReady && (
        <div className="pwa-notice">
          <Check size={16} />
          App shell ready to work offline.
          <button
            className="icon-button"
            aria-label="Dismiss offline confirmation"
            onClick={dismissOffline}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

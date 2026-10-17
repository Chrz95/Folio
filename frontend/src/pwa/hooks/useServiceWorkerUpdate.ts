import { useEffect, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { PWA } from '../pwa.constants';
/** Register after load, preserve drafts during updates, and expose an explicit reload action.
 * @returns {object} Accessible offline/update feedback. */
export function useServiceWorkerUpdate() {
  const [isUpdateReady, setUpdateReady] = useState(false);
  const [isOfflineReady, setOfflineReady] = useState(false);
  const [update, setUpdate] = useState<(() => Promise<void>) | null>(null);
  useEffect(() => {
    if (!('serviceWorker' in navigator) || import.meta.env.DEV) {
      return;
    }
    let interval: ReturnType<typeof setInterval> | undefined;
    let registration: ServiceWorkerRegistration | undefined;
    /** Start the Workbox lifecycle without competing with initial rendering. */
    function register() {
      const updater = registerSW({
        /** Expose a waiting service worker without reloading an active form.
         * @returns {void} Updates application lifecycle state. */
        onNeedRefresh: () => setUpdateReady(true),
        /** Announce that the static application shell has been precached.
         * @returns {void} Updates application lifecycle state. */
        onOfflineReady: () => setOfflineReady(true),
        /** Keep the registration and schedule bounded update checks.
         * @param {string} _url - Typed boundary input.
         * @param {ServiceWorkerRegistration | undefined} current - Typed boundary input.
         * @returns {void} Updates application lifecycle state. */
        onRegisteredSW: (_url, current) => {
          registration = current;
          interval = setInterval(() => void registration?.update(), PWA.updateInterval);
        },
      });
      setUpdate(() => () => updater(true));
    }
    /** Check for a new shell when this budget becomes visible again. */
    function refresh() {
      if (document.visibilityState === 'visible') {
        void registration?.update();
      }
    }
    if (document.readyState === 'complete') {
      register();
    } else {
      window.addEventListener('load', register, { once: true });
    }
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener('load', register);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  /** Dismiss the shell-cache confirmation without touching financial data. */
  function dismissOffline() {
    setOfflineReady(false);
  }
  return { isUpdateReady, isOfflineReady, update, dismissOffline };
}

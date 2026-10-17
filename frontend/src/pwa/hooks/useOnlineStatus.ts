import { useState, useEffect } from 'react';
/** Track connection state with feature-safe browser events.
 * @returns {boolean} Whether the browser reports an active network. */
export function useOnlineStatus() {
  const [isOnline, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    /** Refresh network status after browser connectivity changes. */
    function handleConnectionChange() {
      setOnline(navigator.onLine);
    }
    window.addEventListener('online', handleConnectionChange);
    window.addEventListener('offline', handleConnectionChange);
    return () => {
      window.removeEventListener('online', handleConnectionChange);
      window.removeEventListener('offline', handleConnectionChange);
    };
  }, []);
  return isOnline;
}

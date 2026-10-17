import { useEffect, useState } from 'react';
import { dateKey } from '../utils/format';
const REFRESH_MILLISECONDS = 60000;
/** Refresh civil-day status while the app remains open and when a device returns to the foreground.
 * @returns {string} Browser-local ISO date. */
export function useToday(): string {
  const [today, setToday] = useState(dateKey());
  useEffect(() => {
    /** Read the current device date without changing any financial records. @returns {void} Current day refreshed. */
    function refresh(): void {
      setToday(dateKey());
    }
    const timer = window.setInterval(refresh, REFRESH_MILLISECONDS);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  return today;
}

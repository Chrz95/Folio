import { useEffect } from 'react';
import { AUTOMATIC } from '../features/schedules/automatic.constants';
/** Refresh automatic postings while visible and after a sleeping browser returns to the foreground.
 * @param {() => Promise<void>} reload - Read current persisted data. @param {boolean} isSaving - Mutation guard.
 * @param {(message: string) => void} setError - Shared error feedback. @returns {void} Managed refresh lifecycle. */
export function useWorkspaceRefresh(
  reload: () => Promise<void>,
  isSaving: boolean,
  setError: (message: string) => void,
) {
  useEffect(() => {
    let isActive = true;
    let isRunning = false;
    /** Avoid overlapping polling and in-progress writes. @returns {Promise<void>} Current snapshot or visible error. */
    async function refresh() {
      if (isSaving || isRunning || document.visibilityState === 'hidden') {
        return;
      }
      isRunning = true;
      try {
        await reload();
      } catch (failure) {
        if (isActive) {
          setError(failure instanceof Error ? failure.message : 'Unable to refresh payments.');
        }
      } finally {
        isRunning = false;
      }
    }
    const timer = window.setInterval(() => void refresh(), AUTOMATIC.interval);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      isActive = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [reload, isSaving, setError]);
}

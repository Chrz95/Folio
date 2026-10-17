import { useCallback, useEffect, useState } from 'react';
import { enableReminders, disableReminders, loadNotificationStatus, testNotification } from './notificationService';
import type { DeviceStatus } from './notification.constants';
/** Keep device capability, registration and test outcomes accurate without prompting on page load.
 * @returns {object} Current-device setup controls. */
export function useNotificationDevice() {
  const [status, setStatus] = useState<DeviceStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    setStatus(await loadNotificationStatus());
  }, []);
  useEffect(() => {
    let mounted = true;
    loadNotificationStatus()
      .then((next) => {
        if (mounted) {
          setStatus(next);
        }
      })
      .catch((failure: Error) => {
        if (mounted) {
          setError(failure.message);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);
  /** Perform a user-requested action. The enable call happens synchronously before any await.
   * @param {'toggle' | 'test' | 'refresh'} action - Explicit action.
   * @returns {Promise<void>} Feedback and fresh status. */
  async function perform(action: 'toggle' | 'test' | 'refresh') {
    if (busy) {
      return;
    }
    setBusy(true);
    setMessage('');
    setError('');
    try {
      if (action === 'test') {
        setMessage(await testNotification());
      } else if (action === 'toggle' && status) {
        if (status.hasSubscription || status.isEnabled) {
          await disableReminders();
          setMessage('Notifications disconnected for this device.');
        } else {
          setMessage(await enableReminders(status.configuration));
        }
      }
      await refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to update this device.');
      try {
        await refresh();
      } catch {
        /* Keep the original action failure visible. */
      }
    } finally {
      setBusy(false);
    }
  }
  return { status, busy, message, error, perform };
}

import { useEffect } from 'react';
import type { BudgetData } from '../../types/budget';
import { APP, VALUE } from '../../constants/app.constants';
import { environment } from '../../app/config/environment';
import { runLocalReminderScan } from './localReminderDelivery';
import { readyNotificationWorker } from './notificationCapabilities';
import { REMINDER_EVENT } from './reminders.constants';
/** Preview delivery is restricted to this open page; server builds use background Web Push.
 * @param {BudgetData} data - Current schedules. @returns {void} Cleans up timers and preference listeners. */
export function useLocalReminders(data: BudgetData) {
  useEffect(() => {
    if (!environment.isDemo || !('Notification' in window)) {
      return;
    }
    let isChecking = false;
    let stopped = false;
    /** Refresh reminders after the clock or user settings change. */
    async function check() {
      if (
        isChecking ||
        stopped ||
        localStorage.getItem(APP.notificationsKey) !== 'enabled' ||
        Notification.permission !== 'granted'
      ) {
        return;
      }
      isChecking = true;
      try {
        await runLocalReminderScan(data, Date.now(), async (title, options) => {
          if (stopped) {
            throw new Error('Reminder view closed.');
          }
          if ('serviceWorker' in navigator) {
            const registration = await readyNotificationWorker();
            if (stopped) {
              throw new Error('Reminder view closed.');
            }
            await registration.showNotification(title, options);
          } else {
            new Notification(title, options);
          }
        });
      } catch {
        /* A storage failure leaves reminders unsent; financial saves expose storage errors separately. */
      } finally {
        isChecking = false;
      }
    }
    void check();
    const interval = setInterval(() => void check(), VALUE.notificationInterval);
    window.addEventListener(REMINDER_EVENT, changed);
    /** Refresh after local reminder preferences change. @returns {void} Starts a bounded scan. */
    function changed() {
      void check();
    }
    return () => {
      stopped = true;
      clearInterval(interval);
      window.removeEventListener(REMINDER_EVENT, changed);
    };
  }, [data]);
}

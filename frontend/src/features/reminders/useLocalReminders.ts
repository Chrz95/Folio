import { useEffect } from 'react';
import type { BudgetData } from '../../types/budget';
import { APP, VALUE } from '../../constants/app.constants';
import { environment } from '../../app/config/environment';
import { runLocalReminderScan } from './localReminderDelivery';
import { REMINDER_EVENT } from './reminders.constants';
/** Preview delivery is restricted to this open page; server builds use background Web Push.
 * @param {BudgetData} data - Current schedules. @returns {void} Cleans up timers and preference listeners. */
export function useLocalReminders(data: BudgetData) {
  useEffect(() => {
    if (!environment.isDemo || !('Notification' in window)) {
      return;
    }
    /** Refresh reminders after the clock or user settings change. */
    function check() {
      if (localStorage.getItem(APP.notificationsKey) !== 'enabled' || Notification.permission !== 'granted') {
        return;
      }
      try {
        runLocalReminderScan(data, Date.now(), (title, options) => {
          new Notification(title, options);
        });
      } catch {
        /* A storage failure leaves reminders unsent; financial saves expose storage errors separately. */
      }
    }
    check();
    const interval = setInterval(check, VALUE.notificationInterval);
    window.addEventListener(REMINDER_EVENT, check);
    return () => {
      clearInterval(interval);
      window.removeEventListener(REMINDER_EVENT, check);
    };
  }, [data]);
}

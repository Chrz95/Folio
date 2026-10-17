import { useState, useEffect, useCallback } from 'react';
import type { BudgetData } from '../../types/budget';
import type { ReminderState } from '../../types/operations';
import { loadReminderState, snoozeReminder } from './reminderStateService';
import { REMINDER_EVENT, DEFAULT_REMINDER_PREFERENCES, REMINDERS } from './reminders.constants';
import { getOccurrences } from '../transactions/recurrence';
import { zonedClock, shiftReminderDate } from './reminderPlanning';
/** Keep settings, snoozes and provider history live while inspecting reminders.
 * @param {BudgetData} data - Workspace schedules. @returns {object} Upcoming/overdue list and controls. */
export function useReminderCenter(data: BudgetData) {
  const [state, setState] = useState<ReminderState>({
    preferences: { ...DEFAULT_REMINDER_PREFERENCES },
    snoozes: [],
    attempts: [],
  });
  const [error, setError] = useState('');
  const [isBusy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now);
  const reload = useCallback(async () => {
    setState(await loadReminderState());
    setNow(Date.now());
  }, []);
  useEffect(() => {
    let isActive = true;
    /** Refresh safe state and expose network/storage failures. */
    function refresh() {
      void loadReminderState()
        .then((value) => {
          if (isActive) {
            setState(value);
            setNow(Date.now());
          }
        })
        .catch((failure: Error) => {
          if (isActive) {
            setError(failure.message);
          }
        });
    }
    refresh();
    const timer = setInterval(refresh, REFRESH_INTERVAL);
    window.addEventListener(REMINDER_EVENT, refresh);
    return () => {
      isActive = false;
      clearInterval(timer);
      window.removeEventListener(REMINDER_EVENT, refresh);
    };
  }, []);
  const clock = zonedClock(now, state.preferences.timeZone);
  const entries = getOccurrences(
    data,
    shiftReminderDate(clock.date, -state.preferences.overdueDays),
    shiftReminderDate(clock.date, UPCOMING_DAYS),
  )
    .filter((entry) => !entry.isPaid)
    .map((entry) => ({
      ...entry,
      snoozedUntil:
        state.snoozes.find((snooze) => snooze.recurringId === entry.id && snooze.date === entry.date)?.until ?? 0,
      isOverdue: entry.date < clock.date,
      isDueToday: entry.date === clock.date,
    }));
  /** Snooze an occurrence without changing its due date. @param {string} id - Schedule.
   * @param {string} date - Date. @param {number} minutes - Allowed duration. @returns {Promise<void>} Refresh. */
  async function snooze(id: string, date: string, minutes: number) {
    setBusy(true);
    setError('');
    try {
      await snoozeReminder(id, date, minutes);
      await reload();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to snooze.');
    } finally {
      setBusy(false);
    }
  }
  return { state, reload, error, isBusy, now, clock, entries, snooze, snoozeDurations: REMINDERS.snoozeMinutes };
}
const REFRESH_INTERVAL = 60000;
const UPCOMING_DAYS = 7;
export type ReminderCenterState = ReturnType<typeof useReminderCenter>;

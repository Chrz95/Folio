import { request } from '../../lib/api/client';
import { environment } from '../../app/config/environment';
import { PATH } from '../../constants/app.constants';
import type { ReminderState, ReminderPreferences } from '../../types/operations';
import { REMINDER_STORAGE, REMINDER_EVENT, DEFAULT_REMINDER_PREFERENCES, REMINDERS } from './reminders.constants';
import { readDemo } from '../../lib/storage/demoStore';
import { getOccurrences } from '../transactions/recurrence';
/** Read separate preview metadata without changing the financial-data key.
 * @returns {ReminderState} Device delivery preferences and acknowledgments. */
export function readLocalReminderState(): ReminderState {
  const saved = localStorage.getItem(REMINDER_STORAGE);
  if (!saved) {
    return { preferences: { ...DEFAULT_REMINDER_PREFERENCES }, snoozes: [], attempts: [], deliveryLedger: [] };
  }
  const state = JSON.parse(saved) as ReminderState;
  if (!state.preferences || !Array.isArray(state.snoozes) || !Array.isArray(state.attempts)) {
    throw new Error('Reminder settings could not be read. Reset preview data in Settings.');
  }
  return state;
}
/** Persist before notifying visible controls.
 * @param {ReminderState} state - New state.
 * @returns {void} Durable write. */
export function writeLocalReminderState(state: ReminderState) {
  localStorage.setItem(REMINDER_STORAGE, JSON.stringify(state));
  window.dispatchEvent(new Event(REMINDER_EVENT));
}
/** Fetch authoritative reminder metadata. @param {AbortSignal} [signal] - Cancellation.
 * @returns {Promise<ReminderState>} Settings, snoozes and safe delivery history. */
export async function loadReminderState(signal?: AbortSignal): Promise<ReminderState> {
  return environment.isDemo ? readLocalReminderState() : request(`${PATH.notifications}/state`, { signal });
}
/** Save explicit workspace timing choices; this does not request notification permission.
 * @param {ReminderPreferences} preferences - User choice. @returns {Promise<void>} Saved preferences. */
export async function saveReminderPreferences(preferences: ReminderPreferences) {
  try {
    new Intl.DateTimeFormat('en', { timeZone: preferences.timeZone }).format();
  } catch {
    throw new Error('Choose a supported IANA timezone.');
  }
  if (
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(preferences.deliveryTime) ||
    !Number.isInteger(preferences.overdueDays) ||
    preferences.overdueDays < 0 ||
    preferences.overdueDays > REMINDERS.maximumOverdue
  ) {
    throw new Error('Choose a delivery time and an overdue window between 0 and 30 days.');
  }
  if (environment.isDemo) {
    writeLocalReminderState({ ...readLocalReminderState(), preferences });
  } else {
    await request(`${PATH.notifications}/preferences`, { method: 'PUT', body: JSON.stringify(preferences) });
    window.dispatchEvent(new Event(REMINDER_EVENT));
  }
}
/** Snooze one unpaid occurrence, without moving its financial due date.
 * @param {string} recurringId - Schedule. @param {string} date - Due date. @param {number} minutes - Duration.
 * @returns {Promise<void>} Saved suppression. */
export async function snoozeReminder(recurringId: string, date: string, minutes: number) {
  if (!REMINDERS.snoozeMinutes.some((duration) => duration === minutes)) {
    throw new Error('Choose a supported snooze duration.');
  }
  if (!environment.isDemo) {
    await request(`${PATH.notifications}/snooze`, {
      method: 'POST',
      body: JSON.stringify({ recurringId, date, minutes }),
    });
    window.dispatchEvent(new Event(REMINDER_EVENT));
    return;
  }
  const data = readDemo();
  if (!getOccurrences(data, date, date).some((entry) => entry.id === recurringId && !entry.isPaid)) {
    throw new Error('Choose an unpaid scheduled occurrence.');
  }
  const state = readLocalReminderState();
  state.snoozes = [
    ...state.snoozes.filter((entry) => entry.recurringId !== recurringId || entry.date !== date),
    { recurringId, date, until: Date.now() + minutes * REMINDERS.minuteMilliseconds },
  ];
  writeLocalReminderState(state);
}

import { isScheduleDateEnabled } from '../schedules/schedulePolicy.js';
import type { ScheduleData } from '../schedules/schedulePolicy.js';
import type { recurring, transactions } from '../../db/schema/budget.js';
import type { reminderSnoozes } from '../../db/schema/operations.js';
import type { ReminderPreferences } from './reminders.schema.js';
import { occurrenceDate } from '../budget/recurrence.js';
import { REMINDERS } from './reminders.constants.js';
/** Read the wall clock in a selected zone, including DST, without assuming fixed UTC offsets.
 * @param {number} now - Epoch milliseconds. @param {string} timeZone - IANA zone.
 * @returns {object} Local date and 24-hour time strings. */
export function zonedClock(now: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(now));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { date: `${values.year}-${values.month}-${values.day}`, time: `${values.hour}:${values.minute}` };
}
/** Move pure calendar days without changing the workspace timezone.
 * @param {string} date - ISO date. @param {number} offset - Days. @returns {string} Shifted date. */
export function shiftReminderDate(date: string, offset: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, REMINDERS.dateLength);
}
export interface ReminderJob {
  key: string;
  title: string;
  body: string;
  date: string;
}
/** Plan upcoming, due and daily overdue reminders; paid and snoozed occurrences are suppressed.
 * @param {object[]} templates - Schedule definitions. @param {object[]} postings - Actual transactions.
 * @param {object[]} snoozes - Suppression windows. @param {ReminderPreferences} preferences - Delivery policy.
 * @param {number} now - Injected clock.
 * @param {Partial<ScheduleData>} controls - Saved planning controls.
 * @returns {ReminderJob[]} Privacy-preserving notification jobs. */
export function planReminderJobs(
  templates: (typeof recurring.$inferSelect)[],
  postings: (typeof transactions.$inferSelect)[],
  snoozes: (typeof reminderSnoozes.$inferSelect)[],
  preferences: ReminderPreferences,
  now: number,
  controls: Partial<ScheduleData> = {},
): ReminderJob[] {
  const clock = zonedClock(now, preferences.timeZone);
  if (clock.time < preferences.deliveryTime) {
    return [];
  }
  const first = shiftReminderDate(clock.date, -preferences.overdueDays);
  const jobs: ReminderJob[] = [];
  const maximumLead = 7;
  const last = shiftReminderDate(clock.date, maximumLead);
  for (const template of templates) {
    for (let index = 0; index < REMINDERS.maximumOccurrences; index += 1) {
      if (template.frequency === 'once' && index > 0) {
        break;
      }
      const date = occurrenceDate(template.date, template.frequency, index);
      if (date > last) {
        break;
      }
      if (!isScheduleDateEnabled(template.id, date, controls)) {
        continue;
      }
      if (date < first || shiftReminderDate(date, -template.reminderDays) > clock.date) {
        continue;
      }
      if (postings.some((entry) => entry.recurringId === template.id && entry.date === date)) {
        continue;
      }
      const snooze = snoozes.find((entry) => entry.recurringId === template.id && entry.date === date);
      if (snooze && snooze.until > now) {
        continue;
      }
      const phase = date < clock.date ? `overdue:${clock.date}` : date === clock.date ? 'due' : 'upcoming';
      jobs.push({
        key: `${template.id}:${date}:${phase}:${snooze?.until ?? 0}`,
        date: clock.date,
        title: date < clock.date ? 'An overdue payment needs a look' : 'A gentle reminder from Folio',
        body: 'Open your budget to review a planned transaction. Amounts and payees stay private.',
      });
    }
  }
  return preferences.mode === 'digest' && jobs.length
    ? [
        {
          key: `digest:${clock.date}`,
          date: clock.date,
          title: 'Your daily Folio check-in',
          body: `${jobs.length} planned or overdue transactions are ready to review.`,
        },
      ]
    : jobs;
}

import { z } from 'zod';
import { REMINDERS } from './reminders.constants.js';
/** Validate IANA timezone names with the runtime that will schedule delivery.
 * @param {string} value - Zone. @returns {boolean} Whether Intl supports it. */
function isSupportedTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}
const TIME_ZONE_LENGTH = 100;
export const preferencesSchema = z
  .object({
    timeZone: z.string().min(1).max(TIME_ZONE_LENGTH).refine(isSupportedTimeZone, 'Choose a supported IANA timezone.'),
    deliveryTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    mode: z.enum(REMINDERS.mode),
    overdueDays: z.number().int().min(0).max(REMINDERS.maximumOverdue),
  })
  .strict();
export const snoozeSchema = z
  .object({
    recurringId: z.uuid(),
    date: z.iso.date(),
    minutes: z.union([z.literal(REMINDERS.snoozeMinutes[0]), z.literal(REMINDERS.snoozeMinutes[1])]),
  })
  .strict();
export type ReminderPreferences = z.infer<typeof preferencesSchema>;

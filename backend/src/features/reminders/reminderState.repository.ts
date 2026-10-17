import { eq, and, desc } from 'drizzle-orm';
import type { DatabaseClient } from '../../db/client.js';
import { reminderPreferences, reminderSnoozes, reminderAttempts } from '../../db/schema/operations.js';
import type { ReminderPreferences } from './reminders.schema.js';
import { DEFAULT_REMINDER_PREFERENCES, REMINDERS } from './reminders.constants.js';
/** Keep reminder timing, snoozes and provider acknowledgments in SQLite.
 * @param {DatabaseClient} client - Application connection. @returns {object} State repository. */
export function createReminderStateRepository(client: DatabaseClient) {
  const { database } = client;
  return {
    /** Read a singleton setting or the documented defaults.
     * @returns {ReminderPreferences} Workspace delivery policy. */
    preferences: (): ReminderPreferences => {
      const record = database
        .select()
        .from(reminderPreferences)
        .where(eq(reminderPreferences.id, REMINDERS.singletonId))
        .get();
      if (!record) {
        return { ...DEFAULT_REMINDER_PREFERENCES };
      }
      const { id: _id, ...preferences } = record;
      return preferences;
    },
    /** Save validated workspace preferences. @param {ReminderPreferences} value - Policy. @returns {void} Persists. */
    savePreferences: (value: ReminderPreferences) => {
      database
        .insert(reminderPreferences)
        .values({ ...value, id: REMINDERS.singletonId })
        .onConflictDoUpdate({ target: reminderPreferences.id, set: value })
        .run();
    },
    /** Read snooze windows. @returns {object[]} Occurrence suppressions. */
    snoozes: () => database.select().from(reminderSnoozes).all(),
    /** Replace an occurrence's snooze. @param {typeof reminderSnoozes.$inferInsert} value - Window.
     * @returns {void} Stores across restarts. */
    snooze: (value: typeof reminderSnoozes.$inferInsert) => {
      database
        .insert(reminderSnoozes)
        .values(value)
        .onConflictDoUpdate({
          target: [reminderSnoozes.recurringId, reminderSnoozes.date],
          set: { until: value.until },
        })
        .run();
    },
    /** Cancel a future snooze. @param {string} recurringId - Schedule. @param {string} date - Occurrence.
     * @returns {void} Removes suppression. */
    cancelSnooze: (recurringId: string, date: string) => {
      database
        .delete(reminderSnoozes)
        .where(and(eq(reminderSnoozes.recurringId, recurringId), eq(reminderSnoozes.date, date)))
        .run();
    },
    /** Read safe, bounded provider status. @returns {object[]} Latest attempts. */
    history: () =>
      database
        .select()
        .from(reminderAttempts)
        .orderBy(desc(reminderAttempts.attemptedAt))
        .limit(REMINDERS.historyLimit)
        .all(),
    /** Find a delivery retry record.
     * @param {string} id - Opaque delivery key.
     * @returns {object | undefined} Attempt. */
    attempt: (id: string) => database.select().from(reminderAttempts).where(eq(reminderAttempts.id, id)).get(),
    /** Update one delivery's status. @param {typeof reminderAttempts.$inferInsert} value - Attempt.
     * @returns {void} Records success or bounded retry state. */
    recordAttempt: (value: typeof reminderAttempts.$inferInsert) => {
      database
        .insert(reminderAttempts)
        .values(value)
        .onConflictDoUpdate({ target: reminderAttempts.id, set: value })
        .run();
    },
  };
}

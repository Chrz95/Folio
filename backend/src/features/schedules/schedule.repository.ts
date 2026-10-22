import { portableScheduleControl, patchScheduleControls } from './scheduleControls.repository.js';
import { and, eq } from 'drizzle-orm';
import type { DatabaseClient } from '../../db/client.js';
import { scheduleSettings, skippedOccurrences } from '../../db/schema/schedules.js';
import { createBudgetRepository } from '../budget/budget.repository.js';
/** Persist controls and skips with the same schedule lifecycle as their parent.
 * @param {DatabaseClient} client - Migrated connection. @returns {object} Schedule persistence boundary. */
export function createScheduleRepository(client: DatabaseClient) {
  const { database } = client;
  const budget = createBudgetRepository(client);
  return {
    template: budget.getRecurring,
    hasOccurrence: budget.hasOccurrence,
    /** Read all small control collections. @returns {object} Optional planning metadata. */
    state: () => ({
      scheduleSettings: database.select().from(scheduleSettings).all().map(portableScheduleControl),
      skippedOccurrences: database.select().from(skippedOccurrences).all(),
    }),
    /** Save a complete control record. @param {typeof scheduleSettings.$inferInsert} value - Controls.
     * @returns {object} Durable control. */
    saveSettings: (value: typeof scheduleSettings.$inferInsert) => {
      const { recurringId, autoConfirmFrom: _from, ...changes } = value;
      return patchScheduleControls(client, recurringId, changes);
    },
    /** Add one skipped date idempotently. @param {typeof skippedOccurrences.$inferInsert} value - Occurrence.
     * @returns {void} Persistent skip. */
    skip: (value: typeof skippedOccurrences.$inferInsert) => {
      database.insert(skippedOccurrences).values(value).onConflictDoNothing().run();
    },
    /** Restore one skipped date idempotently. @param {string} recurringId - Schedule ID.
     * @param {string} date - Due date.
     * @returns {void} Removes only that exception. */
    restore: (recurringId: string, date: string) => {
      database
        .delete(skippedOccurrences)
        .where(and(eq(skippedOccurrences.recurringId, recurringId), eq(skippedOccurrences.date, date)))
        .run();
    },
    /** Validate against current payments inside the write transaction.
     * @param {() => T} action - Synchronous domain operation. @returns {T} Atomic result. */
    atomic: <T>(action: () => T): T => database.transaction(action),
  };
}
export type ScheduleRepository = ReturnType<typeof createScheduleRepository>;

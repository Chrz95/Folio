import { eq } from 'drizzle-orm';
import type { DatabaseClient } from '../../db/client.js';
import { scheduleSettings } from '../../db/schema/schedules.js';
import type { ScheduleSettings } from './schedulePolicy.js';
import { createReminderStateRepository } from '../reminders/reminderState.repository.js';
import { zonedClock } from '../reminders/reminderPlanning.js';
export interface ControlChanges {
  isPaused?: boolean;
  endDate?: string | null;
  autoConfirm?: boolean;
}
/** Preserve the legacy control shape when automatic confirmation is disabled.
 * @param {ScheduleSettings} row - Persisted control. @returns {ScheduleSettings} Portable optional extension. */
export function portableScheduleControl(row: ScheduleSettings): ScheduleSettings {
  const { autoConfirm, autoConfirmFrom, ...base } = row;
  return autoConfirm ? { ...base, autoConfirm, autoConfirmFrom } : base;
}
/** Resolve the calendar date using the workspace reminder timezone, independent of the server timezone.
 * @param {DatabaseClient} client - Migrated connection. @param {number} now - Epoch milliseconds.
 * @returns {string} Workspace-local date. */
export function automaticDate(client: DatabaseClient, now: number): string {
  return zonedClock(now, createReminderStateRepository(client).preferences().timeZone).date;
}
/** Patch settings inside the caller's transaction; enabling/resuming never backfills dates before today.
 * @param {DatabaseClient} client - Existing connection. @param {string} id - Parent schedule.
 * @param {ControlChanges} changes - Explicit edits. @param {boolean} restart - Recurrence pattern changed.
 * @returns {ScheduleSettings} Complete saved controls. */
export function patchScheduleControls(client: DatabaseClient, id: string, changes: ControlChanges, restart = false) {
  const { database } = client;
  const previous = database.select().from(scheduleSettings).where(eq(scheduleSettings.recurringId, id)).get();
  const next = { recurringId: id, isPaused: false, endDate: null as string | null, ...previous, ...changes };
  const enabled = next.autoConfirm ?? false;
  const resumed = previous?.isPaused && !next.isPaused;
  const from = enabled
    ? !previous?.autoConfirm || !previous.autoConfirmFrom || resumed || restart
      ? automaticDate(client, Date.now())
      : previous.autoConfirmFrom
    : null;
  const value = { ...next, autoConfirm: enabled, autoConfirmFrom: from };
  const saved = database
    .insert(scheduleSettings)
    .values(value)
    .onConflictDoUpdate({ target: scheduleSettings.recurringId, set: value })
    .returning()
    .get();
  return portableScheduleControl(saved!);
}

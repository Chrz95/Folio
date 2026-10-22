import type { BudgetData } from '../../types/budget';
import type { ScheduleSettings } from './schedulePolicy';
import { zonedClock } from '../reminders/reminderPlanning';
import { readLocalReminderState } from '../reminders/reminderStateService';
export interface ControlChanges {
  isPaused?: boolean;
  endDate?: string | null;
  autoConfirm?: boolean;
}
/** Read the selected reminder timezone rather than assuming the device timezone matches the workspace.
 * @param {number} now - Epoch milliseconds. @returns {string} Workspace-local date. */
export function localAutomaticDate(now: number): string {
  return zonedClock(now, readLocalReminderState().preferences.timeZone).date;
}
/** Build one control record before the caller's single durable snapshot write.
 * @param {BudgetData} data - Mutable draft. @param {string} id - Rule UUID.
 * @param {ControlChanges} changes - Explicit edits. @param {boolean} restart - Recurrence pattern changed.
 * @returns {void} Updates the draft only, preserving pause and other omitted values. */
export function patchDemoControls(data: BudgetData, id: string, changes: ControlChanges, restart = false): void {
  const previous = data.scheduleSettings?.find((row) => row.recurringId === id);
  const next: ScheduleSettings = { recurringId: id, isPaused: false, endDate: null, ...previous, ...changes };
  const resumed = previous?.isPaused && !next.isPaused;
  if (next.autoConfirm) {
    next.autoConfirmFrom =
      !previous?.autoConfirm || !previous.autoConfirmFrom || resumed || restart
        ? localAutomaticDate(Date.now())
        : previous.autoConfirmFrom;
  } else {
    delete next.autoConfirm;
    delete next.autoConfirmFrom;
  }
  data.scheduleSettings = [...(data.scheduleSettings ?? []).filter((row) => row.recurringId !== id), next];
}

import type { BudgetData, Occurrence, RecurringTransaction } from '../../types/budget';
import { FREQUENCY_ORDER } from './recurringSort.constants';
import type { RecurringSort } from './recurringSort.constants';
import { recurringStatusLabel } from './recurringStatus';
import { displayOccurrences } from '../calendar/calendarEntries';
import { occurrenceDate } from '../transactions/recurrence';
export type { RecurringSort } from './recurringSort.constants';
export type SortDirection = 'ascending' | 'descending';
export interface RecurringRow {
  template: RecurringTransaction;
  closest?: Occurrence;
  overdue: number;
  /** Unpaid, unskipped dates through the ending; null for an ongoing series. */
  remaining: number | null;
  isPaused: boolean;
  endDate: string | null;
}
/** Compare civil dates without DST-dependent day lengths. Past dates win equal-distance ties.
 * @param {string} first - Candidate. @param {string} second - Candidate.
 * @param {string} today - Anchor. @returns {number} Distance comparison. */
export function compareProximity(first: string, second: string, today: string): number {
  const now = Date.parse(`${today}T12:00:00Z`);
  return (
    Math.abs(Date.parse(`${first}T12:00:00Z`) - now) - Math.abs(Date.parse(`${second}T12:00:00Z`) - now) ||
    first.localeCompare(second)
  );
}
/** Build one management row per rule with its nearest unconfirmed instance, including paused and overdue instances.
 * @param {BudgetData} data - Ledger. @param {string} today - Current civil date.
 * @returns {RecurringRow[]} Rule rows. */
export function recurringRows(data: BudgetData, today: string): RecurringRow[] {
  const horizon = occurrenceDate(today, 'yearly', 1);
  return data.recurring.map((template) => {
    const settings = data.scheduleSettings?.find((row) => row.recurringId === template.id);
    const ending = settings?.endDate ?? (template.frequency === 'once' ? template.date : null);
    const to = ending ?? (template.date > horizon ? template.date : horizon);
    const unpaid = displayOccurrences({ ...data, recurring: [template] }, template.date, to).filter(
      (row) => !row.isPaid,
    );
    const closest = unpaid.reduce<Occurrence | undefined>(
      (best, row) => (!best || compareProximity(row.date, best.date, today) < 0 ? row : best),
      undefined,
    );
    return {
      template,
      closest,
      overdue: unpaid.filter((row) => row.date < today).length,
      remaining: ending ? unpaid.length : null,
      isPaused: settings?.isPaused ?? false,
      endDate: settings?.endDate ?? null,
    };
  });
}
/** Sort copies without changing persisted data. Missing dates and ongoing counts stay last; status prioritizes pause.
 * @param {RecurringRow[]} rows - Management rows. @param {string} today - Distance anchor.
 * @param {RecurringSort} sort - Column. @param {SortDirection} direction - Direction.
 * @returns {RecurringRow[]} Stable display order. */
export function sortRecurringRows(
  rows: RecurringRow[],
  today: string,
  sort: RecurringSort,
  direction: SortDirection,
): RecurringRow[] {
  return [...rows].sort((a, b) => {
    if (sort === 'proximity' && Boolean(a.closest) !== Boolean(b.closest)) {
      return a.closest ? -1 : 1;
    }
    if (sort === 'remaining' && (a.remaining === null) !== (b.remaining === null)) {
      return a.remaining === null ? 1 : -1;
    }
    const comparisons: Record<RecurringSort, () => number> = {
      amount: () => a.template.amount - b.template.amount,
      name: () => a.template.name.localeCompare(b.template.name),
      frequency: () => FREQUENCY_ORDER[a.template.frequency] - FREQUENCY_ORDER[b.template.frequency],
      remaining: () => (a.remaining ?? 0) - (b.remaining ?? 0),
      status: () => recurringStatusLabel(a, today).localeCompare(recurringStatusLabel(b, today)),
      proximity: () => (a.closest && b.closest ? compareProximity(a.closest.date, b.closest.date, today) : 0),
    };
    const order = comparisons[sort]();
    return (
      (direction === 'descending' ? -order : order) ||
      a.template.name.localeCompare(b.template.name) ||
      a.template.id.localeCompare(b.template.id)
    );
  });
}

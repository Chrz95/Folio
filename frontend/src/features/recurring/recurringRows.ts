import type { BudgetData, Occurrence, RecurringTransaction } from '../../types/budget';
import { displayOccurrences } from '../calendar/calendarEntries';
import { occurrenceDate } from '../transactions/recurrence';
export type RecurringSort = 'proximity' | 'name' | 'amount';
export type SortDirection = 'ascending' | 'descending';
export interface RecurringRow {
  template: RecurringTransaction;
  closest?: Occurrence;
  overdue: number;
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
    const to = template.date > horizon ? template.date : horizon;
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
      isPaused: settings?.isPaused ?? false,
      endDate: settings?.endDate ?? null,
    };
  });
}
/** Sort copies without changing persisted data. Rules without unpaid dates sort last by proximity.
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
    const order =
      sort === 'amount'
        ? a.template.amount - b.template.amount
        : sort === 'name'
          ? a.template.name.localeCompare(b.template.name)
          : a.closest && b.closest
            ? compareProximity(a.closest.date, b.closest.date, today)
            : 0;
    return (
      (direction === 'descending' ? -order : order) ||
      a.template.name.localeCompare(b.template.name) ||
      a.template.id.localeCompare(b.template.id)
    );
  });
}

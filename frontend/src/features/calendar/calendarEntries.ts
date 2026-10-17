import type { BudgetData, Occurrence, Transaction } from '../../types/budget';
import { getOccurrences } from '../transactions/recurrence';
export type PaymentStatus = 'confirmed' | 'overdue' | 'unconfirmed';
export const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  confirmed: 'Confirmed',
  overdue: 'Overdue',
  unconfirmed: 'Unconfirmed',
};
export type CalendarEntry = { key: string; status: PaymentStatus; isPaused: boolean } & (
  { isPlanned: false; entry: Transaction } | { isPlanned: true; entry: Occurrence }
);
/** Classify a due date independently of income/expense type. Recorded payments are always confirmed.
 * @param {string} date - Civil payment date. @param {boolean} confirmed - Recorded posting.
 * @param {string} today - Current civil day. @returns {PaymentStatus} Visible confirmation state. */
export function paymentStatus(date: string, confirmed: boolean, today: string): PaymentStatus {
  return confirmed ? 'confirmed' : date < today ? 'overdue' : 'unconfirmed';
}
/** Show paused schedules for planning while retaining skip/end policies. Reminder and balance engines stay separate.
 * @param {BudgetData} data - Ledger. @param {string} from - First day. @param {string} to - Last day.
 * @returns {Occurrence[]} Display occurrences only; callers must respect pause state before confirming. */
export function displayOccurrences(data: BudgetData, from: string, to: string): Occurrence[] {
  return getOccurrences(
    { ...data, scheduleSettings: data.scheduleSettings?.map((row) => ({ ...row, isPaused: false })) },
    from,
    to,
  );
}
/** Combine recorded payments and all unconfirmed instances without duplicating already-paid occurrences.
 * @param {BudgetData} data - Ledger. @param {string} from - First day. @param {string} to - Last day.
 * @param {string} today - Current civil day. @returns {CalendarEntry[]} Exact display rows. */
export function calendarEntries(data: BudgetData, from: string, to: string, today: string): CalendarEntry[] {
  const posted: CalendarEntry[] = data.transactions
    .filter((row) => row.date >= from && row.date <= to)
    .map((entry) => ({
      key: `posted:${entry.id}`,
      entry,
      isPlanned: false,
      status: 'confirmed',
      isPaused: false,
    }));
  const planned: CalendarEntry[] = displayOccurrences(data, from, to)
    .filter((row) => !row.isPaid)
    .map((entry) => ({
      key: `planned:${entry.occurrenceId}`,
      entry,
      isPlanned: true,
      status: paymentStatus(entry.date, false, today),
      isPaused: data.scheduleSettings?.some((row) => row.recurringId === entry.id && row.isPaused) ?? false,
    }));
  return [...posted, ...planned].sort((a, b) => a.entry.date.localeCompare(b.entry.date));
}

import type { RecurringRow } from './recurringRows';
import { PAYMENT_LABEL, paymentStatus } from '../calendar/calendarEntries';
/** Derive the primary status for alphabetical sorting, preserving paused schedule visibility.
 * @param {RecurringRow} row - Management row. @param {string} today - Local civil date.
 * @returns {string} Display status, with paused state taking priority over payment timing. */
export function recurringStatusLabel(row: RecurringRow, today: string): string {
  if (row.isPaused) {
    return 'Paused';
  }
  return row.closest ? PAYMENT_LABEL[paymentStatus(row.closest.date, false, today)] : 'No pending dates';
}

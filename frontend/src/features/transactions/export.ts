import type { Transaction, BudgetData } from '../../types/budget';
import { getOccurrences } from './recurrence';
import { dateKey, shiftMonth } from '../../utils/format';
import { VALUE } from '../../constants/app.constants';
/** Download a locally generated file and release its object URL.
 * @param {string} name - Download filename.
 * @param {string} content - File content.
 * @param {string} mime - Media type.
 * @returns {void} Triggers a user-initiated download. */
export function downloadFile(name: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}
/** Prevent CSV formula execution and quote arbitrary notes safely.
 * @param {string} value - Untrusted cell content.
 * @returns {string} Spreadsheet-safe CSV field. */
export function escapeCsv(value: string) {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}
/** Export exactly the currently filtered ledger.
 * @param {Transaction[]} transactions - Selected actual postings.
 * @returns {void} Download CSV. */
export function exportTransactions(transactions: Transaction[]) {
  const header = ['Date', 'Name', 'Type', 'Category', 'Amount (EUR)', 'Account ID', 'Notes'];
  const rows = transactions.map((entry) =>
    [
      entry.date,
      entry.name,
      entry.type,
      entry.category,
      String(entry.amount / VALUE.cents),
      entry.accountId,
      entry.notes,
    ]
      .map(escapeCsv)
      .join(','),
  );
  downloadFile('folio-transactions.csv', [header.join(','), ...rows].join('\r\n'), 'text/csv;charset=utf-8');
}
/** Escape iCalendar content lines.
 * @param {string} value - Event label.
 * @returns {string} Escaped plain text. */
function escapeCalendar(value: string) {
  return value.replaceAll('\\', '\\\\').replaceAll('\n', '\\n').replaceAll(',', '\\,').replaceAll(';', '\\;');
}
/** Export explicit clamped occurrences for the next twelve months with calendar alarms.
 * @param {BudgetData} data - Current schedules.
 * @returns {void} Download a portable iCalendar file. */
export function exportCalendar(data: BudgetData) {
  const events = getOccurrences(data, dateKey(), shiftMonth(dateKey(), VALUE.monthCount)).filter(
    (entry) => !entry.isPaid,
  );
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Folio//Budget Calendar//EN', 'CALSCALE:GREGORIAN'];
  events.forEach((entry) =>
    lines.push(
      'BEGIN:VEVENT',
      `UID:${entry.occurrenceId}@folio.local`,
      `DTSTAMP:${new Date()
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d+Z$/, 'Z')}`,
      `DTSTART;VALUE=DATE:${entry.date.replaceAll('-', '')}`,
      `SUMMARY:${escapeCalendar(entry.name)}`,
      'BEGIN:VALARM',
      `TRIGGER:-P${entry.reminderDays}D`,
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeCalendar(entry.name)} is coming up`,
      'END:VALARM',
      'END:VEVENT',
    ),
  );
  lines.push('END:VCALENDAR');
  downloadFile('folio-upcoming.ics', lines.join('\r\n'), 'text/calendar;charset=utf-8');
}

import { z } from 'zod';
import type { BudgetData, Occurrence, RecurringTransaction } from '../../types/budget';
import { displayOccurrences } from '../calendar/calendarEntries';
import { occurrenceDate } from './recurrence';
import { dateKey } from '../../utils/format';
const PREVIEW_OCCURRENCES = 6;
/** Read the first pending dates, including overdue/paused dates, without writing or changing history.
 * @param {BudgetData} data - Workspace controls/history. @param {RecurringTransaction} template - Draft rule.
 * @returns {Occurrence[]} First six unpaid dates within the engine's documented bound. */
export function editorOccurrences(data: BudgetData, template: RecurringTransaction): Occurrence[] {
  if (!z.iso.date().safeParse(template.date).success) {
    return [];
  }
  const anchor = template.date > dateKey() ? template.date : dateKey();
  const end = occurrenceDate(anchor, 'yearly', PREVIEW_OCCURRENCES);
  const previous = data.recurring.find((row) => row.id === template.id);
  const changed = previous && (previous.date !== template.date || previous.frequency !== template.frequency);
  const skippedOccurrences = changed
    ? data.skippedOccurrences?.filter((row) => row.recurringId !== template.id)
    : data.skippedOccurrences;
  return displayOccurrences({ ...data, recurring: [template], skippedOccurrences }, template.date, end)
    .filter((row) => !row.isPaid)
    .slice(0, PREVIEW_OCCURRENCES);
}

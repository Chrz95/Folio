import { occurrenceDate } from '../budget/recurrence.js';
import { isScheduleDateEnabled } from './schedulePolicy.js';
import type { ScheduleData } from './schedulePolicy.js';
import { AUTOMATIC } from './automatic.constants.js';
interface AutomaticData extends Partial<ScheduleData> {
  recurring: { id: string; date: string; frequency: string }[];
  transactions: { recurringId: string | null; date: string }[];
}
/** Select enabled, due, unpaid instances without making writes or changing schedule anchors.
 * @param {AutomaticData} data - Current rules, policy and postings. @param {string} today - Workspace-local date.
 * @returns {{recurringId: string; date: string}[]} Due instances within the existing expansion bound. */
export function automaticOccurrences(data: AutomaticData, today: string) {
  const paid = new Set(data.transactions.map((row) => `${row.recurringId}:${row.date}`));
  const result: { recurringId: string; date: string }[] = [];
  for (const template of data.recurring) {
    const control = data.scheduleSettings?.find((row) => row.recurringId === template.id);
    if (!control?.autoConfirm || !control.autoConfirmFrom || control.isPaused) {
      continue;
    }
    for (let index = 0; index < AUTOMATIC.maximumOccurrences; index++) {
      const date = occurrenceDate(template.date, template.frequency, index);
      if (date > today || (control.endDate && date > control.endDate)) {
        break;
      }
      if (
        date >= control.autoConfirmFrom &&
        !paid.has(`${template.id}:${date}`) &&
        isScheduleDateEnabled(template.id, date, data)
      ) {
        result.push({ recurringId: template.id, date });
      }
      if (template.frequency === 'once') {
        break;
      }
    }
  }
  return result;
}

import { isScheduleDateEnabled } from '../schedules/schedulePolicy';
import type { BudgetData, Occurrence, Frequency } from '../../types/budget';
import { VALUE } from '../../constants/app.constants';
import { dateKey } from '../../utils/format';
/** Preserve the original day when clamping month-end and leap-year occurrences.
 * @param {string} startDate - Original date.
 * @param {Frequency} frequency - Schedule interval.
 * @param {number} index - Occurrence number.
 * @returns {string} Calendar date. */
export function occurrenceDate(startDate: string, frequency: Frequency, index: number) {
  if (frequency === 'once') {
    return startDate;
  }
  const value = new Date(`${startDate}T12:00:00`);
  const originalDay = value.getDate();
  if (frequency === 'weekly') {
    value.setDate(originalDay + index * VALUE.daysPerWeek);
  } else {
    value.setDate(1);
    value.setMonth(value.getMonth() + index * (frequency === 'yearly' ? VALUE.monthCount : 1));
    const finalDay = new Date(value.getFullYear(), value.getMonth() + 1, 0).getDate();
    value.setDate(Math.min(originalDay, finalDay));
  }
  return dateKey(value);
}
/** Expand bounded schedules into calendar occurrences, retaining posted status.
 * @param {BudgetData} data - Transactions and recurring templates.
 * @param {string} from - Inclusive range start.
 * @param {string} to - Inclusive range end.
 * @returns {Occurrence[]} Ordered planned occurrences. */
export function getOccurrences(data: BudgetData, from: string, to: string): Occurrence[] {
  const occurrences: Occurrence[] = [];
  const posted = new Set(
    data.transactions.filter((row) => row.recurringId).map((row) => `${row.recurringId}:${row.date}`),
  );
  for (const template of data.recurring) {
    for (let index = 0; index < VALUE.maximumOccurrences; index += 1) {
      if (template.frequency === 'once' && index > 0) {
        break;
      }
      const date = occurrenceDate(template.date, template.frequency, index);
      if (date > to) {
        break;
      }
      if (date >= from) {
        const isPaid = posted.has(`${template.id}:${date}`);
        if (!isPaid && !isScheduleDateEnabled(template.id, date, data)) {
          continue;
        }
        occurrences.push({
          ...template,
          date,
          occurrenceId: `${template.id}:${date}`,
          isPaid,
        });
      }
    }
  }
  return occurrences.sort((first, second) => first.date.localeCompare(second.date));
}

/** Check an occurrence against the original schedule.
 * @param {string} start - Original date.
 * @param {string} frequency - Recurrence rule.
 * @param {string} candidate - Requested posting date.
 * @returns {number | null} Zero-based position, or null outside the series. */
export function occurrenceIndex(start: string, frequency: Frequency, candidate: string) {
  if (frequency === 'once') {
    return candidate === start ? 0 : null;
  }
  if (candidate < start) {
    return null;
  }
  const origin = new Date(`${start}T12:00:00Z`);
  const target = new Date(`${candidate}T12:00:00Z`);
  let index = target.getUTCFullYear() - origin.getUTCFullYear();
  if (frequency === 'monthly') {
    index = index * MONTHS_PER_YEAR + target.getUTCMonth() - origin.getUTCMonth();
  }
  if (frequency === 'weekly') {
    const millisecondsPerWeek = 604800000;
    index = (target.getTime() - origin.getTime()) / millisecondsPerWeek;
  }
  return Number.isInteger(index) && occurrenceDate(start, frequency, index) === candidate ? index : null;
}

/** Check exact membership without losing month-end anchors.
 * @param {string} start - Original date. @param {Frequency} frequency - Recurrence.
 * @param {string} candidate - Candidate date. @returns {boolean} Exact occurrence membership. */
export function isOccurrence(start: string, frequency: Frequency, candidate: string) {
  return occurrenceIndex(start, frequency, candidate) !== null;
}

const MONTHS_PER_YEAR = 12;

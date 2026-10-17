import type { ActualSource, SourceRow } from './source';
import type { Frequency } from '../../types/budget';
import { date, text } from './source';
import { ACTUAL } from './actual.constants';
import { occurrenceDate, isOccurrence } from '../transactions/recurrence';
/** Resolve Actual's derived local progress only when it belongs to the current base-date revision.
 * @param {SourceRow} row - Native next-date row. @returns {string} Effective source next due date. */
export function actualNextDate(row: SourceRow): string {
  const base = date(row.base_next_date);
  if (!Number.isSafeInteger(row.base_next_date_ts) || !Number.isSafeInteger(row.local_next_date_ts)) {
    throw new Error('Schedule next date: invalid revision timestamps.');
  }
  return row.local_next_date_ts === row.base_next_date_ts ? date(row.local_next_date) : base;
}
/** Retain the anchor and installment ending while suppressing dates already advanced in Actual.
 * @param {ActualSource} source - Native snapshot. @param {SourceRow} schedule - Native schedule.
 * @param {string} start - First original occurrence. @param {Frequency} frequency - Supported recurrence.
 * @param {string | null} endDate - Inclusive installment ending. @returns {string[]} Reversible skipped dates. */
export function sourceSkippedDates(
  source: ActualSource,
  schedule: SourceRow,
  start: string,
  frequency: Frequency,
  endDate: string | null,
): string[] {
  const matches = (source.schedules_next_date ?? []).filter((row) => !row.tombstone && row.schedule_id === schedule.id);
  if (matches.length > 1) {
    throw new Error('Schedule next date: multiple live progress rows require manual review.');
  }
  const completed = schedule.completed === 1;
  const next = matches[0] ? actualNextDate(matches[0]) : start;
  if (next < start || !isOccurrence(start, frequency, next)) {
    throw new Error(`Schedule next date ${next} is outside the supported recurrence pattern.`);
  }
  if (completed && !endDate && frequency !== 'once') {
    throw new Error('Completed schedule has no representable final date. Recreate it manually.');
  }
  const skipped: string[] = [];
  for (let index = 0; index < ACTUAL.scheduleOccurrences; index += 1) {
    const candidate = occurrenceDate(start, frequency, index);
    if ((endDate && candidate > endDate) || (!completed && candidate >= next)) {
      return skipped;
    }
    skipped.push(candidate);
    if (frequency === 'once') {
      return skipped;
    }
  }
  throw new Error(`Schedule ${text(schedule.id)} next date exceeds the supported occurrence limit.`);
}

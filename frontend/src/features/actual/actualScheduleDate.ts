import { z } from 'zod';
import { ACTUAL } from './actual.constants';
import { occurrenceDate } from '../transactions/recurrence';
import { parseScheduleValue } from './actualScheduleErrors';
const recurrenceSchema = z
  .object({
    start: z.iso.date(),
    frequency: z.enum(['weekly', 'monthly', 'yearly']),
    interval: z.literal(1).optional(),
    patterns: z
      .array(
        z.object({ type: z.enum(['day', 'SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']), value: z.number().int() }).strict(),
      )
      .optional(),
    skipWeekend: z.literal(false).optional(),
    weekendSolveMode: z.enum(['before', 'after']).optional(),
    endMode: z.enum(['never', 'on_date', 'after_n_occurrences']).optional(),
    endDate: z.unknown().optional(),
    endOccurrences: z.unknown().optional(),
  })
  .strict();
const occurrenceCount = z.number().int().min(1).max(ACTUAL.scheduleOccurrences);
/** Read Actual's editor defaults and normalize only exactly representable recurrence dates.
 * @param {unknown} value - Rule date. @returns {object} Anchor, frequency and inclusive ending. */
export function readScheduleDate(value: unknown) {
  if (typeof value === 'string') {
    return {
      start: parseScheduleValue(z.iso.date(), value, 'Schedule date'),
      frequency: 'once' as const,
      endDate: null,
    };
  }
  const repeat = parseScheduleValue(recurrenceSchema, value, 'Schedule date');
  let { start } = repeat;
  const patterns = repeat.patterns ?? [];
  if (repeat.frequency === 'monthly' && patterns.length) {
    const day = patterns[0]!.value;
    if (patterns.length !== 1 || patterns[0]!.type !== 'day' || day < 1 || day > ACTUAL.monthEnd) {
      throw new Error('Schedule date.patterns: only one monthly day from 1 to 28 is supported.');
    }
    const candidate = `${start.slice(0, ACTUAL.monthDigits + 1)}-${String(day).padStart(ACTUAL.isoDayDigits, '0')}`;
    start = candidate >= start ? candidate : occurrenceDate(candidate, 'monthly', 1);
  }
  const anchor = new Date(`${start}T12:00:00Z`);
  if (
    (repeat.frequency === 'monthly' && anchor.getUTCDate() > ACTUAL.monthEnd) ||
    (repeat.frequency === 'yearly' &&
      anchor.getUTCMonth() + 1 === ACTUAL.february &&
      anchor.getUTCDate() === ACTUAL.leapDay)
  ) {
    throw new Error(
      'Schedule date: month-end/leap-day rules skip dates in Actual; recreate their date policy manually.',
    );
  }
  let endDate: string | null = null;
  if (repeat.endMode === 'on_date') {
    endDate = parseScheduleValue(z.iso.date(), repeat.endDate, 'Schedule date.endDate');
  } else if (repeat.endMode === 'after_n_occurrences') {
    const count = parseScheduleValue(occurrenceCount, repeat.endOccurrences, 'Schedule date.endOccurrences');
    endDate = parseScheduleValue(
      z.iso.date(),
      occurrenceDate(start, repeat.frequency, count - 1),
      'Schedule date.endOccurrences',
    );
  }
  if (endDate && endDate < start) {
    throw new Error('Schedule date.endDate must be on or after its first payment.');
  }
  return { start, frequency: repeat.frequency, endDate };
}

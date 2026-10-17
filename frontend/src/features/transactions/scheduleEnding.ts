import { z } from 'zod';
import { occurrenceDate, occurrenceIndex } from './recurrence';
export const SCHEDULE_ENDING = { maximum: 5000, defaultCount: '6' } as const;
export interface EndingInput {
  date: string;
  frequency: 'once' | 'weekly' | 'monthly' | 'yearly';
  endDate?: string | null;
  repetitions?: number;
  countFrom?: string;
}
/** Resolve either an inclusive ending or a counted span while retaining the original recurrence anchor.
 * @param {EndingInput} input - Mutation fields. @returns {string | null | undefined} Requested ending or unchanged. */
export function resolveScheduleEnding(input: EndingInput): string | null | undefined {
  if (input.endDate !== undefined && input.repetitions !== undefined) {
    throw new Error('Choose either a final date or a number of repetitions.');
  }
  if (input.countFrom !== undefined && input.repetitions === undefined) {
    throw new Error('A repetition start requires a number of repetitions.');
  }
  if (!z.iso.date().safeParse(input.date).success) {
    throw new Error('Choose a valid due date.');
  }
  if (input.repetitions !== undefined) {
    const count = input.repetitions;
    if (
      !Number.isInteger(count) ||
      count < 1 ||
      count > SCHEDULE_ENDING.maximum ||
      (input.frequency === 'once' && count !== 1)
    ) {
      throw new Error('Enter a whole repetition count from 1 to 5,000; one-time schedules allow only 1.');
    }
    const from = input.countFrom ?? input.date;
    const index = z.iso.date().safeParse(from).success ? occurrenceIndex(input.date, input.frequency, from) : null;
    if (index === null) {
      throw new Error('The repetition start must be a date in this schedule.');
    }
    if (index + count > SCHEDULE_ENDING.maximum) {
      throw new Error('This count exceeds the 5,000-date limit from the original schedule anchor.');
    }
    const finalDate = occurrenceDate(input.date, input.frequency, index + count - 1);
    if (!z.iso.date().safeParse(finalDate).success) {
      throw new Error('Choose fewer repetitions; the final date is outside the supported calendar.');
    }
    return finalDate;
  }
  if (
    input.endDate !== undefined &&
    input.endDate !== null &&
    (!z.iso.date().safeParse(input.endDate).success || input.endDate < input.date)
  ) {
    throw new Error('The final payment date must be on or after the schedule start.');
  }
  return input.endDate;
}

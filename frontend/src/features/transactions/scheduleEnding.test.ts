import { describe, expect, it } from 'vitest';
import { resolveScheduleEnding } from './scheduleEnding';
import { resolveScheduleEnding as serverEnding } from '../../../../backend/src/features/budget/scheduleEnding';
import type { EndingInput } from './scheduleEnding';
describe('finite repetition boundaries in both adapters', () => {
  it.each([
    ['monthly', '2028-01-31', '2028-01-31', 3, '2028-03-31'],
    ['monthly', '2028-01-31', '2028-02-29', 3, '2028-04-30'],
    ['yearly', '2028-02-29', '2029-02-28', 4, '2032-02-29'],
    ['weekly', '2026-10-18', '2026-10-25', 3, '2026-11-08'],
    ['once', '2026-10-18', '2026-10-18', 1, '2026-10-18'],
  ] as const)('resolves %s count from %s / %s without anchor drift', (frequency, date, countFrom, repetitions, end) => {
    const input = { date, frequency, countFrom, repetitions };
    expect(resolveScheduleEnding(input)).toBe(end);
    expect(serverEnding(input)).toBe(end);
  });
  it.each([0, -1, 1.5, NaN, 5001])('rejects invalid count %s', (repetitions) => {
    const input = { date: '2026-10-18', frequency: 'monthly' as const, repetitions };
    expect(() => resolveScheduleEnding(input)).toThrow(/whole/);
    expect(() => serverEnding(input)).toThrow(/whole/);
  });
  it('preserves unspecified endings and accepts explicit clearing, with no ambiguous or invalid spans', () => {
    const input = { date: '2026-10-18', frequency: 'monthly' as const };
    expect(resolveScheduleEnding(input)).toBeUndefined();
    expect(resolveScheduleEnding({ ...input, endDate: null })).toBeNull();
    const invalid: EndingInput[] = [
      { ...input, repetitions: 3, endDate: '2027-10-18' },
      { ...input, countFrom: '2026-10-18' },
      { ...input, repetitions: 3, countFrom: '2026-11-19' },
      { ...input, endDate: '2026-10-17' },
      { ...input, frequency: 'once', repetitions: 2 },
      { ...input, repetitions: 5000, countFrom: '2026-11-18' },
      { date: '9999-10-18', frequency: 'yearly', repetitions: 2 },
    ];
    for (const row of invalid) {
      expect(() => resolveScheduleEnding(row)).toThrow();
      expect(() => serverEnding(row)).toThrow();
    }
  });
});

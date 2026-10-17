import { describe, expect, it } from 'vitest';
import { actualFixture } from '../../../../scripts/actualFixtures';
import { convertActual } from './convertActual';
import { actualNextDate, sourceSkippedDates } from './actualNextDate';
import { actualPlan, mergeActual } from './actualMerge';
import { editorOccurrences } from '../transactions/editorOccurrences';
import { actualFileSchema } from './actualSchema';
/** Build a fictional progress row. @returns {object} Actual revision and date state. */
function progress() {
  return {
    id: 'next',
    schedule_id: 'rent',
    base_next_date: 20261003,
    local_next_date: 20261203,
    base_next_date_ts: 50,
    local_next_date_ts: 50,
    tombstone: 0,
  };
}
describe('Actual next due date progress', () => {
  it('selects local progress only for the matching base revision, otherwise the current base', () => {
    expect(actualNextDate(progress())).toBe('2026-12-03');
    expect(actualNextDate({ ...progress(), base_next_date: 20261103, base_next_date_ts: 60 })).toBe('2026-11-03');
    expect(() => actualNextDate({ ...progress(), local_next_date: 20260230 })).toThrow();
    expect(() => actualNextDate({ ...progress(), base_next_date_ts: null })).toThrow(/revision/);
  });
  it('preserves historical links, the anchor and counted ending while advancing the next unpaid date', () => {
    const source = actualFixture();
    source.schedules_next_date = [progress()];
    const conditions = JSON.parse(String(source.rules[0]!.conditions));
    Object.assign(conditions[2].value, { endMode: 'after_n_occurrences', endOccurrences: 4 });
    source.rules[0]!.conditions = JSON.stringify(conditions);
    const file = convertActual(source, JSON.stringify({ id: 'progress-fixture' }));
    expect(file.exclusions).toHaveLength(0);
    expect(file.recurring[0]!.date).toBe('2026-10-03');
    expect(file.scheduleSettings[0]!.endDate).toBe('2027-01-03');
    expect(file.skippedOccurrences.map((row) => row.date)).toEqual(['2026-10-03', '2026-11-03']);
    expect(file.transactions.find((row) => row.date === '2026-10-03' && row.recurringId)?.recurringId).toBe(
      file.recurring[0]!.id,
    );
    const plan = actualPlan({ accounts: [], transactions: [], recurring: [] }, file);
    expect(plan.rows.skippedOccurrences.map((row) => row.date)).toEqual(['2026-11-03']);
    const data = { ...mergeActual({ accounts: [], transactions: [], recurring: [] }, plan.rows), budgets: [] };
    expect(editorOccurrences(data, file.recurring[0]!).map((row) => row.date)).toEqual(['2026-12-03', '2027-01-03']);
    expect(Object.values(actualPlan(data, file).added).every((value) => value === 0)).toBe(true);
  });
  it('upgrades an unchanged legacy import with reviewed skips only, retaining payment and pause state', () => {
    const source = actualFixture();
    const legacy = convertActual(source, JSON.stringify({ id: 'legacy-progress' }));
    const empty = { accounts: [], transactions: [], recurring: [] };
    const saved = {
      ...mergeActual(empty, actualPlan(empty, legacy).rows),
      scheduleSettings: legacy.scheduleSettings.map((row) => ({ ...row, isPaused: false })),
    };
    source.schedules_next_date = [progress()];
    const file = convertActual(source, JSON.stringify({ id: 'legacy-progress' }));
    const plan = actualPlan(saved, file);
    expect(plan.added).toMatchObject({ transactions: 0, recurring: 0, scheduleSettings: 0, skippedOccurrences: 1 });
    const upgraded = mergeActual(saved, plan.rows);
    expect(upgraded.transactions).toEqual(saved.transactions);
    expect(upgraded.scheduleSettings[0]!.isPaused).toBe(false);
    expect(() =>
      actualPlan(upgraded, {
        ...file,
        skippedOccurrences: [{ recurringId: file.recurring[0]!.id, date: '2026-11-04' }],
      }),
    ).toThrow(/outside/);
    expect(actualFileSchema.parse({ ...file, skippedOccurrences: undefined }).skippedOccurrences).toEqual([]);
  });
  it('ignores tombstoned progress and rejects duplicate or off-pattern dates instead of guessing', () => {
    const source = actualFixture();
    source.schedules_next_date = [{ ...progress(), tombstone: 1 }];
    expect(sourceSkippedDates(source, source.schedules[0]!, '2026-10-03', 'monthly', null)).toEqual([]);
    source.schedules_next_date = [progress(), { ...progress(), id: 'duplicate' }];
    expect(() => sourceSkippedDates(source, source.schedules[0]!, '2026-10-03', 'monthly', null)).toThrow(/multiple/);
    source.schedules_next_date = [{ ...progress(), local_next_date: 20261104 }];
    const file = convertActual(source, JSON.stringify({ id: 'bad-progress' }));
    expect(file.recurring).toHaveLength(0);
    expect(file.exclusions[0]!.reason).toContain('next date');
  });
  it('retains completed installment endings and does not revive a completed one-time date', () => {
    const source = actualFixture();
    const schedule = { ...source.schedules[0]!, completed: 1 };
    expect(sourceSkippedDates(source, schedule, '2026-10-03', 'monthly', '2026-12-03')).toEqual([
      '2026-10-03',
      '2026-11-03',
      '2026-12-03',
    ]);
    expect(sourceSkippedDates(source, schedule, '2026-10-03', 'once', null)).toEqual(['2026-10-03']);
    expect(() => sourceSkippedDates(source, schedule, '2026-10-03', 'monthly', null)).toThrow(/final date/);
  });
});

import { describe, expect, it } from 'vitest';
import { actualFixture } from '../../../../scripts/actualFixtures';
import { convertActual } from './convertActual';
import { actualReplacement } from './actualReplacement';
import { validateBackupRelations } from '../backup/backupRelations';
describe('Actual overwrite conversion', () => {
  it('preserves source balances, paused endings and valid progress without paid/skip conflicts', () => {
    const source = actualFixture();
    source.schedules_next_date = [
      {
        id: 'next',
        schedule_id: 'rent',
        base_next_date: 20261003,
        local_next_date: 20261203,
        base_next_date_ts: 10,
        local_next_date_ts: 10,
      },
    ];
    const file = convertActual(source, JSON.stringify({ id: 'replacement' }));
    const data = actualReplacement(file);
    expect(() => validateBackupRelations(data)).not.toThrow();
    expect(data.accounts).toEqual(file.accounts);
    expect(data.transactions).toEqual(file.transactions);
    expect(data.skippedOccurrences.map((row) => row.date)).toEqual(['2026-11-03']);
    expect(data.scheduleSettings.every((row) => row.isPaused)).toBe(true);
    expect(data.receipts).toEqual([]);
    expect(data.goals).toEqual([]);
  });
  it('rejects malformed graphs and balance mismatches instead of preparing a destructive replacement', () => {
    const file = convertActual(actualFixture(), JSON.stringify({ id: 'bad-replacement' }));
    expect(() => actualReplacement({ ...file, balances: [] })).toThrow(/balances/);
    expect(() =>
      actualReplacement({ ...file, skippedOccurrences: [{ recurringId: file.recurring[0]!.id, date: '2026-10-04' }] }),
    ).toThrow(/outside/);
  });
});

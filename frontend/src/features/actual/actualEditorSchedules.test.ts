import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import initSqlJs from 'sql.js';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { actualEditorFixture, actualZipFixture, actualMigrationFixture } from '../../../../scripts/actualFixtures';
import { convertActual } from './convertActual';
import { readActualZip } from './actualZip';
import { readActualDatabase } from './readActualDatabase';
import { actualPlan, mergeActual } from './actualMerge';
import { readScheduleDate } from './actualScheduleDate';
import { scheduleDiagnostic } from './actualScheduleDiagnostics';
import { ACTUAL } from './actual.constants';
const SQL = await initSqlJs();
const root = resolve('.test-data');
const metadata = JSON.stringify({ id: 'editor-fixture' });
const empty = { accounts: [], recurring: [], transactions: [] };
let directory: string;
beforeEach(() => {
  mkdirSync(root, { recursive: true });
  directory = mkdtempSync(join(root, 'actual-editor-'));
});
afterEach(() => {
  if (!directory.startsWith(`${root}/actual-editor-`)) {
    throw new Error('Unsafe cleanup');
  }
  rmSync(directory, { recursive: true, force: true });
});
/** Read the fictional editor's recurring date configuration. @returns {Record<string, unknown>} Editable date. */
function config(): Record<string, unknown> {
  return JSON.parse(String(actualEditorFixture().rules[0]!.conditions))[2].value;
}
describe('Actual recurrence editor format regression', () => {
  it('imports fifteen editor-created schedules from a real native SQLite ZIP and keeps balances unchanged', () => {
    const source = actualEditorFixture();
    const base = source.rules[0]!;
    source.schedules = [];
    source.rules = [];
    for (let index = 0; index < 15; index += 1) {
      const id = index === 0 ? 'rent' : `editor-${index}`;
      source.schedules.push({ id, rule: `${id}-rule`, name: `Πληρωμή ${index + 1}` });
      const conditions = JSON.parse(String(base.conditions));
      if (index === 14) {
        conditions[3].value = 250000;
      }
      source.rules.push({
        ...base,
        id: `${id}-rule`,
        conditions: JSON.stringify(conditions),
        actions: JSON.stringify([{ op: 'link-schedule', value: id }]),
      });
    }
    const native = readActualZip(actualZipFixture(directory, source));
    const db = new SQL.Database(native.database);
    try {
      const file = readActualDatabase(db, JSON.stringify({ id: 'fixture-budget' }));
      expect(file.exclusions).toEqual([]);
      expect(file.recurring).toHaveLength(15);
      expect(file.recurring.every((row) => row.frequency === 'monthly' && row.date === '2026-10-03')).toBe(true);
      expect(file.recurring[14]!.type).toBe('income');
      expect(file.scheduleSettings.every((row) => row.isPaused && row.endDate === null)).toBe(true);
      const plan = actualPlan(empty, file);
      expect(plan.accountRows.map((row) => row.after)).toEqual([6200, 2000]);
      expect(Object.values(actualPlan(mergeActual(empty, plan.rows), file).added).every((value) => value === 0)).toBe(
        true,
      );
    } finally {
      db.close();
    }
  });
  it('reads progress from a native ZIP table with live/tombstoned rows and preserves next due', () => {
    const source = actualEditorFixture();
    source.schedules_next_date = [
      {
        id: 'next',
        schedule_id: 'rent',
        base_next_date: 20261003,
        local_next_date: 20261203,
        base_next_date_ts: 10,
        local_next_date_ts: 10,
        tombstone: 0,
      },
      {
        id: 'deleted',
        schedule_id: 'rent',
        base_next_date: 20261003,
        local_next_date: 20271003,
        base_next_date_ts: 10,
        local_next_date_ts: 10,
        tombstone: 1,
      },
    ];
    const native = readActualZip(actualZipFixture(directory, source));
    const db = new SQL.Database(native.database);
    try {
      const file = readActualDatabase(db, metadata);
      expect(file.exclusions).toEqual([]);
      expect(file.skippedOccurrences.map((row) => row.date)).toEqual(['2026-10-03', '2026-11-03']);
      expect(actualPlan(empty, file).rows.skippedOccurrences.map((row) => row.date)).toEqual(['2026-11-03']);
    } finally {
      db.close();
    }
  });
  it('preserves mixed legacy rule orders, six installment endings and off-date payment history', () => {
    const source = actualMigrationFixture();
    const native = readActualZip(actualZipFixture(directory, source));
    const db = new SQL.Database(native.database);
    try {
      const file = readActualDatabase(db, metadata);
      expect(file.recurring).toHaveLength(15);
      expect(file.exclusions).toEqual([]);
      expect(file.transactions).toHaveLength(16);
      expect(file.scheduleSettings.filter((row) => row.endDate)).toHaveLength(6);
      expect(file.scheduleSettings.every((row) => row.isPaused)).toBe(true);
      expect(file.transactions.filter((row) => row.recurringId)).toHaveLength(13);
      expect(file.warnings).toContainEqual(expect.stringContaining('ordinary transactions: 3'));
      expect(file.warnings.filter((row) => row.startsWith('Unlinked payment:'))).toHaveLength(3);
      for (let index = 0; index < 3; index += 1) {
        const original = source.transactions[index]!;
        const expected = `2032-03-${String(index + 4).padStart(2, '0')}`;
        const posting = file.transactions.find((row) => row.date === expected && row.recurringId === null)!;
        expect(posting.amount).toBe(Math.abs(Number(original.amount)));
        expect(posting.date).toBe(expected);
      }
      const plan = actualPlan(empty, file);
      expect(plan.accountRows.every((row) => row.source === row.after)).toBe(true);
      expect(actualPlan(mergeActual(empty, plan.rows), file).added.transactions).toBe(0);
      const legacy = {
        ...file,
        recurring: [],
        scheduleSettings: [],
        transactions: file.transactions.map((row) => ({ ...row, recurringId: null })),
      };
      const target = mergeActual(empty, actualPlan(empty, legacy).rows);
      const upgrade = actualPlan(target, file);
      expect(upgrade.preservedUnlinkedPayments).toBe(13);
      expect(upgrade.added.transactions).toBe(0);
      expect(mergeActual(target, upgrade.rows).transactions).toEqual(target.transactions);
    } finally {
      db.close();
    }
  });
  it.each([null, '2020-01-01', undefined])(
    'ignores inactive endDate=%s and endOccurrences on never-ending rules',
    (endDate) => {
      expect(readScheduleDate({ ...config(), endDate, endOccurrences: 'unused' })).toEqual({
        start: '2026-10-03',
        frequency: 'monthly',
        endDate: null,
      });
    },
  );
  it.each([
    ['weekly', 4, '2026-10-24'],
    ['monthly', 7, '2027-04-03'],
    ['yearly', 2, '2027-10-03'],
    ['monthly', 1, '2026-10-03'],
  ])('converts %s after %s occurrences to the exact inclusive final date', (frequency, count, endDate) => {
    expect(
      readScheduleDate({ ...config(), frequency, patterns: [], endMode: 'after_n_occurrences', endOccurrences: count })
        .endDate,
    ).toBe(endDate);
  });
  it.each(['weekly', 'yearly'])('ignores inactive monthly patterns on %s rules as Actual does', (frequency) => {
    expect(readScheduleDate({ ...config(), frequency, patterns: [{ type: 'FR', value: -1 }] }).frequency).toBe(
      frequency,
    );
  });
  it.each([0, -1, 1.5, null, undefined, 5001])(
    'reports the exact invalid counted-ending field for %s',
    (endOccurrences) => {
      expect(() => readScheduleDate({ ...config(), endMode: 'after_n_occurrences', endOccurrences })).toThrow(
        /Schedule date.endOccurrences/,
      );
    },
  );
  it('uses only the active inclusive ending field', () => {
    expect(
      readScheduleDate({ ...config(), endMode: 'on_date', endDate: '2027-03-03', endOccurrences: 'unused' }).endDate,
    ).toBe('2027-03-03');
    expect(() => readScheduleDate({ ...config(), endMode: 'on_date', endDate: null })).toThrow(/date.endDate/);
  });
  it.each([
    ['2026-10-03', 3, '2026-10-03'],
    ['2026-10-17', 3, '2026-11-03'],
    ['2026-10-17', 28, '2026-10-28'],
    ['2026-12-31', 1, '2027-01-01'],
  ])('preserves the first actual monthly day from %s on %s', (start, value, first) => {
    const result = readScheduleDate({
      ...config(),
      start,
      patterns: [{ type: 'day', value }],
      endMode: 'after_n_occurrences',
      endOccurrences: 1,
    });
    expect(result.start).toBe(first);
    expect(result.endDate).toBe(first);
  });
  it.each(['interval', 'skipWeekend', 'frequency', 'patterns', 'unknown'])(
    'reports %s rather than a generic exclusion',
    (field) => {
      const value = { ...config() };
      if (field === 'interval') {
        value.interval = 2;
      }
      if (field === 'skipWeekend') {
        value.skipWeekend = true;
      }
      if (field === 'frequency') {
        value.frequency = 'daily';
      }
      if (field === 'patterns') {
        value.patterns = [{ type: 'day', value: -1 }];
      }
      if (field === 'unknown') {
        value.otherField = 'unsupported';
      }
      const source = actualEditorFixture();
      const conditions = JSON.parse(String(source.rules[0]!.conditions));
      conditions[2].value = value;
      source.rules[0]!.conditions = JSON.stringify(conditions);
      const file = convertActual(source, metadata);
      expect(file.exclusions[0]!.reason).toContain(field === 'unknown' ? 'otherField' : field);
      expect(JSON.parse(file.exclusions[0]!.diagnostic!).conditions).toBe(source.rules[0]!.conditions);
    },
  );
  it('accepts disabled matching and empty action options, preserving automation guards', () => {
    const source = actualEditorFixture();
    const conditions = JSON.parse(String(source.rules[0]!.conditions));
    conditions[3].options = { outflow: false, inflow: false };
    conditions[3].customName = 'Amount';
    source.rules[0]!.conditions = JSON.stringify(conditions);
    source.rules[0]!.actions = JSON.stringify([
      { op: 'link-schedule', value: 'rent' },
      { op: 'set', field: 'notes', value: 'Imported note', options: { template: '', formula: null } },
    ]);
    expect(convertActual(source, metadata).recurring[0]!.notes).toContain('Imported note');
    conditions[3].options.outflow = true;
    source.rules[0]!.conditions = JSON.stringify(conditions);
    expect(convertActual(source, metadata).exclusions[0]!.reason).toContain('amount.options');
  });
  it('bounds diagnostics and excludes historical rows and credentials', () => {
    const source = actualEditorFixture();
    const small = JSON.parse(scheduleDiagnostic(source.schedules[0]!, source.rules[0]));
    expect(Object.keys(small).sort()).toEqual([
      'actions',
      'conditions',
      'conditionsOp',
      'name',
      'ruleId',
      'scheduleId',
    ]);
    const large = JSON.parse(
      scheduleDiagnostic(source.schedules[0]!, {
        ...source.rules[0],
        conditions: 'x'.repeat(ACTUAL.diagnosticBytes + 1),
      }),
    );
    expect(large.omitted).toContain('size limit');
  });
});

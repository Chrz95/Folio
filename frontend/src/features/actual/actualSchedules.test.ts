import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import initSqlJs from 'sql.js';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { actualFixture, actualZipFixture } from '../../../../scripts/actualFixtures';
import { convertActual } from './convertActual';
import { readActualZip } from './actualZip';
import { readActualDatabase } from './readActualDatabase';
import { actualPlan, mergeActual } from './actualMerge';
import type { ActualSource } from './source';
const SQL = await initSqlJs();
const root = resolve('.test-data');
const metadata = JSON.stringify({ id: 'fixture-budget', budgetName: 'Fixture budget' });
const empty = { accounts: [], transactions: [], recurring: [] };
let directory: string;
beforeEach(() => {
  mkdirSync(root, { recursive: true });
  directory = mkdtempSync(join(root, 'actual-schedules-'));
});
afterEach(() => {
  if (!directory.startsWith(`${root}/actual-schedules-`)) {
    throw new Error('Unsafe cleanup');
  }
  rmSync(directory, { recursive: true, force: true });
});
/** Edit a fictional native schedule's rule. @param {ActualSource} source - Isolated fixture.
 * @returns {object} Mutable typed rule parts. */
function parts(source: ActualSource) {
  return {
    conditions: JSON.parse(String(source.rules[0]!.conditions)) as {
      op: string;
      field: string;
      value: unknown;
      type?: string;
    }[],
    actions: JSON.parse(String(source.rules[0]!.actions)) as { op: string; field?: string; value: unknown }[],
  };
}
/** Serialize edited rule parts. @param {ActualSource} source - Fixture.
 * @param {ReturnType<typeof parts>} rule - Edits. @returns {void} Native fields updated. */
function save(source: ActualSource, rule: ReturnType<typeof parts>) {
  source.rules[0]!.conditions = JSON.stringify(rule.conditions);
  source.rules[0]!.actions = JSON.stringify(rule.actions);
}
describe('native Actual recurring transaction compatibility', () => {
  it.each(['is', 'isapprox', 'isbetween'])(
    'decodes real SQLite with %s amounts and approximate date matching',
    (op) => {
      const source = actualFixture();
      const rule = parts(source);
      rule.conditions[2]!.op = 'isapprox';
      rule.conditions[2]!.type = 'date';
      rule.conditions[3]!.op = op;
      rule.conditions[3]!.value = op === 'isbetween' ? { num1: -401, num2: -200 } : -300;
      save(source, rule);
      const native = readActualZip(actualZipFixture(directory, source));
      const db = new SQL.Database(native.database);
      try {
        const file = readActualDatabase(db, new TextDecoder().decode(native.metadata));
        expect(file.exclusions).toEqual([]);
        expect(file.recurring[0]).toMatchObject({ amount: 300, frequency: 'monthly', reminderDays: 0 });
        expect(file.scheduleSettings[0]).toMatchObject({ isPaused: true, endDate: null });
        expect(file.recurring[0]!.notes).toContain('date matching tolerance');
        if (op === 'isbetween') {
          expect(file.recurring[0]!.notes).toContain('-401 to -200 cents');
          expect(file.recurring[0]!.notes).toContain('rounded midpoint: -300');
        }
        if (op === 'isapprox') {
          expect(file.recurring[0]!.notes).toContain('fixed estimate');
        }
        const plan = actualPlan(empty, file);
        expect(plan.accountRows.map((row) => row.after)).toEqual([6200, 2000]);
        expect(actualPlan(mergeActual(empty, plan.rows), file).added.recurring).toBe(0);
      } finally {
        db.close();
      }
    },
  );
  it.each(['weekly', 'monthly', 'yearly', 'once'])(
    'preserves %s recurrence and explicit inclusive end dates',
    (frequency) => {
      const source = actualFixture();
      const rule = parts(source);
      rule.conditions[2]!.value =
        frequency === 'once'
          ? '2026-10-03'
          : {
              start: '2026-10-03',
              frequency,
              interval: 1,
              patterns: [],
              skipWeekend: false,
              endMode: 'on_date',
              endDate: '2027-10-03',
            };
      save(source, rule);
      const file = convertActual(source, metadata);
      expect(file.recurring[0]!.frequency).toBe(frequency);
      expect(file.scheduleSettings[0]!.endDate).toBe(frequency === 'once' ? null : '2027-10-03');
    },
  );
  it('preserves plain category/notes actions and matching account/payee/amount actions', () => {
    const source = actualFixture();
    const rule = parts(source);
    rule.conditions[0]!.field = 'account';
    rule.conditions[1]!.field = 'payee';
    rule.actions.push(
      { op: 'set', field: 'category', value: 'food' },
      { op: 'set', field: 'notes', value: 'Landlord' },
      { op: 'set', field: 'amount', value: -300 },
      { op: 'set', field: 'account', value: 'bank' },
      { op: 'set', field: 'payee', value: 'shop' },
    );
    source.schedules[0]!.posts_transaction = 1;
    save(source, rule);
    const file = convertActual(source, metadata);
    expect(file.recurring[0]).toMatchObject({ category: 'Food', notes: 'Landlord', amount: 300 });
    expect(file.scheduleSettings[0]!.isPaused).toBe(true);
  });
  it('accepts an omitted payee and uses an available payee when the schedule has no name', () => {
    const source = actualFixture();
    source.schedules[0]!.name = '';
    expect(convertActual(source, metadata).recurring[0]!.name).toBe('Market');
    const rule = parts(source);
    rule.conditions.splice(1, 1);
    save(source, rule);
    expect(convertActual(source, metadata).recurring[0]!.name).toBe('Actual transaction');
  });
  it.each([-2000, 2000])('preserves the two account legs of a signed %s transfer schedule', (amount) => {
    const source = actualFixture();
    const rule = parts(source);
    rule.conditions[1]!.value = 'transfer-save';
    rule.conditions[3]!.value = amount;
    save(source, rule);
    const file = convertActual(source, metadata);
    const [bank, saveAccount] = file.accounts;
    expect(file.recurring[0]).toMatchObject({
      type: 'transfer',
      amount: 2000,
      category: 'Other',
      accountId: amount < 0 ? bank!.id : saveAccount!.id,
      destinationAccountId: amount < 0 ? saveAccount!.id : bank!.id,
    });
    expect(file.exclusions).toEqual([]);
    expect(() => actualPlan(empty, file)).not.toThrow();
  });
  it('adds newly supported schedules to an older import without changing existing historical postings', () => {
    const file = convertActual(actualFixture(), metadata);
    const oldFile = {
      ...file,
      recurring: [],
      scheduleSettings: [],
      transactions: file.transactions.map((row) => ({ ...row, recurringId: null })),
    };
    const target = mergeActual(empty, actualPlan(empty, oldFile).rows);
    const before = structuredClone(target.transactions);
    const plan = actualPlan(target, file);
    expect(plan.added.recurring).toBe(1);
    expect(plan.added.transactions).toBe(0);
    expect(plan.accountRows.every((row) => row.before === row.after)).toBe(true);
    const upgraded = mergeActual(target, plan.rows);
    expect(upgraded.transactions).toEqual(before);
    expect(actualPlan(upgraded, file).added.recurring).toBe(0);
    upgraded.transactions[0]!.amount += 1;
    expect(() => actualPlan(upgraded, file)).toThrow(/edited/);
  });
  it.each([
    'zero',
    'cross-zero',
    'bad-range',
    'changed-action',
    'template',
    'duplicate',
    'wrong-link',
    'daily',
    'interval',
    'missing-account',
    'bad-end',
    'patterns',
    'same-account',
  ])('excludes unsafe %s rules explicitly', (kind) => {
    const source = actualFixture();
    const rule = parts(source);
    if (kind === 'zero') {
      rule.conditions[3]!.value = 0;
    }
    if (kind === 'cross-zero') {
      Object.assign(rule.conditions[3]!, { op: 'isbetween', value: { num1: -10, num2: 10 } });
    }
    if (kind === 'bad-range') {
      Object.assign(rule.conditions[3]!, { op: 'isbetween', value: { num1: -10, num2: 1.5 } });
    }
    if (kind === 'changed-action') {
      rule.actions.push({ op: 'set', field: 'amount', value: -123 });
    }
    if (kind === 'template') {
      rule.actions.push({ op: 'set', field: 'notes', value: 'x', options: { template: true } } as never);
    }
    if (kind === 'duplicate') {
      rule.conditions.push(rule.conditions[0]!);
    }
    if (kind === 'wrong-link') {
      rule.actions[0]!.value = 'other';
    }
    if (kind === 'missing-account') {
      rule.conditions[0]!.value = 'missing';
    }
    const repeat = rule.conditions[2]!.value as Record<string, unknown>;
    if (kind === 'daily') {
      repeat.frequency = 'daily';
    }
    if (kind === 'interval') {
      repeat.interval = 2;
    }
    if (kind === 'bad-end') {
      Object.assign(repeat, { endMode: 'on_date', endDate: '2020-01-01' });
    }
    if (kind === 'patterns') {
      repeat.patterns = [{ type: 'day', value: -1 }];
    }
    if (kind === 'same-account') {
      rule.conditions[1]!.value = 'transfer-save';
      rule.conditions[0]!.value = 'save';
    }
    save(source, rule);
    const file = convertActual(source, metadata);
    expect(file.recurring).toEqual([]);
    expect(file.exclusions).toHaveLength(1);
    expect(file.exclusions[0]!.reason.length).toBeGreaterThan(0);
    expect(file.transactions.every((row) => row.recurringId === null)).toBe(true);
  });
});

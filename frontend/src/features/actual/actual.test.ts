import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import initSqlJs from 'sql.js';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { zipSync, strToU8 } from 'fflate';
import { actualFixture, actualZipFixture } from '../../../../scripts/actualFixtures';
import { readActualZip } from './actualZip';
import { readActualDatabase } from './readActualDatabase';
import { convertActual } from './convertActual';
import { actualPlan, mergeActual } from './actualMerge';
import { actualFileSchema } from './actualSchema';
import { ACTUAL } from './actual.constants';
const SQL = await initSqlJs();
const root = resolve('.test-data');
let directory: string;
const empty = { accounts: [], transactions: [], recurring: [], budgets: [] };
const metadata = JSON.stringify({ id: 'fixture-budget', budgetName: 'Fixture budget' });
beforeEach(() => {
  mkdirSync(root, { recursive: true });
  directory = mkdtempSync(join(root, 'actual-native-'));
});
afterEach(() => {
  if (!directory.startsWith(`${root}/actual-native-`)) {
    throw new Error('Unsafe cleanup');
  }
  rmSync(directory, { recursive: true, force: true });
});
/** Normalize the fictional source. @returns {import('./actualSchema').ActualFile} Import file. */
function fixture() {
  return convertActual(actualFixture(), metadata);
}
describe('native Actual exports and additive conversion', () => {
  it.each(['', 'budget/'])(
    'decodes an actual SQLite ZIP at %s and reconciles split/transfer/opening balances',
    (prefix) => {
      const bytes = actualZipFixture(directory, actualFixture(), prefix);
      const native = readActualZip(bytes);
      const db = new SQL.Database(native.database);
      let file;
      try {
        file = readActualDatabase(db, new TextDecoder().decode(native.metadata));
      } finally {
        db.close();
      }
      expect(file.transactions).toHaveLength(4);
      expect(file.recurring).toHaveLength(1);
      expect(file.scheduleSettings[0]?.isPaused).toBe(true);
      expect(file.clearances).toHaveLength(4);
      expect(file.transactions.find((row) => row.notes.includes('Food'))?.notes).toBe('Weekly shop\nFood');
      const plan = actualPlan(empty, file);
      expect(plan.accountRows.map((row) => row.source)).toEqual([6200, 2000]);
      expect(plan.accountRows.every((row) => row.source === row.after)).toBe(true);
      expect(plan.added.monthlyBudgets).toBe(1);
      expect(Object.values(actualPlan(mergeActual(empty, plan.rows), file).added)).toEqual([0, 0, 0, 0, 0, 0, 0]);
    },
  );
  it('rejects edited source identities, preserving unrelated destination collections', () => {
    const file = fixture();
    const plan = actualPlan(empty, file);
    const unrelated = { ...empty, goals: [{ name: 'Keep' }], receipts: [{ name: 'Receipt' }] };
    const merged = structuredClone(mergeActual(unrelated, plan.rows));
    expect(merged.goals).toEqual(unrelated.goals);
    expect(merged.receipts).toEqual(unrelated.receipts);
    merged.transactions[0]!.notes = 'Edited';
    expect(() => actualPlan(merged, file)).toThrow(/edited/);
  });
  it('preserves pause and clearing choices on repeat imports', () => {
    const file = fixture();
    const target = mergeActual(empty, actualPlan(empty, file).rows);
    const updated = {
      ...target,
      scheduleSettings: target.scheduleSettings.map((row) => ({ ...row, isPaused: false })),
      clearances: [],
    };
    expect(actualPlan(updated, file).added.scheduleSettings).toBe(0);
    expect(actualPlan(updated, file).added.clearances).toBe(0);
  });
  it.each(['split', 'transfer', 'account', 'amount', 'notes'])('blocks corrupt %s data', (kind) => {
    const source = actualFixture();
    if (kind === 'split') {
      source.transactions[2]!.amount = -999;
    }
    if (kind === 'transfer') {
      source.transactions[5]!.amount = 1999;
    }
    if (kind === 'account') {
      source.transactions[2]!.acct = 'missing';
    }
    if (kind === 'amount') {
      source.transactions[2]!.amount = 0.25;
    }
    if (kind === 'notes') {
      source.transactions[2]!.notes = 'x'.repeat(1001);
    }
    expect(() => convertActual(source, metadata)).toThrow();
  });
  it('resolves merged categories/payees and disambiguates long category labels', () => {
    const source = actualFixture();
    source.category_mapping.push({ id: 'old', transferId: 'food' });
    source.payee_mapping.push({ id: 'old-payee', targetId: 'shop' });
    source.transactions[2]!.category = 'old';
    source.transactions[2]!.description = 'old-payee';
    source.categories[0]!.name = 'A'.repeat(60);
    const file = convertActual(source, metadata);
    expect(file.customCategories[0]!.name.length).toBeLessThanOrEqual(40);
    expect(file.transactions[0]!.name).toBe('Market');
    expect(() => actualPlan(empty, file)).not.toThrow();
    source.category_mapping.push({ id: 'food', transferId: 'old' });
    expect(() => convertActual(source, metadata)).toThrow(/cycle/);
  });
  it.each(['month-end', 'weekend', 'extra-condition', 'end'])('lists unsupported %s schedules', (kind) => {
    const source = actualFixture();
    const rule = source.rules[0]!;
    const conditions = JSON.parse(String(rule.conditions));
    if (kind === 'month-end') {
      conditions[2].value.start = '2026-10-31';
    }
    if (kind === 'weekend') {
      conditions[2].value.skipWeekend = true;
    }
    if (kind === 'extra-condition') {
      conditions.push({ op: 'is', field: 'notes', value: 'x' });
    }
    if (kind === 'end') {
      conditions[2].value.endMode = 'after_n_occurrences';
    }
    rule.conditions = JSON.stringify(conditions);
    const file = convertActual(source, metadata);
    expect(file.recurring).toHaveLength(0);
    expect(file.exclusions).toHaveLength(1);
    expect(file.transactions.every((row) => !row.recurringId)).toBe(true);
  });
  it('checks source balances, duplicate keys, graph links and paused controls before any merge', () => {
    const original = fixture();
    for (const change of ['balance', 'duplicate', 'link', 'controls']) {
      const file = structuredClone(original);
      if (change === 'balance') {
        file.balances[0]!.amount += 1;
      }
      if (change === 'duplicate') {
        file.transactions.push(file.transactions[0]!);
      }
      if (change === 'link') {
        file.transactions[0]!.destinationAccountId = file.accounts[1]!.id;
      }
      if (change === 'controls') {
        file.scheduleSettings = [];
      }
      expect(() => actualPlan(empty, file)).toThrow();
    }
    expect(actualFileSchema.safeParse({ ...original, extra: true }).success).toBe(false);
  });
  it('rejects oversized, missing, mismatched and multiple-budget archives', () => {
    expect(() => readActualZip(new Uint8Array(ACTUAL.zipBytes + 1))).toThrow(/25 MiB/);
    for (const entries of [
      { 'db.sqlite': strToU8('bad') },
      { 'db.sqlite': strToU8('bad'), 'other/metadata.json': strToU8('{}') },
      { 'db.sqlite': strToU8('bad'), 'metadata.json': strToU8('{}'), 'other/db.sqlite': strToU8('bad') },
      { 'db.sqlite': strToU8('bad'), 'metadata.json': new Uint8Array(ACTUAL.metadataBytes + 1) },
    ]) {
      expect(() => readActualZip(zipSync(entries))).toThrow();
    }
  });
});

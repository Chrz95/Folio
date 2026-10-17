import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { zipSync, strToU8 } from 'fflate';
import type { ActualSource, SourceRow } from '../frontend/src/features/actual/source';
/** Fictional native source with source IDs that deliberately are not UUIDs.
 * @returns {ActualSource} Actual-shaped rows. */
export function actualFixture(): ActualSource {
  const base = {
    isParent: 0,
    isChild: 0,
    starting_balance_flag: 0,
    cleared: 1,
    reconciled: 0,
    transferred_id: null,
    parent_id: null,
    schedule: null,
    notes: null,
    category: 'food',
    description: 'shop',
    date: 20261001,
  };
  return {
    accounts: [
      { id: 'bank', name: 'Bank', closed: 0, offbudget: 0 },
      { id: 'save', name: 'Savings', closed: 1 },
    ],
    categories: [
      { id: 'food', name: 'Food', hidden: 0, is_income: 0 },
      { id: 'home', name: 'Housing', hidden: 0, is_income: 0 },
    ],
    payees: [
      { id: 'shop', name: 'Market', transfer_acct: null },
      { id: 'transfer-save', name: '', transfer_acct: 'save' },
    ],
    transactions: [
      { ...base, id: 'opening', acct: 'bank', amount: 10000, starting_balance_flag: 1 },
      { ...base, id: 'split', acct: 'bank', amount: -1500, isParent: 1, notes: 'Weekly shop' },
      { ...base, id: 'split/1', acct: 'bank', amount: -1000, isChild: 1, parent_id: 'split', notes: 'Food' },
      { ...base, id: 'split/2', acct: 'bank', amount: -500, isChild: 1, parent_id: 'split', category: 'home' },
      { ...base, id: 'out', acct: 'bank', amount: -2000, transferred_id: 'in', description: 'transfer-save' },
      { ...base, id: 'in', acct: 'save', amount: 2000, transferred_id: 'out', cleared: 0 },
      { ...base, id: 'paid', acct: 'bank', amount: -300, date: 20261003, schedule: 'rent' },
    ],
    schedules: [{ id: 'rent', name: 'Rent', rule: 'rent-rule', active: 1, completed: 0 }],
    rules: [
      {
        id: 'rent-rule',
        conditions_op: 'and',
        conditions: JSON.stringify([
          { op: 'is', field: 'acct', value: 'bank' },
          { op: 'is', field: 'description', value: 'shop' },
          {
            op: 'is',
            field: 'date',
            value: { start: '2026-10-03', frequency: 'monthly', patterns: [], skipWeekend: false },
          },
          { op: 'is', field: 'amount', value: -300 },
        ]),
        actions: JSON.stringify([{ op: 'link-schedule', value: 'rent' }]),
      },
    ],
    category_mapping: [],
    payee_mapping: [],
    preferences: [],
    reflect_budgets: [],
    zero_budgets: [{ id: 'oct-food', month: 202610, category: 'food', amount: 30000 }],
  };
}
/** Write and close a real isolated SQLite source, then package a native export for parser tests.
 * @param {string} directory - Disposable test directory. @param {ActualSource} source - Fictional rows.
 * @param {string} prefix - Optional nested folder. @returns {Uint8Array} Native ZIP bytes. */
export function actualZipFixture(directory: string, source = actualFixture(), prefix = '') {
  const path = join(directory, 'source.sqlite');
  const database = new Database(path);
  try {
    for (const [table, rows] of Object.entries(source)) {
      const columns = [...new Set(['id', ...rows.flatMap((row) => Object.keys(row))])];
      database.exec(`CREATE TABLE "${table}" (${columns.map((column) => `"${column}"`).join(',')})`);
      const insert = database.prepare(`INSERT INTO "${table}" VALUES (${columns.map(() => '?').join(',')})`);
      rows.forEach((row: SourceRow) => insert.run(...columns.map((column) => row[column] ?? null)));
    }
  } finally {
    database.close();
  }
  return zipSync({
    [`${prefix}db.sqlite`]: new Uint8Array(readFileSync(path)),
    [`${prefix}metadata.json`]: strToU8(JSON.stringify({ id: 'fixture-budget', budgetName: 'Fixture budget' })),
  });
}

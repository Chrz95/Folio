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
/** Reproduce Actual's recurrence editor serialization, including inactive ending fields and monthly day patterns.
 * @returns {ActualSource} Fictional ledger with the source editor's default rule shape. */
export function actualEditorFixture(): ActualSource {
  const source = actualFixture();
  const rule = source.rules[0]!;
  rule.conditions = JSON.stringify([
    { op: 'is', field: 'account', value: 'bank' },
    { op: 'is', field: 'payee', value: 'shop' },
    {
      op: 'isapprox',
      field: 'date',
      value: {
        start: '2026-10-03',
        frequency: 'monthly',
        interval: 1,
        patterns: [{ type: 'day', value: 3 }],
        skipWeekend: false,
        weekendSolveMode: 'before',
        endMode: 'never',
        endOccurrences: 1,
        endDate: '2026-10-17',
      },
    },
    { op: 'isapprox', field: 'amount', value: -300 },
  ]);
  return source;
}
/** Fictional migration sample covering observed rule shapes without copying uploaded names, amounts or identifiers.
 * @returns {ActualSource} Fifteen schedules, six installment endings and sixteen postings, three off the anchor date. */
export function actualMigrationFixture(): ActualSource {
  const source = actualFixture();
  source.transactions = [];
  source.schedules = [];
  source.rules = [];
  source.zero_budgets = [];
  const counts = [2, 3, 5, 7, 9, 12];
  for (let index = 0; index < 15; index += 1) {
    const id = `sample-schedule-${index}`;
    const day = index + 3;
    const account = index % 2 ? 'save' : 'bank';
    const amount = index === 14 ? 200000 : -(index + 1) * 250;
    const start = `2032-03-${String(day).padStart(2, '0')}`;
    const conditions = [
      { op: 'is', field: 'description', value: 'shop' },
      { op: 'is', field: 'acct', value: account },
      {
        op: 'isapprox',
        field: 'date',
        value: {
          start,
          frequency: 'monthly',
          ...(index === 14 ? {} : { interval: 1 }),
          patterns: [],
          skipWeekend: false,
          weekendSolveMode: 'after',
          endMode: index < counts.length ? 'after_n_occurrences' : 'never',
          endOccurrences: counts[index] ?? 1,
          endDate: '2032-02-01',
        },
      },
      { op: index === 3 ? 'is' : 'isapprox', field: 'amount', value: amount },
    ];
    const rotation = index % conditions.length;
    source.schedules.push({
      id,
      name: `Δοκιμαστικό ${index + 1}`,
      rule: `${id}-rule`,
      posts_transaction: index === 2 ? 1 : 0,
    });
    source.rules.push({
      id: `${id}-rule`,
      conditions_op: 'and',
      conditions: JSON.stringify([...conditions.slice(rotation), ...conditions.slice(0, rotation)]),
      actions: JSON.stringify([{ op: 'link-schedule', value: id }]),
    });
    source.transactions.push({
      id: `sample-posting-${index}`,
      schedule: id,
      acct: account,
      amount,
      description: 'shop',
      category: 'food',
      date: 20320300 + day + (index < 3 ? 1 : 0),
      cleared: 1,
    });
  }
  source.transactions.push({ ...source.transactions[14]!, id: 'sample-following-month', date: 20320417 });
  return source;
}

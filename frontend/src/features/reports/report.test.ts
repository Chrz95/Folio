import { describe, expect, it } from 'vitest';
import type { Transaction, BudgetData } from '../../types/budget';
import { statistics } from '../overview/statistics';
import { readSelection, resolvePeriod } from './period';
import { reportEntries, reportBuckets, reportChange } from './report';
import { buildReportCsv } from './reportExport';
const defaultSelection = readSelection(new URLSearchParams(), '2026-10-01');
/** Construct an actual posting for boundary and scope checks. @param {Partial<Transaction>} changes - Overrides.
 * @returns {Transaction} Actual ledger fixture. */
function entry(changes: Partial<Transaction> = {}): Transaction {
  return {
    id: 'expense',
    name: 'Shop',
    amount: 12345,
    type: 'expense',
    category: 'Groceries',
    accountId: 'checking',
    destinationAccountId: null,
    date: '2026-10-01',
    notes: '',
    createdAt: 1,
    recurringId: null,
    ...changes,
  };
}
describe('report calendar periods', () => {
  it('compares a January calendar month with the complete previous December', () => {
    expect(resolvePeriod({ ...defaultSelection, month: '2027-01' })).toEqual({
      error: '',
      current: { start: '2027-01-01', end: '2027-01-31' },
      previous: { start: '2026-12-01', end: '2026-12-31' },
    });
  });
  it('keeps leap-year and non-leap-year February boundaries exact', () => {
    expect(resolvePeriod({ ...defaultSelection, month: '2024-03' }).previous).toEqual({
      start: '2024-02-01',
      end: '2024-02-29',
    });
    expect(resolvePeriod({ ...defaultSelection, month: '2025-02' }).current).toEqual({
      start: '2025-02-01',
      end: '2025-02-28',
    });
  });
  it('compares full calendar years even when their day counts differ', () => {
    expect(resolvePeriod({ ...defaultSelection, period: 'yearly', year: '2024' })).toEqual({
      error: '',
      current: { start: '2024-01-01', end: '2024-12-31' },
      previous: { start: '2023-01-01', end: '2023-12-31' },
    });
  });
  it('compares equal inclusive civil-day custom spans across daylight-saving and leap days', () => {
    const original = process.env.TZ;
    process.env.TZ = 'Europe/Athens';
    try {
      expect(
        resolvePeriod({ ...defaultSelection, period: 'custom', start: '2026-03-28', end: '2026-03-30' }).previous,
      ).toEqual({ start: '2026-03-25', end: '2026-03-27' });
      expect(
        resolvePeriod({ ...defaultSelection, period: 'custom', start: '2024-03-01', end: '2024-03-01' }).previous,
      ).toEqual({ start: '2024-02-29', end: '2024-02-29' });
    } finally {
      if (original === undefined) {
        delete process.env.TZ;
      } else {
        process.env.TZ = original;
      }
    }
  });
  it.each([
    { month: '2026-13' },
    { month: '' },
    { period: 'yearly', year: '2026.5' },
    { period: 'custom', start: '2026-02-29', end: '2026-03-01' },
    { period: 'custom', start: '2026-10-02', end: '2026-10-01' },
    { period: 'custom', start: '2020-01-01', end: '2031-01-01' },
    { period: 'other' },
  ])('rejects invalid or unbounded report dates: %j', (selection) => {
    const result = resolvePeriod({ ...defaultSelection, ...selection });
    expect(result.error).toBeTruthy();
    expect(result.current).toBeUndefined();
  });
});
describe('report cash flow and portable output', () => {
  it('includes both boundaries, combines exact account/category scope, and ignores transfers', () => {
    const entries = [
      entry(),
      entry({ id: 'last', date: '2026-10-31' }),
      entry({ id: 'early', date: '2026-09-30' }),
      entry({ id: 'late', date: '2026-11-01' }),
      entry({ id: 'other-account', accountId: 'cash' }),
      entry({ id: 'near-category', category: 'Groceries plus' }),
      entry({ id: 'transfer', type: 'transfer', destinationAccountId: 'checking', accountId: 'cash' }),
    ];
    const selected = reportEntries(
      entries,
      { start: '2026-10-01', end: '2026-10-31' },
      { ...defaultSelection, accountId: 'checking', category: 'Groceries' },
    );
    expect(selected.map((item) => item.id)).toEqual(['expense', 'last']);
    expect(statistics(selected)).toMatchObject({ expenses: 24690, income: 0, savings: -24690 });
  });
  it('retains empty daily/monthly intervals and reconciles chart totals to selected recorded flows', () => {
    const entries = [
      entry({ date: '2024-02-29' }),
      entry({ type: 'income', id: 'pay', amount: 100000, date: '2024-02-29' }),
    ];
    const days = reportBuckets(entries, { start: '2024-02-28', end: '2024-03-01' });
    expect(days).toEqual([
      { label: '2024-02-28', income: 0, expenses: 0 },
      { label: '2024-02-29', income: 100000, expenses: 12345 },
      { label: '2024-03-01', income: 0, expenses: 0 },
    ]);
    const months = reportBuckets(entries, { start: '2024-01-01', end: '2024-12-31' });
    expect(months).toHaveLength(12);
    expect(months.reduce((sum, item) => sum + item.expenses, 0)).toBe(statistics(entries).expenses);
    expect(months.reduce((sum, item) => sum + item.income, 0)).toBe(statistics(entries).income);
  });
  it('uses signed changes and suppresses percentages for zero/negative baselines', () => {
    expect(reportChange(100, 0)).toEqual({ amount: 100, percent: null });
    expect(reportChange(100, -100)).toEqual({ amount: 200, percent: null });
    expect(reportChange(-100, 100)).toEqual({ amount: -200, percent: -200 });
    expect(reportChange(120, 100)).toEqual({ amount: 20, percent: 20 });
  });
  it('exports scoped comparisons, protects cells and preserves signed numbers', () => {
    const data: BudgetData = {
      transactions: [],
      recurring: [],
      budgets: [],
      accounts: [{ id: 'checking', name: '=HYPERLINK("bad")', openingBalance: 0 }],
    };
    const csv = buildReportCsv({
      data,
      selection: { ...defaultSelection, accountId: 'checking', category: '+Travel' },
      current: { start: '2026-10-01', end: '2026-10-31' },
      previous: { start: '2026-09-01', end: '2026-09-30' },
      totals: statistics([entry({ category: '+Travel' })]),
      prior: statistics([entry({ amount: 20000, category: 'Old, "archived"' })]),
    });
    expect(csv).toContain('2026-09-01 to 2026-09-30');
    expect(csv).toContain('"\'=HYPERLINK(""bad"")"');
    expect(csv).toContain('"\'+Travel"');
    expect(csv).toContain('"Category","Old, ""archived""",0,200,-200,');
    expect(csv).toContain('"Summary","Expenses",123.45,200,-76.55,');
    expect(csv).toContain('"Summary","Net savings",-123.45,-200,76.55,');
  });
});

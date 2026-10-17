import { describe, expect, it } from 'vitest';
import { buildForecast } from './forecast';
import type { BudgetData } from '../../types/budget';
const options = { startDate: '2026-10-16', days: 30, accountId: 'checking', threshold: 0, includeOverdue: false };
/** Create an isolated deterministic forecast fixture. @returns {BudgetData} Ledger and schedule. */
function fixture(): BudgetData {
  return {
    accounts: [
      { id: 'checking', name: 'Checking', openingBalance: 10000 },
      { id: 'savings', name: 'Savings', openingBalance: 20000 },
    ],
    budgets: [],
    transactions: [],
    recurring: [
      {
        id: 'bill',
        name: 'Bill',
        amount: 12000,
        type: 'expense',
        category: 'Housing',
        accountId: 'checking',
        destinationAccountId: null,
        date: '2026-10-18',
        frequency: 'once',
        reminderDays: 2,
        notes: '',
      },
    ],
  };
}
describe('account-aware forecasts', () => {
  it('projects a scheduled bill and identifies the first below-threshold ending balance', () => {
    const result = buildForecast(fixture(), options);
    expect(result.opening).toBe(10000);
    expect(result.closing).toBe(-2000);
    expect(result.firstWarning?.date).toBe('2026-10-18');
    expect(result.points).toHaveLength(31);
  });
  it('includes both transfer legs individually and cancels them in the combined view', () => {
    const data = fixture();
    const [bill] = data.recurring;
    if (!bill) {
      throw new Error('Missing fixture');
    }
    data.recurring = [{ ...bill, amount: 5000, type: 'transfer', destinationAccountId: 'savings' }];
    expect(buildForecast(data, options).closing).toBe(5000);
    expect(buildForecast(data, { ...options, accountId: 'savings' }).closing).toBe(25000);
    expect(buildForecast(data, { ...options, accountId: '' }).closing).toBe(30000);
  });
  it('does not double-count a paid occurrence or include future postings in today’s opening balance', () => {
    const data = fixture();
    const [bill] = data.recurring;
    if (!bill) {
      throw new Error('Missing fixture');
    }
    data.transactions = [{ ...bill, id: 'paid', recurringId: bill.id, createdAt: 0 }];
    const result = buildForecast(data, options);
    expect(result.opening).toBe(10000);
    expect(result.closing).toBe(-2000);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.isPlanned).toBe(false);
  });
  it('keeps overdue payments opt-in and moves them to today only when requested', () => {
    const data = fixture();
    const [bill] = data.recurring;
    if (!bill) {
      throw new Error('Missing fixture');
    }
    data.recurring = [{ ...bill, date: '2026-10-15' }];
    expect(buildForecast(data, options).closing).toBe(10000);
    const included = buildForecast(data, { ...options, includeOverdue: true });
    expect(included.closing).toBe(-2000);
    expect(included.events[0]?.effectiveDate).toBe('2026-10-16');
  });
});

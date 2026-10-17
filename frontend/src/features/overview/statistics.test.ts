import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { accountBalance, statistics } from './statistics';
import { getOccurrences } from '../transactions/recurrence';
import { createDemoSeed } from '../transactions/demoSeed.constants';
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-16T12:00:00Z'));
});
afterEach(() => vi.useRealTimers());
describe('financial calculations', () => {
  it('expands a one-time schedule once across an entire year', () => {
    const data = createDemoSeed();
    const [template] = data.recurring;
    if (!template) {
      throw new Error('Missing template');
    }
    data.recurring = [{ ...template, frequency: 'once' }];
    expect(getOccurrences(data, template.date, '2099-12-31')).toHaveLength(1);
  });
  it('does not count transfers as income or spending and keeps the total balance constant', () => {
    const data = createDemoSeed();
    const [source, destination] = data.accounts;
    if (!source || !destination) {
      throw new Error('Missing test accounts');
    }
    data.transactions = [];
    const initial = accountBalance(data);
    data.transactions.push({
      id: 'transfer',
      amount: 10000,
      type: 'transfer',
      name: 'Savings',
      category: 'Savings',
      accountId: source.id,
      destinationAccountId: destination.id,
      date: '2026-10-16',
      notes: '',
      recurringId: null,
      createdAt: 0,
    });
    expect(accountBalance(data)).toBe(initial);
    expect(accountBalance(data, source.id)).toBe(source.openingBalance - 10000);
    expect(accountBalance(data, destination.id)).toBe(destination.openingBalance + 10000);
    expect(statistics(data.transactions).income).toBe(0);
    expect(statistics(data.transactions).expenses).toBe(0);
  });
  it('keeps planned occurrences separate until an actual posting exists', () => {
    const data = createDemoSeed();
    const [template] = data.recurring;
    if (!template) {
      throw new Error('Missing rule');
    }
    data.transactions = [];
    const planned = getOccurrences(data, template.date, template.date);
    expect(planned[0]?.isPaid).toBe(false);
    data.transactions.push({ ...template, id: 'paid', createdAt: 0, recurringId: template.id });
    expect(getOccurrences(data, template.date, template.date)[0]?.isPaid).toBe(true);
  });
  it('handles zero income and exact category totals without NaN', () => {
    expect(statistics([])).toEqual({ income: 0, expenses: 0, savings: 0, savingsRate: 0, categories: [] });
  });
});

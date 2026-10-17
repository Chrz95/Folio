import { describe, expect, it } from 'vitest';
import type { BudgetData, RecurringTransaction, Transaction } from '../../types/budget';
import { calendarEntries, displayOccurrences, paymentStatus } from '../calendar/calendarEntries';
import { getOccurrences } from '../transactions/recurrence';
import { compareProximity, recurringRows, sortRecurringRows } from './recurringRows';
/** Create a deterministic rule. @param {string} name - Label. @param {string} date - Date.
 * @returns {RecurringTransaction} Once-only expense. */
function rule(name: string, date: string): RecurringTransaction {
  return {
    id: name,
    name,
    date,
    amount: 1000,
    type: 'expense',
    category: 'Housing',
    accountId: 'bank',
    destinationAccountId: null,
    notes: '',
    frequency: 'once',
    reminderDays: 0,
  };
}
/** Build a recorded payment using only ledger fields. @param {string} date - Posted date.
 * @param {string} recurringId - Original rule. @returns {Transaction} Historical payment. */
function posted(date: string, recurringId: string): Transaction {
  const { frequency: _frequency, reminderDays: _reminderDays, ...fields } = rule('Recorded', date);
  return { ...fields, id: 'posted', recurringId, createdAt: 0 };
}
/** Start with an empty display ledger. @returns {BudgetData} Isolated data. */
function fixture(): BudgetData {
  return { accounts: [{ id: 'bank', name: 'Bank', openingBalance: 0 }], recurring: [], transactions: [], budgets: [] };
}
describe('confirmation calendar and recurring proximity', () => {
  it.each([
    ['2026-10-16', false, 'overdue'],
    ['2026-10-17', false, 'unconfirmed'],
    ['2026-10-18', false, 'unconfirmed'],
    ['2026-10-16', true, 'confirmed'],
    ['2026-10-18', true, 'confirmed'],
  ])('classifies %s with confirmed=%s as %s', (date, confirmed, expected) => {
    expect(paymentStatus(date, confirmed, '2026-10-17')).toBe(expected);
  });
  it('displays every weekly date, including paused instances, with one recorded row for a paid occurrence', () => {
    const data = fixture();
    const template = { ...rule('Weekly', '2026-10-02'), frequency: 'weekly' as const };
    data.recurring = [template];
    data.scheduleSettings = [{ recurringId: template.id, isPaused: true, endDate: null }];
    data.transactions = [posted('2026-10-09', template.id)];
    const before = structuredClone(data);
    const entries = calendarEntries(data, '2026-10-01', '2026-10-31', '2026-10-17');
    expect(entries.map((row) => [row.entry.date, row.status])).toEqual([
      ['2026-10-02', 'overdue'],
      ['2026-10-09', 'confirmed'],
      ['2026-10-16', 'overdue'],
      ['2026-10-23', 'unconfirmed'],
      ['2026-10-30', 'unconfirmed'],
    ]);
    expect(entries.filter((row) => row.isPaused)).toHaveLength(4);
    expect(getOccurrences(data, '2026-10-01', '2026-10-31')).toHaveLength(1);
    expect(data).toEqual(before);
  });
  it('respects skips and endings while showing month-end and leap-year occurrences faithfully', () => {
    const data = fixture();
    data.recurring = [{ ...rule('Month', '2028-01-31'), frequency: 'monthly' }];
    data.scheduleSettings = [{ recurringId: 'Month', isPaused: true, endDate: '2028-03-31' }];
    data.skippedOccurrences = [{ recurringId: 'Month', date: '2028-02-29' }];
    expect(displayOccurrences(data, '2028-01-01', '2028-05-31').map((row) => row.date)).toEqual([
      '2028-01-31',
      '2028-03-31',
    ]);
    data.recurring = [{ ...rule('Leap', '2028-02-29'), frequency: 'yearly' }];
    expect(displayOccurrences(data, '2028-01-01', '2030-03-01').map((row) => row.date)).toEqual([
      '2028-02-29',
      '2029-02-28',
      '2030-02-28',
    ]);
  });
  it('keeps historical actual amounts and manually confirmed future transactions green', () => {
    const data = fixture();
    data.recurring = [rule('Bill', '2026-10-17')];
    data.transactions = [{ ...posted('2026-10-17', 'Bill'), name: 'Paid bill', amount: 750 }];
    const rows = calendarEntries(data, '2026-10-17', '2026-10-17', '2026-10-16');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.status).toBe('confirmed');
    expect(rows[0]!.entry.amount).toBe(750);
  });
  it('sorts by absolute civil-day distance, overdue ties first, and rules without unpaid dates last', () => {
    const data = fixture();
    data.recurring = [
      rule('Old', '2026-10-01'),
      rule('Tomorrow', '2026-10-18'),
      rule('Yesterday', '2026-10-16'),
      rule('Today', '2026-10-17'),
      rule('Confirmed', '2026-10-17'),
      rule('Distant', '2028-01-03'),
    ];
    data.transactions = [posted('2026-10-17', 'Confirmed')];
    const rows = recurringRows(data, '2026-10-17');
    expect(sortRecurringRows(rows, '2026-10-17', 'proximity', 'ascending').map((row) => row.template.name)).toEqual([
      'Today',
      'Yesterday',
      'Tomorrow',
      'Old',
      'Distant',
      'Confirmed',
    ]);
    expect(sortRecurringRows(rows, '2026-10-17', 'proximity', 'descending').at(-1)!.template.name).toBe('Confirmed');
    expect(data.recurring[0]!.name).toBe('Old');
  });
  it('chooses the closest unpaid occurrence and still counts older overdue instances', () => {
    const data = fixture();
    data.recurring = [{ ...rule('Monthly', '2026-10-01'), frequency: 'monthly' }];
    data.scheduleSettings = [{ recurringId: 'Monthly', isPaused: true, endDate: null }];
    const row = recurringRows(data, '2026-10-17')[0]!;
    expect(row.closest!.date).toBe('2026-11-01');
    expect(row.overdue).toBe(1);
    expect(row.isPaused).toBe(true);
  });
  it('includes the next annual occurrence after today is confirmed', () => {
    const data = fixture();
    data.recurring = [{ ...rule('Annual', '2026-10-17'), frequency: 'yearly' }];
    data.transactions = [posted('2026-10-17', 'Annual')];
    expect(recurringRows(data, '2026-10-17')[0]!.closest!.date).toBe('2027-10-17');
  });
  it('uses civil-day proximity over DST changes and supports name/amount sorting without changing source order', () => {
    expect(compareProximity('2026-10-24', '2026-10-26', '2026-10-25')).toBeLessThan(0);
    const data = fixture();
    data.recurring = [rule('Zulu', '2026-10-18'), { ...rule('Alpha', '2026-10-17'), amount: 2000 }];
    const rows = recurringRows(data, '2026-10-17');
    expect(sortRecurringRows(rows, '2026-10-17', 'name', 'ascending')[0]!.template.name).toBe('Alpha');
    expect(sortRecurringRows(rows, '2026-10-17', 'amount', 'ascending')[0]!.template.name).toBe('Zulu');
    expect(sortRecurringRows(rows, '2026-10-17', 'amount', 'descending')[0]!.template.name).toBe('Alpha');
    expect(rows[0]!.template.name).toBe('Zulu');
  });
});

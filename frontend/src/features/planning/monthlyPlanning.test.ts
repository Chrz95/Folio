import { describe, it, expect } from 'vitest';
import type { BudgetData, Transaction } from '../../types/budget';
import { monthlyPlans } from './monthlyPlanning';
import { goalProgress } from '../goals/goalProgress';
const base: BudgetData = {
  accounts: [],
  recurring: [],
  transactions: [],
  budgets: [{ category: 'Groceries', amount: 50000 }],
};
/** Construct a posting for testing category totals independently of account balances.
 * @param {string} date - Date. @param {number} amount - Cents. @param {Transaction['type']} type - Kind.
 * @returns {Transaction} Actual posting. */
function posting(date: string, amount: number, type: Transaction['type'] = 'expense'): Transaction {
  return {
    id: crypto.randomUUID(),
    name: 'Market',
    amount,
    type,
    category: 'Groceries',
    accountId: 'account',
    destinationAccountId: null,
    date,
    notes: '',
    createdAt: 1,
    recurringId: null,
  };
}
describe('exact-month allocations and positive rollover', () => {
  it('preserves the legacy baseline and only changes the explicitly selected month', () => {
    const data = {
      ...base,
      monthlyBudgets: [{ month: '2026-10-01', category: 'Groceries', amount: 30000, rollover: false }],
    };
    expect(monthlyPlans(data, '2026-09-01')[0]?.amount).toBe(50000);
    expect(monthlyPlans(data, '2026-10-01')[0]?.amount).toBe(30000);
    expect(monthlyPlans(data, '2026-11-01')[0]?.amount).toBe(50000);
  });
  it('carries consecutive positive remainders over year boundaries, excluding income and transfers', () => {
    const data = {
      ...base,
      monthlyBudgets: [
        { month: '2026-12-01', category: 'Groceries', amount: 30000, rollover: true },
        { month: '2027-01-01', category: 'Groceries', amount: 40000, rollover: true },
      ],
      transactions: [
        posting('2026-12-16', 20000),
        posting('2026-12-17', 100000, 'income'),
        posting('2026-12-18', 100000, 'transfer'),
        posting('2027-01-20', 25000),
      ],
    };
    expect(monthlyPlans(data, '2027-01-01')[0]).toMatchObject({ carry: 10000, available: 50000, remaining: 25000 });
    expect(monthlyPlans(data, '2027-02-01')[0]).toMatchObject({ carry: 25000, available: 75000 });
    expect(monthlyPlans(data, '2027-03-01')[0]?.carry).toBe(0);
  });
  it('stops at disabled or missing rollover months and never rolls forward overspending', () => {
    const data = {
      ...base,
      monthlyBudgets: [
        { month: '2026-09-01', category: 'Groceries', amount: 20000, rollover: true },
        { month: '2026-10-01', category: 'Groceries', amount: 10000, rollover: true },
      ],
      transactions: [posting('2026-10-16', 35000)],
    };
    expect(monthlyPlans(data, '2026-11-01')[0]).toMatchObject({ carry: 0, available: 50000 });
    expect(monthlyPlans({ ...data, transactions: [] }, '2026-12-01')[0]?.carry).toBe(0);
  });
  it('allows a zero cap, carries new custom categories and does not invent historical categories', () => {
    const data = {
      ...base,
      monthlyBudgets: [
        { month: '2026-10-01', category: 'Pets', amount: 10000, rollover: true },
        { month: '2026-10-01', category: 'Groceries', amount: 0, rollover: false },
      ],
    };
    expect(monthlyPlans(data, '2026-09-01')).toHaveLength(1);
    expect(monthlyPlans(data, '2026-10-01').find((entry) => entry.category === 'Groceries')?.available).toBe(0);
    expect(monthlyPlans(data, '2026-11-01').find((entry) => entry.category === 'Pets')).toMatchObject({
      amount: 0,
      carry: 10000,
    });
  });
  it('recalculates dependent carry after a corrected expense without mutating any allocation', () => {
    const data = {
      ...base,
      monthlyBudgets: [{ month: '2026-10-01', category: 'Groceries', amount: 30000, rollover: true }],
      transactions: [posting('2026-10-16', 10000)],
    };
    const before = JSON.stringify(data);
    expect(monthlyPlans(data, '2026-11-01')[0]?.carry).toBe(20000);
    expect(JSON.stringify(data)).toBe(before);
    expect(monthlyPlans({ ...data, transactions: [posting('2026-10-16', 15000)] }, '2026-11-01')[0]?.carry).toBe(15000);
  });
});
describe('manual savings progress', () => {
  const goal = { id: 'goal', name: 'Emergency', targetAmount: 100000, targetDate: '2027-01-31', isArchived: false };
  it('uses signed contributions and counts inclusive calendar months for the remaining pace', () => {
    const contributions = [
      { id: 'one', goalId: 'goal', amount: 30000, date: '2026-10-16', notes: '', createdAt: 1 },
      { id: 'two', goalId: 'goal', amount: -10000, date: '2026-10-16', notes: '', createdAt: 2 },
    ];
    expect(goalProgress(goal, contributions, '2026-10-16')).toMatchObject({
      saved: 20000,
      remaining: 80000,
      monthly: 20000,
    });
  });
  it('handles overdue and completed targets without negative remaining amounts or division errors', () => {
    expect(goalProgress(goal, [], '2027-02-01')).toMatchObject({ isOverdue: true, monthly: null });
    expect(goalProgress({ ...goal, targetDate: null }, [], '2026-10-16').monthly).toBeNull();
    expect(
      goalProgress(
        goal,
        [{ id: 'one', goalId: 'goal', amount: 110000, date: '2026-10-16', notes: '', createdAt: 1 }],
        '2026-10-16',
      ),
    ).toMatchObject({ remaining: 0, percentage: 100, monthly: null });
  });
});

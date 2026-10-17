// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { runLocalReminderScan } from './localReminderDelivery';
import { readLocalReminderState, writeLocalReminderState } from './reminderStateService';
import type { BudgetData } from '../../types/budget';
const data: BudgetData = {
  accounts: [],
  budgets: [],
  transactions: [],
  recurring: [
    {
      id: 'bill',
      name: 'Private payee',
      amount: 12345,
      category: 'Utilities',
      type: 'expense',
      accountId: 'bank',
      destinationAccountId: null,
      date: '2026-10-18',
      notes: '',
      frequency: 'once',
      reminderDays: 2,
    },
  ],
};
const now = Date.parse('2026-10-16T06:00:00Z');
beforeEach(() => {
  localStorage.clear();
});
describe('asynchronous foreground notification display', () => {
  it('records sent only after display resolves and suppresses repeats', async () => {
    let finish: () => void = () => undefined;
    let calls = 0;
    const pending = runLocalReminderScan(data, now, () => {
      calls += 1;
      return new Promise<void>((resolve) => {
        finish = resolve;
      });
    });
    expect(readLocalReminderState().attempts).toHaveLength(0);
    finish();
    await pending;
    expect(readLocalReminderState().attempts[0]?.status).toBe('sent');
    await runLocalReminderScan(data, now, () => {
      calls += 1;
    });
    expect(calls).toBe(1);
  });
  it('records a rejected mobile display as failed and preserves settings edited while waiting', async () => {
    await runLocalReminderScan(data, now, async () => {
      const latest = readLocalReminderState();
      latest.preferences.deliveryTime = '10:30';
      writeLocalReminderState(latest);
      throw new Error('OS refused display');
    });
    expect(readLocalReminderState().attempts[0]?.status).toBe('failed');
    expect(readLocalReminderState().preferences.deliveryTime).toBe('10:30');
  });
});

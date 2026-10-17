import { describe, expect, it } from 'vitest';
import { planReminderJobs, zonedClock } from './reminderPlanning';
import { DEFAULT_REMINDER_PREFERENCES } from './reminders.constants';
import type { RecurringTransaction, Transaction } from '../../types/budget';
const template: RecurringTransaction = {
  id: 'bill',
  name: 'Bill',
  amount: 1000,
  type: 'expense',
  category: 'Utilities',
  accountId: 'account',
  destinationAccountId: null,
  date: '2026-10-18',
  frequency: 'once',
  reminderDays: 2,
  notes: '',
};
const now = Date.parse('2026-10-16T06:00:00Z');
describe('timezone-aware reminder planning', () => {
  it('uses Athens local time and handles the spring and autumn DST changes', () => {
    expect(zonedClock(Date.parse('2026-03-29T06:30:00Z'), 'Europe/Athens').time).toBe('09:30');
    expect(zonedClock(Date.parse('2026-10-25T06:30:00Z'), 'Europe/Athens').time).toBe('08:30');
    expect(planReminderJobs([template], [], [], DEFAULT_REMINDER_PREFERENCES, now - 60000)).toHaveLength(0);
    expect(planReminderJobs([template], [], [], DEFAULT_REMINDER_PREFERENCES, now)).toHaveLength(1);
  });
  it('suppresses paid and snoozed occurrences and allows a later reminder after snooze expiry', () => {
    const paid: Transaction = { ...template, id: 'paid', recurringId: template.id, createdAt: 0 };
    expect(planReminderJobs([template], [paid], [], DEFAULT_REMINDER_PREFERENCES, now)).toHaveLength(0);
    const snoozes = [{ recurringId: template.id, date: template.date, until: now + 3600000 }];
    expect(planReminderJobs([template], [], snoozes, DEFAULT_REMINDER_PREFERENCES, now)).toHaveLength(0);
    expect(planReminderJobs([template], [], snoozes, DEFAULT_REMINDER_PREFERENCES, now + 3600000)).toHaveLength(1);
  });
  it('includes overdue payments only within the chosen calendar-day window', () => {
    const overdue = { ...template, date: '2026-10-15' };
    expect(planReminderJobs([overdue], [], [], DEFAULT_REMINDER_PREFERENCES, now)[0]?.title).toContain('overdue');
    expect(planReminderJobs([overdue], [], [], { ...DEFAULT_REMINDER_PREFERENCES, overdueDays: 0 }, now)).toHaveLength(
      0,
    );
  });
  it('creates one daily digest for multiple eligible transactions', () => {
    const jobs = planReminderJobs(
      [template, { ...template, id: 'second' }],
      [],
      [],
      { ...DEFAULT_REMINDER_PREFERENCES, mode: 'digest' },
      now,
    );
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.key).toBe('digest:2026-10-16');
    expect(jobs[0]?.body).toContain('2 planned');
  });
});

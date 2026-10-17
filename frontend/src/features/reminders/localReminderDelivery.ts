import type { BudgetData } from '../../types/budget';
import type { ReminderAttempt } from '../../types/operations';
import { planReminderJobs } from './reminderPlanning';
import { readLocalReminderState, writeLocalReminderState } from './reminderStateService';
import { REMINDERS } from './reminders.constants';
/** Deliver opt-in preview notifications with the same timing policy and bounded retry semantics.
 * @param {BudgetData} data - Budget. @param {number} now - Clock.
 * @param {(title: string, options: NotificationOptions) => void | Promise<void>} notify - Browser boundary.
 * @returns {Promise<void>} Persists provider success/failure without exposing payees. */
export async function runLocalReminderScan(
  data: BudgetData,
  now: number,
  notify: (title: string, options: NotificationOptions) => void | Promise<void>,
) {
  const state = readLocalReminderState();
  const ledger = state.deliveryLedger ?? [...state.attempts];
  const jobs = planReminderJobs(data.recurring, data.transactions, state.snoozes, state.preferences, now, data);
  let hasChanged = false;
  for (const job of jobs) {
    const id = `local:${job.key}`;
    const previous = ledger.find((entry) => entry.id === id);
    if (
      previous?.status === 'sent' ||
      (previous && (previous.count >= REMINDERS.maximumAttempts || previous.retryAfter > now))
    ) {
      continue;
    }
    let status: ReminderAttempt['status'] = 'sent';
    try {
      await notify(job.title, { body: job.body, tag: job.key });
    } catch {
      status = 'failed';
    }
    const attempt = {
      id,
      title: job.title,
      date: job.date,
      status,
      attemptedAt: now,
      retryAfter: now + REMINDERS.retryMilliseconds,
      count: (previous?.count ?? 0) + 1,
    };
    const index = ledger.findIndex((entry) => entry.id === id);
    if (index < 0) {
      ledger.push(attempt);
    } else {
      ledger[index] = attempt;
    }
    hasChanged = true;
  }
  if (hasChanged) {
    const latest = readLocalReminderState();
    const merged = new Map((latest.deliveryLedger ?? latest.attempts).map((entry) => [entry.id, entry]));
    for (const entry of ledger) {
      const current = merged.get(entry.id);
      if (!current || current.attemptedAt <= entry.attemptedAt) {
        merged.set(entry.id, entry);
      }
    }
    latest.deliveryLedger = [...merged.values()];
    latest.attempts = [...latest.deliveryLedger]
      .sort((first, second) => second.attemptedAt - first.attemptedAt)
      .slice(0, REMINDERS.historyLimit);
    writeLocalReminderState(latest);
  }
}

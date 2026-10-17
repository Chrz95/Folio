import { createHash } from 'node:crypto';
import webpush from 'web-push';
import type { DatabaseClient } from '../../db/client.js';
import type { Logger } from 'pino';
import { createBudgetRepository } from '../budget/budget.repository.js';
import { createReminderRepository } from './reminders.repository.js';
import { createReminderStateRepository } from './reminderState.repository.js';
import { planReminderJobs } from './reminderPlanning.js';
import { REMINDERS } from './reminders.constants.js';
/** Execute one injectable scan; only provider acknowledgments count as sent, never as read.
 * @param {DatabaseClient} client - SQLite. @param {Logger} logger - Safe logger.
 * @param {number} now - Injected clock. @param {typeof webpush.sendNotification} send - Provider boundary.
 * @param {() => boolean} isStopped - Shutdown cancellation. @returns {Promise<void>} Durable attempt log. */
export async function runReminderScan(
  client: DatabaseClient,
  logger: Logger,
  now: number = Date.now(),
  send: typeof webpush.sendNotification = webpush.sendNotification,
  isStopped: () => boolean = () => false,
) {
  const budget = createBudgetRepository(client);
  const subscriptions = createReminderRepository(client);
  const state = createReminderStateRepository(client);
  const jobs = planReminderJobs(
    budget.listRecurring(),
    budget.reminderPostings(),
    state.snoozes(),
    state.preferences(),
    now,
    budget.scheduleState(),
  );
  for (const subscription of subscriptions.list()) {
    for (const job of jobs) {
      if (isStopped()) {
        return;
      }
      const currentJob = planReminderJobs(
        budget.listRecurring(),
        budget.reminderPostings(),
        state.snoozes(),
        state.preferences(),
        now,
        budget.scheduleState(),
      ).find((entry) => entry.key === job.key);
      if (!currentJob) {
        continue;
      }
      const id = createHash('sha256').update(`${subscription.endpoint}:${job.key}`).digest('hex');
      const previous = state.attempt(id);
      if (
        previous?.status === 'sent' ||
        previous?.status === 'expired' ||
        (previous && (previous.count >= REMINDERS.maximumAttempts || previous.retryAfter > now))
      ) {
        continue;
      }
      const record = {
        id,
        title: job.title,
        date: job.date,
        attemptedAt: now,
        count: (previous?.count ?? 0) + 1,
        retryAfter: now + REMINDERS.retryMilliseconds,
      };
      try {
        await send(
          { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
          JSON.stringify({ title: currentJob.title, body: currentJob.body, tag: currentJob.key }),
          { TTL: REMINDERS.pushTtl, timeout: REMINDERS.pushTimeout },
        );
        if (!isStopped() && subscriptions.exists(subscription.endpoint)) {
          state.recordAttempt({ ...record, status: 'sent' });
        }
      } catch (error) {
        if (isStopped() || !subscriptions.exists(subscription.endpoint)) {
          return;
        }
        const status = error instanceof webpush.WebPushError ? error.statusCode : 0;
        const expired = status === REMINDERS.notFound || status === REMINDERS.gone;
        state.recordAttempt({ ...record, status: expired ? 'expired' : 'failed' });
        if (expired) {
          subscriptions.remove(subscription.endpoint);
          break;
        }
        logger.warn({ status }, 'Reminder provider unavailable; bounded retry scheduled');
      }
    }
  }
}

import webpush from 'web-push';
import type { Logger } from 'pino';
import type { DatabaseClient } from '../../db/client.js';
import { LIMIT } from '../../constants/http.constants.js';
import { runReminderScan } from './reminderDelivery.js';
/** Poll one instance with overlap protection and cancellation before database shutdown.
 * @param {DatabaseClient} client - Long-lived SQLite connection.
 * @param {object} push - Server VAPID configuration. @param {string} push.publicKey - Public key.
 * @param {string} push.privateKey - Signing secret. @param {string} push.subject - Operator URI.
 * @param {Logger} logger - Redacted logger. @returns {() => void} Stop callback. */
export function startReminderWorker(
  client: DatabaseClient,
  push: { publicKey: string; privateKey: string; subject: string },
  logger: Logger,
) {
  if (!push.publicKey) {
    return () => undefined;
  }
  webpush.setVapidDetails(push.subject, push.publicKey, push.privateKey);
  let isRunning = false;
  let isStopped = false;
  /** Run a safe scan without concurrent timers. @returns {Promise<void>} Logs a recoverable failure. */
  async function tick() {
    if (isRunning || isStopped) {
      return;
    }
    isRunning = true;
    try {
      await runReminderScan(client, logger, Date.now(), webpush.sendNotification, () => isStopped);
    } catch {
      logger.error('Reminder scan failed; next scan will retry.');
    } finally {
      isRunning = false;
    }
  }
  const interval = setInterval(() => void tick(), LIMIT.reminderInterval);
  interval.unref();
  void tick();
  return () => {
    isStopped = true;
    clearInterval(interval);
  };
}

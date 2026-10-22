import type { Logger } from 'pino';
import type { DatabaseClient } from '../../db/client.js';
import { AUTOMATIC } from './automatic.constants.js';
import { runAutomaticConfirmation } from './automaticConfirmation.js';
/** Run independently of push notification enrollment, including while all browsers are closed.
 * @param {DatabaseClient} client - Migrated connection. @param {Logger} logger - Redacted logger.
 * @returns {() => void} Stop callback called before closing SQLite. */
export function startAutomaticWorker(client: DatabaseClient, logger: Logger) {
  /** Retry on the next tick after a rolled-back batch; synchronous scans cannot overlap.
   * @returns {void} Bounded posting scan. */
  function tick() {
    try {
      runAutomaticConfirmation(client, Date.now());
    } catch {
      logger.error('Automatic confirmation failed; next scan will retry.');
    }
  }
  const interval = setInterval(tick, AUTOMATIC.interval);
  interval.unref();
  tick();
  return () => clearInterval(interval);
}

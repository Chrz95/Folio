import { loadEnvironment } from './app/config/environment.js';
import { createLogger } from './lib/logger/logger.js';
import { openDatabase, verifySchema } from './db/client.js';
import { createApp } from './app/createApp.js';
import { LIMIT } from './constants/http.constants.js';
import { startReminderWorker } from './features/reminders/reminders.worker.js';
const configuration = loadEnvironment();
const logger = createLogger(configuration.logLevel);
const client = openDatabase(configuration.database);
try {
  verifySchema(client);
} catch (error) {
  client.sqlite.close();
  logger.fatal({ err: error }, 'Schema unavailable');
  process.exitCode = 1;
  throw error;
}
const app = createApp(client, configuration, logger);
const server = app.listen(configuration.port, configuration.host, () => logger.info('Folio API listening'));
const stopReminders = startReminderWorker(client, configuration.push, logger);
let isShuttingDown = false;
/** Stop accepting requests, finish active work, and close SQLite.
 * @param {number} exitCode - Process outcome.
 * @returns {void} Begins bounded shutdown. */
function shutdown(exitCode: number) {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;
  stopReminders();
  const timeout = setTimeout(() => {
    logger.fatal('Shutdown deadline exceeded');
    process.exit(1);
  }, LIMIT.shutdown);
  timeout.unref();
  server.close(() => {
    client.sqlite.close();
    clearTimeout(timeout);
    logger.info('HTTP and SQLite closed');
    process.exitCode = exitCode;
  });
  server.closeIdleConnections();
}
process.on('SIGTERM', () => shutdown(0));
process.on('SIGINT', () => shutdown(0));
process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'Uncaught failure');
  shutdown(1);
});
process.on('unhandledRejection', (error) => {
  logger.fatal({ err: error }, 'Unhandled rejection');
  shutdown(1);
});
server.on('error', (error) => {
  logger.fatal({ err: error }, 'Listener failed');
  shutdown(1);
});

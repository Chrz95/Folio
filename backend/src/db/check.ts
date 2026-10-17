import { parseDatabaseEnvironment } from '../app/config/environment.js';
import { openDatabase, verifySchema } from './client.js';
import { logger } from '../lib/logger/logger.js';
const client = openDatabase(parseDatabaseEnvironment());
try {
  verifySchema(client);
  logger.info(
    {
      sqliteVersion: client.sqlite.prepare('select sqlite_version() version').get(),
      foreignKeys: client.sqlite.pragma('foreign_keys', { simple: true }),
      journal: client.sqlite.pragma('journal_mode', { simple: true }),
      durability: client.sqlite.pragma('synchronous', { simple: true }),
      busyTimeout: client.sqlite.pragma('busy_timeout', { simple: true }),
    },
    'Database ready',
  );
} finally {
  client.sqlite.close();
}

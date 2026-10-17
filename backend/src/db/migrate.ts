import { parseDatabaseEnvironment } from '../app/config/environment.js';
import { openDatabase, verifySchema } from './client.js';
import { applyMigrations } from './migrations.js';
import { logger } from '../lib/logger/logger.js';
const client = openDatabase(parseDatabaseEnvironment(), true);
try {
  applyMigrations(client);
  verifySchema(client);
  logger.info('Migrations complete');
} finally {
  client.sqlite.close();
}

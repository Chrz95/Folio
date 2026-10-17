import { resolve } from 'node:path';
import { z } from 'zod';
import { parseDatabaseEnvironment } from '../app/config/environment.js';
import { openDatabase } from './client.js';
import { logger } from '../lib/logger/logger.js';
const destination = resolve(z.string().min(1).parse(process.argv.at(-1)));
const settings = parseDatabaseEnvironment();
if (destination === settings.filePath || destination.endsWith('.ts')) {
  throw new Error('Provide a new backup path.');
}
const client = openDatabase(settings);
try {
  await client.sqlite.backup(destination);
  logger.info('Consistent backup complete');
} finally {
  client.sqlite.close();
}

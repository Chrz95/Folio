import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { DatabaseClient } from './client.js';
/** Apply reviewed migrations only from explicit CLI/tests.
 * @param {DatabaseClient} client - Connection owned by caller.
 * @returns {void} Completes all pending schema migrations. */
export function applyMigrations(client: DatabaseClient) {
  migrate(client.database, { migrationsFolder: fileURLToPath(new URL('./migrations', import.meta.url)) });
}

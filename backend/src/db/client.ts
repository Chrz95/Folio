import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { mkdirSync, chmodSync, accessSync, constants } from 'node:fs';
import { dirname } from 'node:path';
import * as budgetSchema from './schema/budget.js';
import * as operationSchema from './schema/operations.js';
import * as planningSchema from './schema/planning.js';
import * as receiptSchema from './schema/receipts.js';
import * as scheduleSchema from './schema/schedules.js';
const schema = { ...budgetSchema, ...operationSchema, ...planningSchema, ...receiptSchema, ...scheduleSchema };
import { LIMIT, PRAGMA } from '../constants/http.constants.js';
export interface DatabaseSettings {
  filePath: string;
  busyTimeout: number;
}
/** Open one file-backed connection and verify durability settings.
 * @param {DatabaseSettings} settings - Validated storage configuration.
 * @param {boolean} create - Allow a migration/test to create storage.
 * @returns {object} Drizzle client and native connection; caller owns cleanup. */
export function openDatabase(settings: DatabaseSettings, create: boolean = false) {
  if (create) {
    mkdirSync(dirname(settings.filePath), { recursive: true, mode: LIMIT.directoryMode });
  } else {
    accessSync(settings.filePath, constants.R_OK | constants.W_OK);
  }
  accessSync(dirname(settings.filePath), constants.R_OK | constants.W_OK);
  const sqlite = new Database(settings.filePath, { fileMustExist: !create, timeout: settings.busyTimeout });
  try {
    chmodSync(settings.filePath, LIMIT.fileMode);
    sqlite.pragma(PRAGMA.foreignKeys);
    sqlite.pragma(PRAGMA.journal);
    sqlite.pragma(PRAGMA.synchronous);
    if (
      sqlite.pragma(PRAGMA.foreignKeyCheck, { simple: true }) !== 1 ||
      sqlite.pragma(PRAGMA.journalCheck, { simple: true }) !== 'wal'
    ) {
      throw new Error('Required database settings are unavailable.');
    }
    return { sqlite, database: drizzle(sqlite, { schema }) };
  } catch (error) {
    sqlite.close();
    throw error;
  }
}
export type DatabaseClient = ReturnType<typeof openDatabase>;
/** Check application schema before traffic; migrations are never implicit.
 * @param {DatabaseClient} client - Open connection.
 * @returns {void} Throws if a required table is unavailable. */
export function verifySchema(client: DatabaseClient) {
  client.database.select().from(schema.scheduleSettings).limit(1).all();
  client.database.select().from(schema.skippedOccurrences).limit(1).all();
  client.database.select().from(schema.receipts).limit(1).all();
  client.database.select().from(schema.monthlyBudgets).limit(1).all();
  client.database.select().from(schema.customCategories).limit(1).all();
  client.database.select().from(schema.savingsGoals).limit(1).all();
  client.database.select().from(schema.goalContributions).limit(1).all();
  client.database.select().from(schema.accounts).limit(1).all();
  client.database.select().from(schema.transactions).limit(1).all();
  client.database.select().from(schema.recurring).limit(1).all();
  client.database.select().from(schema.budgets).limit(1).all();
  client.database.select().from(schema.subscriptions).limit(1).all();
  client.database.select().from(schema.deliveries).limit(1).all();
  client.database.select().from(schema.clearances).limit(1).all();
  client.database.select().from(schema.reconciliations).limit(1).all();
  client.database.select().from(schema.importLinks).limit(1).all();
  client.database.select().from(schema.reminderPreferences).limit(1).all();
  client.database.select().from(schema.reminderSnoozes).limit(1).all();
  client.database.select().from(schema.reminderAttempts).limit(1).all();
}

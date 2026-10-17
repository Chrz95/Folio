import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, primaryKey, check, index } from 'drizzle-orm/sqlite-core';
import { accounts, transactions, recurring } from './budget.js';
/** Completed statements lock only their own account's cleared transaction legs. */
export const reconciliations = sqliteTable(
  'reconciliations',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id),
    date: text('date').notNull(),
    statementBalance: integer('statement_balance').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [index('reconciliation_account_date').on(table.accountId, table.date)],
);
/** Transfers clear independently in the source and destination statements. */
export const clearances = sqliteTable(
  'clearances',
  {
    transactionId: text('transaction_id')
      .notNull()
      .references(() => transactions.id, { onDelete: 'cascade' }),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id),
    reconciliationId: text('reconciliation_id').references(() => reconciliations.id),
  },
  (table) => [primaryKey({ columns: [table.transactionId, table.accountId] })],
);
/** A stable bank ID or canonical fingerprint prevents duplicate imports across files and retries. */
export const importLinks = sqliteTable('import_links', {
  fingerprint: text('fingerprint').primaryKey(),
  transactionId: text('transaction_id')
    .notNull()
    .references(() => transactions.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at').notNull(),
});
/** Preferences are workspace-wide; browser notification permission remains independently opt-in. */
export const reminderPreferences = sqliteTable(
  'reminder_preferences',
  {
    id: integer('id').primaryKey(),
    timeZone: text('time_zone').notNull(),
    deliveryTime: text('delivery_time').notNull(),
    mode: text('mode', { enum: ['individual', 'digest'] }).notNull(),
    overdueDays: integer('overdue_days').notNull(),
  },
  (table) => [
    check('reminder_mode_valid', sql`${table.mode} in ('individual','digest')`),
    check('overdue_days_valid', sql`${table.overdueDays} between 0 and 30`),
    check('singleton_preferences', sql`${table.id}=1`),
  ],
);
export const reminderSnoozes = sqliteTable(
  'reminder_snoozes',
  {
    recurringId: text('recurring_id')
      .notNull()
      .references(() => recurring.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    until: integer('until').notNull(),
  },
  (table) => [primaryKey({ columns: [table.recurringId, table.date] })],
);
/** Provider acknowledgments never imply that a person has read the notification. */
export const reminderAttempts = sqliteTable(
  'reminder_attempts',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    date: text('date').notNull(),
    status: text('status', { enum: ['sent', 'failed', 'expired'] }).notNull(),
    attemptedAt: integer('attempted_at').notNull(),
    retryAfter: integer('retry_after').notNull(),
    count: integer('count').notNull(),
  },
  (table) => [
    check('attempt_status_valid', sql`${table.status} in ('sent','failed','expired')`),
    check('attempt_count_positive', sql`${table.count}>0`),
    index('attempt_timestamp').on(table.attemptedAt),
  ],
);

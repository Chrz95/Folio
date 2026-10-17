import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, check, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
/** Accounts store opening balances; current balances are derived from postings. */
export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  openingBalance: integer('opening_balance').notNull().default(0),
});
/** Money is integer cents. Calendar dates are local ISO dates; audit times are UTC milliseconds. */
export const recurring = sqliteTable(
  'recurring',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    amount: integer('amount').notNull(),
    type: text('type', { enum: ['expense', 'income', 'transfer'] }).notNull(),
    category: text('category').notNull(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id),
    destinationAccountId: text('destination_account_id').references(() => accounts.id),
    date: text('date').notNull(),
    frequency: text('frequency', { enum: ['once', 'weekly', 'monthly', 'yearly'] }).notNull(),
    reminderDays: integer('reminder_days').notNull().default(1),
    notes: text('notes').notNull().default(''),
  },
  (table) => [
    check('recurring_amount_positive', sql`${table.amount} > 0`),
    check('recurring_type_valid', sql`${table.type} in ('expense','income','transfer')`),
    check('recurring_frequency_valid', sql`${table.frequency} in ('once','weekly','monthly','yearly')`),
    check('reminder_days_valid', sql`${table.reminderDays} between 0 and 7`),
    check(
      'recurring_transfer_valid',
      sql`(${table.type} = 'transfer' AND ${table.destinationAccountId} IS NOT NULL
 AND ${table.destinationAccountId} != ${table.accountId}) OR (${table.type} != 'transfer'
 AND ${table.destinationAccountId} IS NULL)`,
    ),
  ],
);
export const transactions = sqliteTable(
  'transactions',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    amount: integer('amount').notNull(),
    type: text('type', { enum: ['expense', 'income', 'transfer'] }).notNull(),
    category: text('category').notNull(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id),
    destinationAccountId: text('destination_account_id').references(() => accounts.id),
    date: text('date').notNull(),
    notes: text('notes').notNull().default(''),
    recurringId: text('recurring_id').references(() => recurring.id, { onDelete: 'set null' }),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    check('transaction_amount_positive', sql`${table.amount} > 0`),
    check('transaction_type_valid', sql`${table.type} in ('expense','income','transfer')`),
    check(
      'transaction_transfer_valid',
      sql`(${table.type} = 'transfer' AND ${table.destinationAccountId} IS NOT NULL
 AND ${table.destinationAccountId} != ${table.accountId}) OR (${table.type} != 'transfer'
 AND ${table.destinationAccountId} IS NULL)`,
    ),
    index('transaction_date_idx').on(table.date, table.id),
    uniqueIndex('recurring_occurrence_unique').on(table.recurringId, table.date),
  ],
);
export const budgets = sqliteTable(
  'budgets',
  {
    category: text('category').primaryKey(),
    amount: integer('amount').notNull(),
  },
  (table) => [check('budget_positive', sql`${table.amount} > 0`)],
);
export const subscriptions = sqliteTable('subscriptions', {
  endpoint: text('endpoint').primaryKey(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
});
export const deliveries = sqliteTable('deliveries', {
  id: text('id').primaryKey(),
  deliveredAt: integer('delivered_at').notNull(),
});

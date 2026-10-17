import { sqliteTable, text, integer, check, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { transactions } from './budget.js';
/** File bytes remain inside SQLite, so normal consistent backups include supporting documents. */
export const receipts = sqliteTable(
  'receipts',
  {
    id: text('id').primaryKey(),
    transactionId: text('transaction_id')
      .notNull()
      .references(() => transactions.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    mimeType: text('mime_type').notNull(),
    size: integer('size').notNull(),
    content: text('content').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    check('receipt_size_valid', sql`${table.size} > 0 and ${table.size} <= 524288`),
    check('receipt_type_valid', sql`${table.mimeType} in ('image/png','image/jpeg','application/pdf')`),
    index('receipt_transaction').on(table.transactionId),
  ],
);

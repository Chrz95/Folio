import { sqliteTable, text, integer, primaryKey, check } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { recurring } from './budget.js';
/** Schedule controls never rewrite actual payment history. */
export const scheduleSettings = sqliteTable(
  'schedule_settings',
  {
    recurringId: text('recurring_id')
      .primaryKey()
      .references(() => recurring.id, { onDelete: 'cascade' }),
    isPaused: integer('is_paused', { mode: 'boolean' }).notNull(),
    endDate: text('end_date'),
  },
  (table) => [check('schedule_pause_boolean', sql`${table.isPaused} in (0,1)`)],
);
export const skippedOccurrences = sqliteTable(
  'skipped_occurrences',
  {
    recurringId: text('recurring_id')
      .notNull()
      .references(() => recurring.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
  },
  (table) => [primaryKey({ columns: [table.recurringId, table.date] })],
);

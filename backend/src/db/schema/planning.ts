import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, primaryKey, check, index } from 'drizzle-orm/sqlite-core';
/** Exact month overrides leave every other month's allocation intact. */
export const monthlyBudgets = sqliteTable(
  'monthly_budgets',
  {
    month: text('month').notNull(),
    category: text('category').notNull(),
    amount: integer('amount').notNull(),
    rollover: integer('rollover', { mode: 'boolean' }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.month, table.category] }),
    check('monthly_amount_nonnegative', sql`${table.amount} >= 0`),
    check('monthly_rollover_boolean', sql`${table.rollover} in (0, 1)`),
  ],
);
export const customCategories = sqliteTable(
  'custom_categories',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    normalizedName: text('normalized_name').notNull().unique(),
    isArchived: integer('is_archived', { mode: 'boolean' }).notNull().default(false),
  },
  (table) => [check('category_archive_boolean', sql`${table.isArchived} in (0, 1)`)],
);
/** Goal contributions are planning records and never change actual account balances. */
export const savingsGoals = sqliteTable(
  'savings_goals',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    targetAmount: integer('target_amount').notNull(),
    targetDate: text('target_date'),
    isArchived: integer('is_archived', { mode: 'boolean' }).notNull().default(false),
  },
  (table) => [
    check('goal_target_positive', sql`${table.targetAmount} > 0`),
    check('goal_archive_boolean', sql`${table.isArchived} in (0, 1)`),
  ],
);
export const goalContributions = sqliteTable(
  'goal_contributions',
  {
    id: text('id').primaryKey(),
    goalId: text('goal_id')
      .notNull()
      .references(() => savingsGoals.id),
    amount: integer('amount').notNull(),
    date: text('date').notNull(),
    notes: text('notes').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    check('goal_contribution_nonzero', sql`${table.amount} != 0`),
    index('goal_contribution_goal').on(table.goalId),
  ],
);

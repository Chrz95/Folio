import { z } from 'zod';
import { ACTUAL } from './actual.constants.js';
const money = z.number().int().min(-ACTUAL.money).max(ACTUAL.money);
const name = z.string().trim().min(1).max(ACTUAL.name);
const category = z.string().trim().min(1).max(ACTUAL.category);
const fields = {
  id: z.uuid(),
  name,
  amount: money.refine((value) => value > 0),
  type: z.enum(['income', 'expense', 'transfer']),
  category,
  accountId: z.uuid(),
  destinationAccountId: z.uuid().nullable(),
  date: z.iso.date(),
  notes: z.string().max(ACTUAL.notes),
};
export const actualFileSchema = z
  .object({
    budgetName: name,
    categoryMappings: z
      .array(z.object({ original: z.string().max(ACTUAL.notes), name: category }).strict())
      .max(ACTUAL.rows),
    accounts: z.array(z.object({ id: z.uuid(), name, openingBalance: money }).strict()).max(ACTUAL.accounts),
    customCategories: z
      .array(z.object({ id: z.uuid(), name: category, isArchived: z.boolean() }).strict())
      .max(ACTUAL.rows),
    transactions: z
      .array(z.object({ ...fields, createdAt: z.literal(0), recurringId: z.uuid().nullable() }).strict())
      .max(ACTUAL.rows),
    recurring: z
      .array(
        z
          .object({ ...fields, frequency: z.enum(['once', 'weekly', 'monthly', 'yearly']), reminderDays: z.literal(0) })
          .strict(),
      )
      .max(ACTUAL.rows),
    scheduleSettings: z
      .array(z.object({ recurringId: z.uuid(), isPaused: z.literal(true), endDate: z.iso.date().nullable() }).strict())
      .max(ACTUAL.rows),
    monthlyBudgets: z
      .array(
        z
          .object({
            month: z.iso
              .date()
              .refine((value) => value.endsWith('-01') && value >= '1900-01-01' && value <= '2200-12-01'),
            category,
            amount: money.refine((value) => value >= 0),
            rollover: z.literal(false),
          })
          .strict(),
      )
      .max(ACTUAL.rows),
    clearances: z
      .array(z.object({ transactionId: z.uuid(), accountId: z.uuid(), reconciliationId: z.null() }).strict())
      .max(ACTUAL.rows),
    balances: z.array(z.object({ accountId: z.uuid(), amount: z.number().int().safe() }).strict()).max(ACTUAL.accounts),
    warnings: z.array(z.string().max(ACTUAL.notes)).max(ACTUAL.entries),
    exclusions: z
      .array(z.object({ id: z.string().max(ACTUAL.name), name, reason: z.string().max(ACTUAL.notes) }).strict())
      .max(ACTUAL.rows),
  })
  .strict();
export const actualInputSchema = z.object({ file: actualFileSchema, currencyConfirmed: z.literal(true) }).strict();
export const actualCommitSchema = actualInputSchema
  .extend({
    revision: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export type ActualFile = z.infer<typeof actualFileSchema>;
export type ActualData = Pick<
  ActualFile,
  'accounts' | 'customCategories' | 'transactions' | 'recurring' | 'monthlyBudgets' | 'clearances' | 'scheduleSettings'
>;

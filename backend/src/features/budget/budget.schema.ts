import { z } from 'zod';
import { categoryNameSchema } from '../planning/planning.schema.js';
import { BUDGET_LIMITS } from './budget.constants.js';
const isoDate = z.iso.date();
const baseTransaction = z.object({
  name: z.string().trim().min(1).max(BUDGET_LIMITS.maximumName),
  amount: z.number().int().positive().max(BUDGET_LIMITS.maximumMoney),
  type: z.enum(['income', 'expense', 'transfer']),
  category: categoryNameSchema,
  accountId: z.uuid(),
  destinationAccountId: z.uuid().nullable().default(null),
  date: isoDate,
  notes: z.string().max(BUDGET_LIMITS.maximumNotes).default(''),
});
/** Enforce distinct transfer accounts before reaching SQLite.
 * @param {object} value - Parsed transaction.
 * @returns {boolean} Whether transfer fields match the type. */
function isTransferValid(value: z.infer<typeof baseTransaction>) {
  return value.type === 'transfer'
    ? Boolean(value.destinationAccountId) && value.destinationAccountId !== value.accountId
    : value.destinationAccountId === null;
}
export const transactionSchema = baseTransaction
  .strict()
  .refine(isTransferValid, 'Choose a distinct destination account.');
export const recurringSchema = baseTransaction
  .extend({
    frequency: z.enum(['once', 'weekly', 'monthly', 'yearly']),
    reminderDays: z.number().int().min(0).max(BUDGET_LIMITS.maximumReminder),
  })
  .strict()
  .refine(isTransferValid, 'Choose a distinct destination account.');
export const identifierSchema = z.object({ id: z.uuid() }).strict();
export const paySchema = z.object({ date: isoDate }).strict();
export const pageSchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(BUDGET_LIMITS.maximumPage).default(BUDGET_LIMITS.defaultPage),
    offset: z.coerce.number().int().min(0).max(BUDGET_LIMITS.maximumOffset).default(0),
  })
  .strict();
export const accountSchema = z
  .object({
    name: z.string().trim().min(1).max(BUDGET_LIMITS.maximumName),
    openingBalance: z.number().int().min(-BUDGET_LIMITS.maximumMoney).max(BUDGET_LIMITS.maximumMoney),
  })
  .strict();
export const budgetSchema = z
  .object({ category: categoryNameSchema, amount: z.number().int().positive().max(BUDGET_LIMITS.maximumMoney) })
  .strict();
export type TransactionInput = z.infer<typeof transactionSchema>;
export type RecurringInput = z.infer<typeof recurringSchema>;

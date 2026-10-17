import { z } from 'zod';
import { BUDGET_LIMITS } from '../budget/budget.constants.js';
import { PLANNING } from './planning.constants.js';
export const categoryNameSchema = z.string().trim().min(1).max(PLANNING.maximumCategory);
export const monthlyBudgetSchema = z
  .object({
    month: z.iso
      .date()
      .refine(
        (value) => value.endsWith('-01') && value >= PLANNING.minimumMonth && value <= PLANNING.maximumMonth,
        'Choose a month between 1900 and 9999.',
      ),
    category: categoryNameSchema,
    amount: z.number().int().min(0).max(BUDGET_LIMITS.maximumMoney),
    rollover: z.boolean(),
  })
  .strict();
export const categorySchema = z.object({ name: categoryNameSchema }).strict();
export const archiveSchema = z.object({ isArchived: z.boolean() }).strict();
export const goalSchema = z
  .object({
    name: z.string().trim().min(1).max(BUDGET_LIMITS.maximumName),
    targetAmount: z.number().int().positive().max(BUDGET_LIMITS.maximumMoney),
    targetDate: z.iso.date().nullable(),
    isArchived: z.boolean().default(false),
  })
  .strict();
export const contributionSchema = z
  .object({
    id: z.uuid(),
    amount: z
      .number()
      .int()
      .min(-BUDGET_LIMITS.maximumMoney)
      .max(BUDGET_LIMITS.maximumMoney)
      .refine((value) => value !== 0, 'Enter a nonzero amount.'),
    date: z.iso.date(),
    notes: z.string().max(BUDGET_LIMITS.maximumNotes).default(''),
  })
  .strict();

export const budgetCopySchema = z
  .object({
    fromMonth: monthlyBudgetSchema.shape.month,
    toMonth: monthlyBudgetSchema.shape.month,
    mode: z.enum(['missing', 'replace']),
  })
  .strict()
  .refine((value) => value.fromMonth !== value.toMonth, 'Choose two different months.');
export const budgetCopyCommitSchema = budgetCopySchema.safeExtend({
  revision: z.string().min(1).max(PLANNING.maximumRevisionLength),
});

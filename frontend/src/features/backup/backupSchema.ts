import { z } from 'zod';
import { portableScheduleSettingsSchema as scheduleSettingsSchema } from '../schedules/scheduleValidation';
import { VALUE } from '../../constants/app.constants';
import { receiptInputSchema } from '../receipts/receiptValidation';
import { BACKUP } from './backup.constants';
const money = z.number().int().min(-VALUE.maximumMoney).max(VALUE.maximumMoney);
const positive = money.refine((value) => value > 0);
const timestamp = z.number().int().nonnegative().safe();
const category = z.string().trim().min(1).max(BACKUP.maximumCategory);
const name = z.string().trim().min(1).max(BACKUP.maximumName);
const fields = {
  name,
  amount: positive,
  type: z.enum(['expense', 'income', 'transfer']),
  category,
  accountId: z.uuid(),
  destinationAccountId: z.uuid().nullable(),
  date: z.iso.date(),
  notes: z.string().max(BACKUP.maximumNotes),
};
const arrayLimit = BACKUP.maximumRows;
const MAXIMUM_REMINDER = 7;
const month = z.iso
  .date()
  .refine((value) => value.endsWith('-01') && value >= BACKUP.minimumMonth && value <= BACKUP.maximumMonth);
export const workspaceSchema = z
  .object({
    scheduleSettings: z.array(scheduleSettingsSchema).max(arrayLimit).default([]),
    skippedOccurrences: z
      .array(z.object({ recurringId: z.uuid(), date: z.iso.date() }).strict())
      .max(arrayLimit)
      .default([]),
    accounts: z
      .array(
        z
          .object({
            id: z.uuid(),
            name,
            openingBalance: money,
            createdAt: timestamp.optional(),
            recurringId: z.uuid().nullable().optional(),
          })
          .strict()
          .transform(({ createdAt: _createdAt, recurringId: _recurringId, ...account }) => account),
      )
      .max(arrayLimit),
    transactions: z
      .array(z.object({ ...fields, id: z.uuid(), createdAt: timestamp, recurringId: z.uuid().nullable() }).strict())
      .max(arrayLimit),
    recurring: z
      .array(
        z
          .object({
            ...fields,
            id: z.uuid(),
            frequency: z.enum(['once', 'weekly', 'monthly', 'yearly']),
            reminderDays: z.number().int().min(0).max(MAXIMUM_REMINDER),
            createdAt: timestamp.optional(),
            recurringId: z.uuid().nullable().optional(),
          })
          .strict()
          .transform(({ createdAt: _createdAt, recurringId: _recurringId, ...template }) => template),
      )
      .max(arrayLimit),
    budgets: z.array(z.object({ category, amount: positive }).strict()).max(arrayLimit),
    monthlyBudgets: z
      .array(z.object({ month, category, amount: money.refine((value) => value >= 0), rollover: z.boolean() }).strict())
      .max(arrayLimit)
      .default([]),
    customCategories: z
      .array(
        z
          .object({ id: z.uuid(), name: category, isArchived: z.boolean(), normalizedName: z.string().optional() })
          .strict(),
      )
      .max(arrayLimit)
      .default([]),
    goals: z
      .array(
        z
          .object({
            id: z.uuid(),
            name,
            targetAmount: positive,
            targetDate: z.iso.date().nullable(),
            isArchived: z.boolean(),
          })
          .strict(),
      )
      .max(arrayLimit)
      .default([]),
    contributions: z
      .array(
        z
          .object({
            id: z.uuid(),
            goalId: z.uuid(),
            amount: money.refine((value) => value !== 0),
            date: z.iso.date(),
            notes: z.string().max(BACKUP.maximumNotes),
            createdAt: timestamp,
          })
          .strict(),
      )
      .max(arrayLimit)
      .default([]),
    clearances: z
      .array(z.object({ transactionId: z.uuid(), accountId: z.uuid(), reconciliationId: z.uuid().nullable() }).strict())
      .max(arrayLimit)
      .default([]),
    reconciliations: z
      .array(
        z
          .object({
            id: z.uuid(),
            accountId: z.uuid(),
            date: z.iso.date(),
            statementBalance: z.number().int().safe(),
            createdAt: timestamp,
          })
          .strict(),
      )
      .max(arrayLimit)
      .default([]),
    importLinks: z
      .array(
        z.object({ fingerprint: z.string().min(1).max(BACKUP.maximumFingerprint), transactionId: z.uuid() }).strict(),
      )
      .max(arrayLimit)
      .default([]),
    receipts: z
      .array(receiptInputSchema.safeExtend({ transactionId: z.uuid(), createdAt: timestamp }))
      .max(arrayLimit)
      .default([]),
  })
  .strict();
export type RestorableWorkspace = z.infer<typeof workspaceSchema>;

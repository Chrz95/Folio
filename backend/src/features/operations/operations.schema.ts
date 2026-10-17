import { z } from 'zod';
import { transactionSchema } from '../budget/budget.schema.js';
import { OPERATIONS } from './operations.constants.js';
const rowSchema = z
  .object({ transaction: transactionSchema, bankId: z.string().trim().max(OPERATIONS.bankIdLength).default('') })
  .strict();
export const importPreviewSchema = z
  .object({ accountId: z.uuid(), rows: z.array(rowSchema).min(1).max(OPERATIONS.maximumRows) })
  .strict();
export const importCommitSchema = z
  .object({
    accountId: z.uuid(),
    rows: z
      .array(
        rowSchema
          .extend({
            action: z.enum(['new', 'match', 'skip']),
            matchId: z.uuid().optional(),
          })
          .strict(),
      )
      .min(1)
      .max(OPERATIONS.maximumRows),
  })
  .strict();
export const clearanceSchema = z
  .object({ accountId: z.uuid(), transactionId: z.uuid(), isCleared: z.boolean() })
  .strict();
export const reconcileSchema = z
  .object({ accountId: z.uuid(), date: z.iso.date(), statementBalance: z.number().int().safe() })
  .strict();
export type ImportRow = z.infer<typeof rowSchema>;
export type ImportChoice = z.infer<typeof importCommitSchema>['rows'][number];

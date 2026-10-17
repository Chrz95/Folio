import { z } from 'zod';
import { BULK } from './bulk.constants';
const ids = z
  .array(z.uuid())
  .min(1)
  .max(BULK.maximumRows)
  .refine((values) => new Set(values).size === values.length, 'Select each transaction only once.');
export const bulkInputSchema = z.discriminatedUnion('action', [
  z.object({ ids, action: z.literal('delete') }).strict(),
  z
    .object({ ids, action: z.literal('categorize'), category: z.string().trim().min(1).max(BULK.maximumCategory) })
    .strict(),
]);
export const bulkCommitSchema = z
  .object({ selection: bulkInputSchema, revision: z.string().min(1).max(BULK.maximumRevision) })
  .strict();

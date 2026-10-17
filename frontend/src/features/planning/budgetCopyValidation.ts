import { z } from 'zod';
import { PLANNING } from './planning.constants';
const monthSchema = z.iso
  .date()
  .refine((value) => value.endsWith('-01') && value >= PLANNING.minimumMonth && value <= PLANNING.maximumMonth);
export const budgetCopySchema = z
  .object({ fromMonth: monthSchema, toMonth: monthSchema, mode: z.enum(['missing', 'replace']) })
  .strict()
  .refine((value) => value.fromMonth !== value.toMonth, 'Choose a source month different from the destination.');

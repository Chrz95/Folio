import { z } from 'zod';
import { workspaceSchema } from './backupSchema.js';
import { BACKUP } from './backup.constants.js';
export const workspaceImportInput = z.object({ data: workspaceSchema }).strict();
export const workspaceImportCommit = workspaceImportInput
  .extend({
    revision: z.string().regex(/^[a-f0-9]{64}$/),
    confirmation: z.literal(BACKUP.confirmation),
  })
  .strict();

import type { ActualFile } from './actualSchema';
import { actualFileSchema } from './actualSchema';
import { actualPlan } from './actualMerge';
import { emptyWorkspace } from '../backup/emptyWorkspace';
import { workspaceSchema } from '../backup/backupSchema';
import { validateBackupRelations } from '../backup/backupRelations';
/** Convert the selected Actual scope into a complete replacement, validating both normalized formats.
 * @param {ActualFile} file - Reviewed native conversion. @returns {object} Complete financial workspace. */
export function actualReplacement(file: ActualFile) {
  const source = actualFileSchema.parse(file);
  const blank = emptyWorkspace();
  const plan = actualPlan(blank, source);
  const replacement = workspaceSchema.parse({ ...blank, ...plan.rows });
  validateBackupRelations(replacement);
  return replacement;
}

import { workspaceSchema } from './backupSchema.js';
/** Create a genuinely empty workspace without restoring sample accounts or data.
 * @returns {import('./backupSchema.js').RestorableWorkspace} Empty financial collections. */
export function emptyWorkspace() {
  return workspaceSchema.parse({ accounts: [], transactions: [], recurring: [], budgets: [] });
}

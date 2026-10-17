import { createHash } from 'node:crypto';
import { AppError } from '../../lib/errors/AppError.js';
import { HTTP } from '../../constants/http.constants.js';
import { workspaceSchema } from './backupSchema.js';
import type { RestorableWorkspace } from './backupSchema.js';
import { validateBackupRelations } from './backupRelations.js';
import { pauseImportedSchedules, workspaceCanonical, workspaceCounts } from './workspaceImportPlan.js';
import type { WorkspaceRepository } from './workspace.repository.js';
/** Bind destructive replacement to a complete, current, explicitly acknowledged review.
 * @param {WorkspaceRepository} repository - SQLite boundary. @returns {object} Workspace import use cases. */
export function createWorkspaceService(repository: WorkspaceRepository) {
  /** Validate the source and describe the effective replacement without writes.
   * @param {RestorableWorkspace} data - Structurally valid input. @returns {object} Exact plan. */
  function plan(data: RestorableWorkspace) {
    try {
      validateBackupRelations(data);
    } catch (error) {
      throw new AppError(
        HTTP.badRequest,
        'INVALID_WORKSPACE',
        error instanceof Error ? error.message : 'Invalid workspace relationships.',
      );
    }
    const before = workspaceSchema.parse(repository.snapshot());
    const after = pauseImportedSchedules(data);
    const revision = createHash('sha256')
      .update(workspaceCanonical([before, after]))
      .digest('hex');
    return { revision, counts: workspaceCounts(before, after), after };
  }
  return {
    /** Review without changing storage. @param {RestorableWorkspace} data - Source. @returns {object} Safe counts. */
    preview: (data: RestorableWorkspace) =>
      repository.atomic(() => {
        const { after: _after, ...review } = plan(data);
        return review;
      }),
    /** Reject stale destinations before touching any existing row.
     * @param {RestorableWorkspace} data - Source. @param {string} revision - Reviewed revision.
     * @returns {object} Actual replacement counts. */
    commit: (data: RestorableWorkspace, revision: string) =>
      repository.atomic(() => {
        const current = plan(data);
        if (current.revision !== revision) {
          throw new AppError(HTTP.conflict, 'WORKSPACE_CHANGED', 'The workspace changed. Review the import again.');
        }
        repository.replace(current.after);
        return { counts: current.counts };
      }),
  };
}

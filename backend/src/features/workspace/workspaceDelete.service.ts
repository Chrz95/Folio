import { createHash } from 'node:crypto';
import type { WorkspaceRepository } from './workspace.repository.js';
import { workspaceCanonical } from './workspaceImportPlan.js';
import { emptyWorkspace } from './emptyWorkspace.js';
import { AppError } from '../../lib/errors/AppError.js';
import { HTTP } from '../../constants/http.constants.js';
/** Delete user data only after a current revision, exact typed word and explicit consent at the HTTP boundary.
 * @param {WorkspaceRepository} repository - Transactional storage. @returns {object} Reviewed destructive action. */
export function createWorkspaceDeletion(repository: WorkspaceRepository) {
  /** Bind confirmation to every current financial and notification row without returning private values.
   * @returns {object} SHA-256 revision and collection counts only. */
  function review() {
    const state = { ...repository.snapshot(), ...repository.notificationSnapshot() };
    const revision = createHash('sha256').update(workspaceCanonical(state)).digest('hex');
    return { revision, counts: Object.entries(state).map(([key, rows]) => ({ key, before: rows.length, after: 0 })) };
  }
  return {
    /** Read the confirmation summary without deleting anything. @returns {object} Current review. */
    preview: () => repository.atomic(review),
    /** Reject concurrent edits and delete all user rows in one SQLite transaction.
     * @param {string} revision - Explicitly reviewed state. @returns {object} Deleted collection counts. */
    commit: (revision: string) =>
      repository.atomic(() => {
        const current = review();
        if (revision !== current.revision) {
          throw new AppError(HTTP.conflict, 'WORKSPACE_CHANGED', 'The app data changed. Review deletion again.');
        }
        repository.replace(emptyWorkspace());
        repository.deleteNotifications();
        return { counts: current.counts };
      }),
  };
}

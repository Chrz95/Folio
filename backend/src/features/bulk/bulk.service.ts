import { AppError } from '../../lib/errors/AppError.js';
import { HTTP } from '../../constants/http.constants.js';
import type { BulkRepository } from './bulk.repository.js';
import { bulkPlan } from './bulkPlan.js';
import type { BulkInput } from './bulkPlan.js';
import { BULK } from './bulk.constants.js';
/** Build and commit authoritative reviews with no partial success or silent skipped rows.
 * @param {BulkRepository} repository - SQLite operations.
 * @param {(category: string) => void} validateCategory - Active catalog guard. @returns {object} Bulk use cases. */
export function createBulkService(repository: BulkRepository, validateCategory: (category: string) => void) {
  /** Validate the complete selection under the caller's transaction.
   * @param {BulkInput} input - Selected operation. @returns {object} Exact current review. */
  function currentPlan(input: BulkInput) {
    if (input.action === 'categorize') {
      validateCategory(input.category);
    }
    const plan = bulkPlan(repository.snapshot(input.ids), input);
    if (plan.rows.length !== input.ids.length) {
      throw new AppError(HTTP.conflict, 'BULK_CHANGED', 'A selected entry no longer exists. Refresh and review again.');
    }
    if (plan.rows.some((row) => row.isLocked)) {
      throw new AppError(HTTP.conflict, 'RECONCILED', 'Reconciled entries cannot be changed in bulk.');
    }
    if (plan.revision.length > BULK.maximumRevision) {
      throw new AppError(HTTP.badRequest, 'BULK_TOO_LARGE', 'This review is too large. Select fewer transactions.');
    }
    return plan;
  }
  return {
    /** Review without writes. @param {BulkInput} input - Selection. @returns {object} Review snapshot. */
    preview: (input: BulkInput) => repository.atomic(() => currentPlan(input)),
    /** Recheck exact identities and related metadata before any write.
     * @param {BulkInput} input - Selection. @param {string} revision - Reviewed revision.
     * @returns {number} Number of committed rows. */
    commit: (input: BulkInput, revision: string) =>
      repository.atomic(() => {
        const plan = currentPlan(input);
        if (plan.revision !== revision) {
          throw new AppError(HTTP.conflict, 'BULK_CHANGED', 'Selected entries changed. Review the batch again.');
        }
        plan.rows.forEach((row) => {
          if (input.action === 'delete') {
            repository.remove(row.transaction.id);
          } else {
            repository.categorize(row.transaction.id, input.category);
          }
        });
        return plan.rows.length;
      }),
  };
}

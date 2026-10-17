import { createHash } from 'node:crypto';
import { AppError } from '../../lib/errors/AppError.js';
import { HTTP } from '../../constants/http.constants.js';
import { actualPlan, canonical } from './actualMerge.js';
import type { ActualFile } from './actualSchema.js';
import type { ActualRepository } from './actual.repository.js';
/** Review and commit strictly additive imports against a fresh, transactionally stable snapshot.
 * @param {ActualRepository} repository - SQLite boundary. @returns {object} Native import use cases. */
export function createActualService(repository: ActualRepository) {
  /** Compute the exact additions and revision without writes.
   * @param {ActualFile} file - Validated normalized source. @returns {object} Current review. */
  function review(file: ActualFile) {
    const target = repository.snapshot();
    try {
      const plan = actualPlan(target, file);
      const revision = createHash('sha256')
        .update(canonical([target, file]))
        .digest('hex');
      return { ...plan, revision };
    } catch (error) {
      throw new AppError(HTTP.conflict, 'ACTUAL_CONFLICT', error instanceof Error ? error.message : 'Import conflict.');
    }
  }
  return {
    /** Review without writes. @param {ActualFile} file - Normalized source. @returns {object} Current plan. */
    preview: (file: ActualFile) => repository.atomic(() => review(file)),
    /** Revalidate source, balances and destination before a single atomic commit.
     * @param {ActualFile} file - Normalized source. @param {string} revision - Reviewed SHA-256.
     * @returns {object} Added counts. */
    commit: (file: ActualFile, revision: string) =>
      repository.atomic(() => {
        const current = review(file);
        if (current.revision !== revision) {
          throw new AppError(HTTP.conflict, 'ACTUAL_CHANGED', 'The workspace changed. Review this import again.');
        }
        repository.insert(current.rows);
        return current.added;
      }),
  };
}

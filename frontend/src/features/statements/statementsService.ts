import { environment } from '../../app/config/environment';
import { request } from '../../lib/api/client';
import { readDemo } from '../../lib/storage/demoStore';
import { createDemoRepository } from './demoRepository';
import { createDemoOperationsService } from './demoOperations';
import { STATEMENTS } from './statements.constants';
import type { ImportRow, ImportChoice, ImportPreview, ImportResult, ReconciliationData } from '../../types/operations';
/** Build the demo adapter only for explicitly compiled preview interactions. @returns {object} Adapter. */
function demo() {
  return createDemoOperationsService(createDemoRepository(readDemo()));
}
/** Preview server-authoritative duplicate/match suggestions. @param {string} accountId - Target.
 * @param {ImportRow[]} rows - Normalized rows. @returns {Promise<ImportPreview[]>} Review choices. */
export async function previewStatement(accountId: string, rows: ImportRow[]): Promise<ImportPreview[]> {
  const preview = environment.isDemo
    ? demo().preview(accountId, rows)
    : await request<Omit<ImportPreview, 'reviewId'>[]>(`${STATEMENTS.apiImport}/preview`, {
        method: 'POST',
        body: JSON.stringify({ accountId, rows }),
      });
  return preview.map((row) => ({ ...row, reviewId: crypto.randomUUID() }));
}
/** Commit the whole reviewed file atomically. @param {string} accountId - Target.
 * @param {ImportChoice[]} rows - Approved choices. @returns {Promise<ImportResult>} Actual outcome. */
export async function commitStatement(accountId: string, rows: ImportChoice[]): Promise<ImportResult> {
  return environment.isDemo
    ? demo().commit(accountId, rows)
    : request(`${STATEMENTS.apiImport}/commit`, {
        method: 'POST',
        body: JSON.stringify({ accountId, rows }),
      });
}
/** Read clearing and statement history. @param {AbortSignal} [signal] - Cancellation.
 * @returns {Promise<ReconciliationData>} Metadata. */
export async function loadStatementState(signal?: AbortSignal): Promise<ReconciliationData> {
  return environment.isDemo ? demo().state() : request(STATEMENTS.apiReconciliation, { signal });
}
/** Clear one account leg. @param {string} accountId - Account. @param {string} transactionId - Posting.
 * @param {boolean} isCleared - Flag. @returns {Promise<void>} Persisted update. */
export async function setStatementClearance(accountId: string, transactionId: string, isCleared: boolean) {
  const input = { accountId, transactionId, isCleared };
  if (environment.isDemo) {
    demo().setClearance(input);
  } else {
    await request(`${STATEMENTS.apiReconciliation}/clearance`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  }
}
/** Reconcile an exact statement balance. @param {string} accountId - Account. @param {string} date - Statement date.
 * @param {number} statementBalance - Integer cents. @returns {Promise<void>} Completed statement. */
export async function reconcileStatement(accountId: string, date: string, statementBalance: number) {
  const input = { accountId, date, statementBalance };
  if (environment.isDemo) {
    demo().reconcile(input);
  } else {
    await request(STATEMENTS.apiReconciliation, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }
}
/** Undo an account's latest statement. @param {string} id - Statement. @returns {Promise<void>} Released locks. */
export async function undoStatement(id: string) {
  if (environment.isDemo) {
    demo().undo(id);
  } else {
    await request(`${STATEMENTS.apiReconciliation}/${id}`, { method: 'DELETE' });
  }
}

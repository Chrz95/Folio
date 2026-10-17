import { randomUUID } from 'node:crypto';
import { AppError } from '../../lib/errors/AppError.js';
import { HTTP } from '../../constants/http.constants.js';
import type { OperationsRepository } from './operations.repository.js';
import type { ImportChoice, clearanceSchema, reconcileSchema } from './operations.schema.js';
import type { z } from 'zod';
import { previewImport, accountDelta, importFingerprint } from './importMatching.js';
/** Keep import and reconciliation invariants inside synchronous database transactions.
 * @param {OperationsRepository} repository - Persistence boundary. @returns {object} Statement operations. */
export function createOperationsService(repository: OperationsRepository) {
  /** Reject a stale or forged account selection. @param {string} id - Account UUID. @returns {object} Account. */
  function requireAccount(id: string) {
    const account = repository.account(id);
    if (!account) {
      throw new AppError(HTTP.notFound, 'ACCOUNT_NOT_FOUND', 'Choose an existing account.');
    }
    return account;
  }
  /** Validate the selected statement's source and supported bank row types.
   * @param {string} accountId - Target account. @param {ImportChoice[]} rows - Rows. @returns {void} Validation. */
  function validateImport(accountId: string, rows: Pick<ImportChoice, 'transaction'>[]) {
    requireAccount(accountId);
    rows.forEach((row) => repository.validateCategory(row.transaction.category));
    if (rows.some((row) => row.transaction.accountId !== accountId || row.transaction.type === 'transfer')) {
      throw new AppError(HTTP.badRequest, 'INVALID_IMPORT', 'Import signed bank movements into one account.');
    }
  }
  /** Atomically apply approved rows, preserving existing transfers and duplicate safety.
   * @param {string} accountId - Statement account. @param {ImportChoice[]} rows - Reviewed choices.
   * @returns {object} Imported, matched and skipped counts. */
  function commit(accountId: string, rows: ImportChoice[]) {
    return repository.atomic(() => {
      validateImport(accountId, rows);
      const preview = previewImport(rows, repository);
      const matchedIds = new Set<string>();
      const result = { imported: 0, matched: 0, skipped: 0 };
      for (const [index, row] of rows.entries()) {
        const check = preview[index];
        if (row.action === 'skip' || check?.isDuplicate) {
          result.skipped += 1;
          continue;
        }
        let transactionId: string;
        if (row.action === 'match') {
          const candidate = check?.candidates.find((entry) => entry.id === row.matchId);
          if (!candidate || matchedIds.has(candidate.id)) {
            throw new AppError(
              HTTP.conflict,
              'STALE_MATCH',
              'A selected match changed. Refresh the preview and review it.',
            );
          }
          transactionId = candidate.id;
          matchedIds.add(transactionId);
          result.matched += 1;
        } else {
          transactionId = randomUUID();
          repository.insert({ ...row.transaction, id: transactionId, createdAt: Date.now() });
          result.imported += 1;
        }
        repository.link({ fingerprint: importFingerprint(row), transactionId, createdAt: Date.now() });
        repository.clear(transactionId, accountId);
      }
      return result;
    });
  }
  /** Clear a single account leg; completed statements must first be undone.
   * @param {z.infer<typeof clearanceSchema>} input - Validated flag. @returns {void} Saves clearing state. */
  function setClearance(input: z.infer<typeof clearanceSchema>) {
    repository.atomic(() => {
      requireAccount(input.accountId);
      const entry = repository.ledger().find((row) => row.id === input.transactionId);
      if (!entry || accountDelta(entry, input.accountId) === 0) {
        throw new AppError(HTTP.badRequest, 'INVALID_CLEARANCE', 'This transaction does not belong to that account.');
      }
      const clearance = repository
        .clearances()
        .find((row) => row.accountId === input.accountId && row.transactionId === input.transactionId);
      if (clearance?.reconciliationId) {
        throw new AppError(
          HTTP.conflict,
          'RECONCILED',
          'Undo the statement reconciliation before changing cleared entries.',
        );
      }
      if (input.isCleared) {
        repository.clear(input.transactionId, input.accountId);
      } else {
        repository.unclear(input.transactionId, input.accountId);
      }
    });
  }
  /** Complete a matching statement without inventing an adjustment transaction.
   * @param {z.infer<typeof reconcileSchema>} input - Date and exact statement balance. @returns {object} Statement. */
  function reconcile(input: z.infer<typeof reconcileSchema>) {
    return repository.atomic(() => {
      const account = requireAccount(input.accountId);
      const previous = repository.history().find((entry) => entry.accountId === input.accountId);
      if (previous && input.date <= previous.date) {
        throw new AppError(
          HTTP.conflict,
          'STATEMENT_ORDER',
          'Choose a statement date after the latest reconciliation.',
        );
      }
      const cleared = repository.clearances().filter((entry) => entry.accountId === input.accountId);
      const postings = repository
        .ledger()
        .filter(
          (entry) => entry.date <= input.date && cleared.some((clearance) => clearance.transactionId === entry.id),
        );
      const balance = postings.reduce(
        (total, entry) => total + accountDelta(entry, input.accountId),
        account.openingBalance,
      );
      if (balance !== input.statementBalance) {
        throw new AppError(
          HTTP.conflict,
          'BALANCE_MISMATCH',
          'Cleared transactions do not match the statement balance.',
        );
      }
      const id = randomUUID();
      const record = repository.reconcile({ ...input, id, createdAt: Date.now() });
      repository.lock(
        postings
          .filter((entry) => !cleared.find((item) => item.transactionId === entry.id)?.reconciliationId)
          .map((entry) => entry.id),
        input.accountId,
        id,
      );
      return record;
    });
  }
  /** Undo only an account's latest statement to preserve earlier audit history.
   * @param {string} id - Statement ID. @returns {void} Releases locks. */
  function undo(id: string) {
    repository.atomic(() => {
      const history = repository.history();
      const record = history.find((entry) => entry.id === id);
      if (!record) {
        throw new AppError(HTTP.notFound, 'NOT_FOUND', 'Statement not found.');
      }
      if (history.find((entry) => entry.accountId === record.accountId)?.id !== id) {
        throw new AppError(HTTP.conflict, 'STATEMENT_ORDER', 'Undo the latest statement for this account first.');
      }
      repository.undo(id);
    });
  }
  return {
    commit,
    setClearance,
    reconcile,
    undo,
    /** Preview an import. @param {string} accountId - Account. @param {ImportChoice[]} rows - Input.
     * @returns {object[]} Review rows. */
    preview: (accountId: string, rows: Parameters<typeof previewImport>[0]) => {
      validateImport(accountId, rows);
      return previewImport(rows, repository);
    },
    /** Read audit metadata. @returns {object} Clearing state and statement history. */
    state: () => ({
      clearances: repository.clearances(),
      reconciliations: repository.history(),
      importLinks: repository.links().map(({ fingerprint, transactionId }) => ({ fingerprint, transactionId })),
    }),
  };
}

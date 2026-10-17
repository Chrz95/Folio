import type { ReceiptRepository } from './receipt.repository.js';
import type { ReceiptInput } from './receiptValidation.js';
import { RECEIPT } from './receipt.constants.js';
import { AppError } from '../../lib/errors/AppError.js';
import { HTTP } from '../../constants/http.constants.js';
/** Preserve statement locks and account balances while managing supporting files.
 * @param {ReceiptRepository} repository - Persistence boundary. @returns {object} Receipt operations. */
export function createReceiptService(repository: ReceiptRepository) {
  /** Require an existing actual posting. @param {string} id - Transaction ID. @returns {void} Validation. */
  function requireTransaction(id: string) {
    if (!repository.transaction(id)) {
      throw new AppError(HTTP.notFound, 'NOT_FOUND', 'This transaction no longer exists.');
    }
  }
  /** Preserve completed statement evidence. @param {string} id - Transaction ID. @returns {void} Lock validation. */
  function requireUnlocked(id: string) {
    requireTransaction(id);
    if (repository.isReconciled(id)) {
      throw new AppError(
        HTTP.conflict,
        'RECONCILED',
        'Undo the latest statement reconciliation before changing attachments.',
      );
    }
  }
  /** Fetch one existing document. @param {string} id - Receipt ID. @returns {object} File payload. */
  function get(id: string) {
    const entry = repository.get(id);
    if (!entry) {
      throw new AppError(HTTP.notFound, 'NOT_FOUND', 'This attachment no longer exists.');
    }
    return entry;
  }
  return {
    get,
    /** List a posting's metadata only. @param {string} id - Transaction ID. @returns {object[]} Files. */
    list: (id: string) => {
      requireTransaction(id);
      return repository.metadata().filter((entry) => entry.transactionId === id);
    },
    /** Upload with a retry-safe UUID and bounded total storage. @param {string} transactionId - Posting ID.
     * @param {ReceiptInput} input - Validated upload. @returns {object} Acknowledged file. */
    add: (transactionId: string, input: ReceiptInput) =>
      repository.atomic(() => {
        const previous = repository.get(input.id);
        if (previous) {
          if (
            previous.transactionId !== transactionId ||
            previous.content !== input.content ||
            previous.name !== input.name ||
            previous.mimeType !== input.mimeType ||
            previous.size !== input.size
          ) {
            throw new AppError(HTTP.conflict, 'REQUEST_REUSED', 'Use a new upload ID for a different file.');
          }
          return previous;
        }
        requireUnlocked(transactionId);
        const entries = repository.metadata();
        if (
          entries.filter((entry) => entry.transactionId === transactionId).length >= RECEIPT.perTransaction ||
          entries.reduce((sum, entry) => sum + entry.size, 0) + input.size > RECEIPT.workspaceBytes
        ) {
          throw new AppError(
            HTTP.conflict,
            'RECEIPT_LIMIT',
            'Keep up to 5 attachments per transaction and 8 MiB per workspace.',
          );
        }
        return repository.insert({ ...input, transactionId, createdAt: Date.now() });
      }),
    /** Delete supporting evidence only while the posting is editable. @param {string} id - Receipt ID.
     * @returns {void} Durable deletion. */
    remove: (id: string) =>
      repository.atomic(() => {
        const entry = get(id);
        requireUnlocked(entry.transactionId);
        repository.remove(id);
      }),
  };
}

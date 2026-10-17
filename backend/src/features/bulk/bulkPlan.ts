export type BulkInput = { ids: string[] } & ({ action: 'delete' } | { action: 'categorize'; category: string });
interface Posting {
  id: string;
  name: string;
  amount: number;
  type: 'expense' | 'income' | 'transfer';
  category: string;
  accountId: string;
  destinationAccountId: string | null;
  date: string;
  notes: string;
  createdAt: number;
  recurringId: string | null;
}
interface Receipt {
  id: string;
  transactionId: string;
  name: string;
  size: number;
  mimeType: string;
  createdAt: number;
}
export interface BulkSnapshot {
  transactions: Posting[];
  receipts?: Receipt[];
  clearances?: { transactionId: string; accountId: string; reconciliationId: string | null }[];
  importLinks?: { transactionId: string; fingerprint: string }[];
}
/** Derive an exact review revision without exposing receipt bytes or changing any records.
 * @param {BulkSnapshot} data - Actual ledger and related metadata. @param {BulkInput} input - Selected operation.
 * @returns {object} Canonical selection, rows and optimistic revision. */
export function bulkPlan(data: BulkSnapshot, input: BulkInput) {
  const ids = [...input.ids].sort();
  const selection: BulkInput =
    input.action === 'delete' ? { ids, action: 'delete' } : { ids, action: 'categorize', category: input.category };
  const rows = selection.ids.flatMap((id) => {
    const entry = data.transactions.find((transaction) => transaction.id === id);
    if (!entry) {
      return [];
    }
    const transaction = {
      id,
      name: entry.name,
      amount: entry.amount,
      type: entry.type,
      category: entry.category,
      accountId: entry.accountId,
      destinationAccountId: entry.destinationAccountId,
      date: entry.date,
      notes: entry.notes,
      createdAt: entry.createdAt,
      recurringId: entry.recurringId,
    };
    const receipts = (data.receipts ?? [])
      .filter((receipt) => receipt.transactionId === id)
      .map((receipt) => ({
        id: receipt.id,
        name: receipt.name,
        size: receipt.size,
        mimeType: receipt.mimeType,
        createdAt: receipt.createdAt,
      }))
      .sort((first, second) => first.id.localeCompare(second.id));
    const clearances = (data.clearances ?? [])
      .filter((clearance) => clearance.transactionId === id)
      .map((clearance) => ({ accountId: clearance.accountId, reconciliationId: clearance.reconciliationId }))
      .sort((first, second) => first.accountId.localeCompare(second.accountId));
    const importFingerprints = (data.importLinks ?? [])
      .filter((link) => link.transactionId === id)
      .map((link) => link.fingerprint)
      .sort();
    return [
      {
        transaction,
        receipts,
        clearances,
        importFingerprints,
        isLocked: clearances.some((clearance) => Boolean(clearance.reconciliationId)),
      },
    ];
  });
  return { selection, rows, revision: JSON.stringify([selection, rows]) };
}
export type BulkPlan = ReturnType<typeof bulkPlan>;

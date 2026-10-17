import type { ImportRow } from '../../types/operations';
import type { DemoRepository } from './demoRepository';
import { STATEMENTS } from './statements.constants';
/** Normalize merchant descriptions without depending on CSV filename or row order.
 * @param {string} name - Bank label. @returns {string} Canonical label. */
function normalizeName(name: string) {
  return name.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
}
/** Build a stable key; identical same-day purchases need distinct mapped bank IDs.
 * @param {ImportRow} row - Validated bank row. @returns {string} Canonical private-database key. */
export function importFingerprint(row: ImportRow) {
  const { transaction, bankId } = row;
  return JSON.stringify(
    bankId
      ? [transaction.accountId, 'bank-id', bankId]
      : [
          transaction.accountId,
          transaction.date,
          transaction.type,
          transaction.amount,
          normalizeName(transaction.name),
        ],
  );
}
/** Compute signed account movement, including a transfer's destination leg.
 * @param {object} entry - Posting. @param {number} entry.amount - Cents.
 * @param {string} entry.type - Kind. @param {string} entry.accountId - Source.
 * @param {string | null} entry.destinationAccountId - Transfer target. @param {string} accountId - Statement account.
 * @returns {number} Signed cents. */
export function accountDelta(
  entry: { amount: number; type: string; accountId: string; destinationAccountId: string | null },
  accountId: string,
) {
  if (entry.type === 'transfer') {
    return entry.destinationAccountId === accountId ? entry.amount : entry.accountId === accountId ? -entry.amount : 0;
  }
  return entry.accountId === accountId ? entry.amount * (entry.type === 'income' ? 1 : -1) : 0;
}
/** Suggest bounded, explicit matches; commits revalidate against the current ledger.
 * @param {ImportRow[]} rows - Bank data. @param {DemoRepository} repository - Read boundary.
 * @returns {object[]} Preview choices and candidate details. */
export function previewImport(rows: ImportRow[], repository: DemoRepository) {
  const ledger = repository.ledger();
  const links = repository.links();
  const fingerprints = new Set(links.map((link) => link.fingerprint));
  const reserved = new Set<string>();
  return rows.map((row) => {
    const fingerprint = importFingerprint(row);
    const isDuplicate = fingerprints.has(fingerprint);
    fingerprints.add(fingerprint);
    const candidates = isDuplicate
      ? []
      : ledger
          .filter((entry) => {
            const days =
              Math.abs(Date.parse(entry.date) - Date.parse(row.transaction.date)) / STATEMENTS.dayMilliseconds;
            return (
              accountDelta(entry, row.transaction.accountId) ===
                accountDelta(row.transaction, row.transaction.accountId) &&
              days <= STATEMENTS.matchWindowDays &&
              !reserved.has(entry.id) &&
              !links.some(
                (link) =>
                  link.transactionId === entry.id && JSON.parse(link.fingerprint)[0] === row.transaction.accountId,
              )
            );
          })
          .map((entry) => ({ id: entry.id, name: entry.name, date: entry.date }));
    const [candidate] = candidates;
    const hasUniqueMatch = candidates.length === 1 && candidate;
    if (hasUniqueMatch) {
      reserved.add(candidate.id);
    }
    return {
      ...row,
      fingerprint,
      isDuplicate,
      candidates,
      matchId: hasUniqueMatch ? candidate.id : undefined,
      action:
        isDuplicate || candidates.length > 1
          ? ('skip' as const)
          : hasUniqueMatch
            ? ('match' as const)
            : ('new' as const),
      reason: isDuplicate
        ? 'Already imported or repeated in this file.'
        : candidates.length > 1
          ? 'Several possible matches. Choose one or import separately.'
          : hasUniqueMatch
            ? 'Possible existing entry. Review before matching.'
            : 'New statement transaction.',
    };
  });
}

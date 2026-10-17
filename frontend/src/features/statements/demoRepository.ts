import { categoryNames } from '../planning/catalog';
import type { BudgetData, Transaction } from '../../types/budget';
import type { Reconciliation } from '../../types/operations';
import { writeDemo } from '../../lib/storage/demoStore';
/** Create an atomic preview adapter: mutate a fresh snapshot and persist only after successful work.
 * @param {BudgetData} data - Isolated snapshot. @returns {object} Demo repository. */
export function createDemoRepository(data: BudgetData) {
  data.clearances ??= [];
  data.reconciliations ??= [];
  data.importLinks ??= [];
  return {
    /** Validate imported catalog names. @param {string} name - Category. @returns {void} Catalog validation. */
    validateCategory: (name: string) => {
      if (!categoryNames(data).includes(name)) {
        throw new Error('Choose an active category.');
      }
    },
    /** Read current postings. @returns {Transaction[]} Ledger. */
    ledger: () => data.transactions,
    /** Read import identities. @returns {object[]} Links. */
    links: () => data.importLinks ?? [],
    /** Read account legs. @returns {object[]} Clearing flags. */
    clearances: () => data.clearances ?? [],
    /** Read newest statements. @returns {Reconciliation[]} History. */
    history: () => [...(data.reconciliations ?? [])].sort((first, second) => second.date.localeCompare(first.date)),
    /** Find a target account. @param {string} id - Account. @returns {object | undefined} Account. */
    account: (id: string) => data.accounts.find((entry) => entry.id === id),
    /** Save after all work succeeds. @param {() => T} operation - Pure synchronous mutation. @returns {T} Result. */
    atomic: <T>(operation: () => T): T => {
      const result = operation();
      writeDemo(data);
      return result;
    },
    /** Create an actual posting. @param {Transaction} value - Posting. @returns {Transaction} Saved record. */
    insert: (value: Transaction) => {
      data.transactions.push(value);
      return value;
    },
    /** Attach an import identity. @param {object} value - Link. @param {string} value.fingerprint - Identity.
     * @param {string} value.transactionId - Target. @returns {void} Updates draft. */
    link: (value: { fingerprint: string; transactionId: string }) => {
      data.importLinks?.push(value);
    },
    /** Clear only one side of a transfer. @param {string} transactionId - Posting. @param {string} accountId - Account.
     * @returns {void} Keeps reconciliation locks. */
    clear: (transactionId: string, accountId: string) => {
      if (!data.clearances?.some((entry) => entry.transactionId === transactionId && entry.accountId === accountId)) {
        data.clearances?.push({ transactionId, accountId, reconciliationId: null });
      }
    },
    /** Unclear an unlocked leg. @param {string} transactionId - Posting. @param {string} accountId - Account.
     * @returns {void} Changes the draft. */
    unclear: (transactionId: string, accountId: string) => {
      data.clearances = data.clearances?.filter(
        (entry) => entry.transactionId !== transactionId || entry.accountId !== accountId,
      );
    },
    /** Record a completed statement. @param {Reconciliation} value - Snapshot. @returns {Reconciliation} Record. */
    reconcile: (value: Reconciliation) => {
      data.reconciliations?.push(value);
      return value;
    },
    /** Lock statement legs. @param {string[]} ids - Postings. @param {string} accountId - Account.
     * @param {string} id - Statement. @returns {void} Updates matching legs. */
    lock: (ids: string[], accountId: string, id: string) => {
      data.clearances = data.clearances?.map((entry) =>
        entry.accountId === accountId && ids.includes(entry.transactionId) ? { ...entry, reconciliationId: id } : entry,
      );
    },
    /** Undo the validated latest statement. @param {string} id - Statement. @returns {void} Keeps cleared flags. */
    undo: (id: string) => {
      data.clearances = data.clearances?.map((entry) =>
        entry.reconciliationId === id ? { ...entry, reconciliationId: null } : entry,
      );
      data.reconciliations = data.reconciliations?.filter((entry) => entry.id !== id);
    },
  };
}
export type DemoRepository = ReturnType<typeof createDemoRepository>;

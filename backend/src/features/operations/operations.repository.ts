import { requireCategory } from '../planning/categoryValidation.js';
import { and, eq, desc, inArray } from 'drizzle-orm';
import { accounts, transactions } from '../../db/schema/budget.js';
import { clearances, reconciliations, importLinks } from '../../db/schema/operations.js';
import type { DatabaseClient } from '../../db/client.js';
/** Own statement/import SQL and keep caller transactions synchronous and atomic.
 * @param {DatabaseClient} client - Application connection.
 * @returns {object} Typed persistence operations. */
export function createOperationsRepository(client: DatabaseClient) {
  const { database } = client;
  return {
    /** Reject unrecognized categories during import. @param {string} name - Active category.
     * @returns {void} Catalog validation. */
    validateCategory: (name: string) => requireCategory(client, name),
    /** Read postings for matching and statement arithmetic. @returns {object[]} Actual ledger. */
    ledger: () => database.select().from(transactions).all(),
    /** Read bank fingerprints. @returns {object[]} Deduplication metadata. */
    links: () => database.select().from(importLinks).all(),
    /** Read per-account clearing. @returns {object[]} Clearing metadata. */
    clearances: () => database.select().from(clearances).all(),
    /** Read completed statements in chronological reverse order. @returns {object[]} Statement history. */
    history: () =>
      database
        .select()
        .from(reconciliations)
        .orderBy(desc(reconciliations.date), desc(reconciliations.createdAt))
        .all(),
    /** Find an account. @param {string} id - UUID. @returns {object | undefined} Opening balance. */
    account: (id: string) => database.select().from(accounts).where(eq(accounts.id, id)).get(),
    /** Execute a short atomic unit. @param {() => T} operation - Synchronous work. @returns {T} Result. */
    atomic: <T>(operation: () => T): T => database.transaction(() => operation()),
    /** Insert a posting. @param {typeof transactions.$inferInsert} value - Record. @returns {object} Created row. */
    insert: (value: typeof transactions.$inferInsert) => database.insert(transactions).values(value).returning().get(),
    /** Attach a bank fingerprint.
     * @param {typeof importLinks.$inferInsert} value - Link.
     * @returns {object} Write result. */
    link: (value: typeof importLinks.$inferInsert) => database.insert(importLinks).values(value).run(),
    /** Mark a statement leg cleared without removing a reconciliation lock.
     * @param {string} transactionId - Posting. @param {string} accountId - Statement account.
     * @returns {object} Write result. */
    clear: (transactionId: string, accountId: string) =>
      database.insert(clearances).values({ transactionId, accountId }).onConflictDoNothing().run(),
    /** Unclear a previously validated unlocked leg.
     * @param {string} transactionId - Posting. @param {string} accountId - Statement account.
     * @returns {object} Write result. */
    unclear: (transactionId: string, accountId: string) =>
      database
        .delete(clearances)
        .where(and(eq(clearances.transactionId, transactionId), eq(clearances.accountId, accountId)))
        .run(),
    /** Insert a completed statement.
     * @param {typeof reconciliations.$inferInsert} value - Auditable snapshot. @returns {object} Saved statement. */
    reconcile: (value: typeof reconciliations.$inferInsert) =>
      database.insert(reconciliations).values(value).returning().get(),
    /** Lock only the selected account legs.
     * @param {string[]} ids - Cleared postings. @param {string} accountId - Account. @param {string} id - Statement.
     * @returns {void} Applies statement locks. */
    lock: (ids: string[], accountId: string, id: string) => {
      if (ids.length) {
        database
          .update(clearances)
          .set({ reconciliationId: id })
          .where(and(eq(clearances.accountId, accountId), inArray(clearances.transactionId, ids)))
          .run();
      }
    },
    /** Undo the validated most recent statement while retaining cleared flags.
     * @param {string} id - Statement ID. @returns {void} Clears locks before deleting their parent. */
    undo: (id: string) => {
      database.update(clearances).set({ reconciliationId: null }).where(eq(clearances.reconciliationId, id)).run();
      database.delete(reconciliations).where(eq(reconciliations.id, id)).run();
    },
  };
}
export type OperationsRepository = ReturnType<typeof createOperationsRepository>;

import { eq } from 'drizzle-orm';
import type { DatabaseClient } from '../../db/client.js';
import { receipts } from '../../db/schema/receipts.js';
import { createBudgetRepository } from '../budget/budget.repository.js';
/** Keep receipt bytes out of list queries and group quota validation with writes.
 * @param {DatabaseClient} client - Migrated connection. @returns {object} Receipt repository. */
export function createReceiptRepository(client: DatabaseClient) {
  const { database } = client;
  const budget = createBudgetRepository(client);
  return {
    transaction: budget.getTransaction,
    isReconciled: budget.isReconciled,
    /** Read only lightweight metadata. @returns {object[]} Stored document metadata. */
    metadata: () =>
      database
        .select({
          id: receipts.id,
          transactionId: receipts.transactionId,
          name: receipts.name,
          mimeType: receipts.mimeType,
          size: receipts.size,
          createdAt: receipts.createdAt,
        })
        .from(receipts)
        .all(),
    /** Read one download payload. @param {string} id - Document ID. @returns {object | undefined} File. */
    get: (id: string) => database.select().from(receipts).where(eq(receipts.id, id)).get(),
    /** Insert an acknowledged upload. @param {typeof receipts.$inferInsert} value - Validated file.
     * @returns {object} Receipt metadata and bytes. */
    insert: (value: typeof receipts.$inferInsert) => database.insert(receipts).values(value).returning().get(),
    /** Remove one document. @param {string} id - Receipt ID. @returns {void} Completes deletion. */
    remove: (id: string) => {
      database.delete(receipts).where(eq(receipts.id, id)).run();
    },
    /** Atomically enforce quotas and persistence. @param {() => T} operation - Synchronous action.
     * @returns {T} Complete result. */
    atomic: <T>(operation: () => T): T => database.transaction(operation),
  };
}
export type ReceiptRepository = ReturnType<typeof createReceiptRepository>;

import { eq, inArray } from 'drizzle-orm';
import type { DatabaseClient } from '../../db/client.js';
import { transactions } from '../../db/schema/budget.js';
import { receipts } from '../../db/schema/receipts.js';
import { clearances, importLinks } from '../../db/schema/operations.js';
/** Read only selected rows and related metadata, and expose atomic bulk writes.
 * @param {DatabaseClient} client - Existing SQLite connection. @returns {object} Bulk persistence boundary. */
export function createBulkRepository(client: DatabaseClient) {
  const { database } = client;
  return {
    /** Obtain selected actual postings and supporting identities without file contents.
     * @param {string[]} ids - Bounded, unique UUIDs. @returns {object} Authoritative snapshot. */
    snapshot: (ids: string[]) => ({
      transactions: database.select().from(transactions).where(inArray(transactions.id, ids)).all(),
      receipts: database
        .select({
          id: receipts.id,
          transactionId: receipts.transactionId,
          name: receipts.name,
          size: receipts.size,
          mimeType: receipts.mimeType,
          createdAt: receipts.createdAt,
        })
        .from(receipts)
        .where(inArray(receipts.transactionId, ids))
        .all(),
      clearances: database.select().from(clearances).where(inArray(clearances.transactionId, ids)).all(),
      importLinks: database.select().from(importLinks).where(inArray(importLinks.transactionId, ids)).all(),
    }),
    /** Update only the category, retaining all financial fields and audit identities.
     * @param {string} id - Posting UUID. @param {string} category - Active name. @returns {void} Durable update. */
    categorize: (id: string, category: string) => {
      database.update(transactions).set({ category }).where(eq(transactions.id, id)).run();
    },
    /** Delete a posting with SQLite cascades for its files, clearing legs and import identities.
     * @param {string} id - Posting UUID. @returns {void} Durable removal. */
    remove: (id: string) => {
      database.delete(transactions).where(eq(transactions.id, id)).run();
    },
    /** Keep review validation and all writes in one short synchronous transaction.
     * @param {() => T} action - Domain operation. @returns {T} All-or-nothing result. */
    atomic: <T>(action: () => T): T => database.transaction(action),
  };
}
export type BulkRepository = ReturnType<typeof createBulkRepository>;

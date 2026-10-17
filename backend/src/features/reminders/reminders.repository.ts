import { eq } from 'drizzle-orm';
import { subscriptions, deliveries } from '../../db/schema/budget.js';
import type { DatabaseClient } from '../../db/client.js';
/** Encapsulate subscription and delivery-ledger queries.
 * @param {DatabaseClient} client - Application connection.
 * @returns {object} Push persistence boundary. */
export function createReminderRepository(client: DatabaseClient) {
  const { database } = client;
  return {
    /** Read browser subscriptions for the next bounded reminder scan.
     * @returns {object[]} Operation result. */
    list: () => database.select().from(subscriptions).all(),
    /** Atomically insert or replace a browser subscription.
     * @param {typeof subscriptions.$inferInsert} value - Typed boundary input.
     * @returns {object} Operation result. */
    save: (value: typeof subscriptions.$inferInsert) =>
      database
        .insert(subscriptions)
        .values(value)
        .onConflictDoUpdate({ target: subscriptions.endpoint, set: value })
        .run(),
    /** Delete a browser subscription after opt-out or provider expiry.
     * @param {string} endpoint - Typed boundary input.
     * @returns {object} Operation result. */
    remove: (endpoint: string) => database.delete(subscriptions).where(eq(subscriptions.endpoint, endpoint)).run(),
    /** Check the persistent acknowledgment ledger before delivering a reminder.
     * @param {string} id - Stable resource identifier.
     * @returns {boolean} Operation result. */
    wasDelivered: (id: string) => Boolean(database.select().from(deliveries).where(eq(deliveries.id, id)).get()),
    /** Record a successful delivery acknowledgment idempotently.
     * @param {string} id - Stable resource identifier.
     * @returns {object} Operation result. */
    markDelivered: (id: string) =>
      database.insert(deliveries).values({ id, deliveredAt: Date.now() }).onConflictDoNothing().run(),
  };
}

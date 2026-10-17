import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { DatabaseClient } from '../../db/client.js';
import { subscriptions, deliveries } from '../../db/schema/budget.js';
import { PUSH } from './push.constants.js';
/** Expose per-device lookup and a persistent atomic test cooldown without leaking endpoint URLs.
 * @param {DatabaseClient} client - Migrated connection. @returns {object} Device persistence. */
export function createDeviceRepository(client: DatabaseClient) {
  const { database } = client;
  return {
    /** Find one explicitly submitted device. @param {string} endpoint - Current device endpoint.
     * @returns {object | undefined} Stored subscription. */
    get: (endpoint: string) => database.select().from(subscriptions).where(eq(subscriptions.endpoint, endpoint)).get(),
    /** Count opted-in devices without returning credentials. @returns {number} Registered subscription count. */
    count: () => database.select({ endpoint: subscriptions.endpoint }).from(subscriptions).all().length,
    /** Reserve before contacting the provider, preventing concurrent test requests from sending duplicates.
     * @param {string} endpoint - Current device. @param {number} now - Clock.
     * @returns {boolean} Whether this request reserved the cooldown slot. */
    reserveTest: (endpoint: string, now: number) =>
      database.transaction(() => {
        const id = PUSH.testPrefix + createHash('sha256').update(endpoint).digest('hex');
        const previous = database.select().from(deliveries).where(eq(deliveries.id, id)).get();
        if (previous && now - previous.deliveredAt < PUSH.testCooldown) {
          return false;
        }
        database
          .insert(deliveries)
          .values({ id, deliveredAt: now })
          .onConflictDoUpdate({ target: deliveries.id, set: { deliveredAt: now } })
          .run();
        return true;
      }),
    /** Remove an expired or explicitly disconnected device. @param {string} endpoint - Device.
     * @returns {void} Deleted subscription. */
    remove: (endpoint: string) => {
      database.delete(subscriptions).where(eq(subscriptions.endpoint, endpoint)).run();
    },
  };
}
export type DeviceRepository = ReturnType<typeof createDeviceRepository>;

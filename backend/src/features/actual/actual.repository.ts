import { portableScheduleControl } from '../schedules/scheduleControls.repository.js';
import type { DatabaseClient } from '../../db/client.js';
import { accounts, transactions, recurring } from '../../db/schema/budget.js';
import { monthlyBudgets, customCategories } from '../../db/schema/planning.js';
import { clearances } from '../../db/schema/operations.js';
import { scheduleSettings, skippedOccurrences } from '../../db/schema/schedules.js';
import type { ActualData } from './actualSchema.js';
/** Own the destination queries; imported SQL never reaches the application database.
 * @param {DatabaseClient} client - Existing migrated SQLite connection. @returns {object} Additive repository. */
export function createActualRepository(client: DatabaseClient) {
  const { database } = client;
  return {
    /** Read the complete affected financial state without receipt bytes or credentials.
     * @returns {object} Review boundary. */
    snapshot: () => ({
      accounts: database.select().from(accounts).all(),
      transactions: database.select().from(transactions).all(),
      recurring: database.select().from(recurring).all(),
      monthlyBudgets: database.select().from(monthlyBudgets).all(),
      customCategories: database
        .select({ id: customCategories.id, name: customCategories.name, isArchived: customCategories.isArchived })
        .from(customCategories)
        .all(),
      clearances: database.select().from(clearances).all(),
      scheduleSettings: database.select().from(scheduleSettings).all().map(portableScheduleControl),
      skippedOccurrences: database.select().from(skippedOccurrences).all(),
    }),
    /** Insert in foreign-key order; the caller's transaction covers every row.
     * @param {ActualData} rows - Reviewed additions. @returns {void} Durable rows. */
    insert: (rows: ActualData) => {
      rows.accounts.forEach((row) => database.insert(accounts).values(row).run());
      rows.customCategories.forEach((row) =>
        database
          .insert(customCategories)
          .values({ ...row, normalizedName: row.name.toLowerCase() })
          .run(),
      );
      rows.recurring.forEach((row) => database.insert(recurring).values(row).run());
      rows.scheduleSettings.forEach((row) => database.insert(scheduleSettings).values(row).run());
      rows.transactions.forEach((row) => database.insert(transactions).values(row).run());
      rows.monthlyBudgets.forEach((row) => database.insert(monthlyBudgets).values(row).run());
      rows.skippedOccurrences.forEach((row) => database.insert(skippedOccurrences).values(row).run());
      rows.clearances.forEach((row) => database.insert(clearances).values(row).run());
    },
    /** Keep revision checks and writes indivisible. @param {() => T} action - Synchronous operation.
     * @returns {T} Committed result. */
    atomic: <T>(action: () => T): T => database.transaction(action),
  };
}
export type ActualRepository = ReturnType<typeof createActualRepository>;

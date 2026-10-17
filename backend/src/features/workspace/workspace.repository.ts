import type { DatabaseClient } from '../../db/client.js';
import { accounts, transactions, recurring, budgets } from '../../db/schema/budget.js';
import { customCategories, monthlyBudgets, savingsGoals, goalContributions } from '../../db/schema/planning.js';
import { receipts } from '../../db/schema/receipts.js';
import { clearances, reconciliations, importLinks, reminderSnoozes } from '../../db/schema/operations.js';
import { skippedOccurrences, scheduleSettings } from '../../db/schema/schedules.js';
import { workspaceSnapshot } from '../receipts/workspaceSnapshot.js';
import type { RestorableWorkspace } from './backupSchema.js';
/** Own all replacement SQL; no schema migration or file swap occurs while the server is serving requests.
 * @param {DatabaseClient} client - Existing migrated connection. @returns {object} Replacement persistence. */
export function createWorkspaceRepository(client: DatabaseClient) {
  const { database } = client;
  return {
    /** Read a consistent financial snapshot, including supporting file bytes.
     * @returns {object} Complete current financial state. */
    snapshot: () => workspaceSnapshot(client),
    /** Replace only financial rows in foreign-key order; subscriptions and notification history remain intact.
     * @param {RestorableWorkspace} data - Fully validated effective source. @returns {void} Replacement writes. */
    replace: (data: RestorableWorkspace) => {
      database.delete(receipts).run();
      database.delete(clearances).run();
      database.delete(importLinks).run();
      database.delete(reconciliations).run();
      database.delete(transactions).run();
      database.delete(reminderSnoozes).run();
      database.delete(skippedOccurrences).run();
      database.delete(scheduleSettings).run();
      database.delete(recurring).run();
      database.delete(goalContributions).run();
      database.delete(savingsGoals).run();
      database.delete(monthlyBudgets).run();
      database.delete(budgets).run();
      database.delete(customCategories).run();
      database.delete(accounts).run();
      data.accounts.forEach((row) => database.insert(accounts).values(row).run());
      data.customCategories.forEach((row) =>
        database
          .insert(customCategories)
          .values({ ...row, normalizedName: row.name.toLowerCase() })
          .run(),
      );
      data.budgets.forEach((row) => database.insert(budgets).values(row).run());
      data.monthlyBudgets.forEach((row) => database.insert(monthlyBudgets).values(row).run());
      data.goals.forEach((row) => database.insert(savingsGoals).values(row).run());
      data.contributions.forEach((row) => database.insert(goalContributions).values(row).run());
      data.recurring.forEach((row) => database.insert(recurring).values(row).run());
      data.scheduleSettings.forEach((row) => database.insert(scheduleSettings).values(row).run());
      data.skippedOccurrences.forEach((row) => database.insert(skippedOccurrences).values(row).run());
      data.transactions.forEach((row) => database.insert(transactions).values(row).run());
      data.reconciliations.forEach((row) => database.insert(reconciliations).values(row).run());
      data.clearances.forEach((row) => database.insert(clearances).values(row).run());
      data.importLinks.forEach((row) =>
        database
          .insert(importLinks)
          .values({ ...row, createdAt: 0 })
          .run(),
      );
      data.receipts.forEach((row) => database.insert(receipts).values(row).run());
    },
    /** Keep state checking and every deletion/insertion in one SQLite transaction.
     * @param {() => T} action - Synchronous unit. @returns {T} Committed result. */
    atomic: <T>(action: () => T): T => database.transaction(action),
  };
}
export type WorkspaceRepository = ReturnType<typeof createWorkspaceRepository>;

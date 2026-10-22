import { portableScheduleControl } from '../schedules/scheduleControls.repository.js';
import { scheduleSettings, skippedOccurrences } from '../../db/schema/schedules.js';
import type { DatabaseClient } from '../../db/client.js';
import { accounts, transactions, recurring, budgets } from '../../db/schema/budget.js';
import { customCategories, monthlyBudgets, savingsGoals, goalContributions } from '../../db/schema/planning.js';
import { clearances, reconciliations, importLinks } from '../../db/schema/operations.js';
import { receipts } from '../../db/schema/receipts.js';
/** Export one consistent financial snapshot, including file bytes, without subscriptions or delivery credentials.
 * @param {DatabaseClient} client - Existing connection. @returns {object} Portable financial workspace. */
export function workspaceSnapshot(client: DatabaseClient) {
  const { database } = client;
  return database.transaction(() => ({
    scheduleSettings: database.select().from(scheduleSettings).all().map(portableScheduleControl),
    skippedOccurrences: database.select().from(skippedOccurrences).all(),
    accounts: database.select().from(accounts).all(),
    transactions: database.select().from(transactions).all(),
    recurring: database.select().from(recurring).all(),
    budgets: database.select().from(budgets).all(),
    customCategories: database.select().from(customCategories).all(),
    monthlyBudgets: database.select().from(monthlyBudgets).all(),
    goals: database.select().from(savingsGoals).all(),
    contributions: database.select().from(goalContributions).all(),
    clearances: database.select().from(clearances).all(),
    reconciliations: database.select().from(reconciliations).all(),
    importLinks: database
      .select({ fingerprint: importLinks.fingerprint, transactionId: importLinks.transactionId })
      .from(importLinks)
      .all(),
    receipts: database.select().from(receipts).all(),
  }));
}

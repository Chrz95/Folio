import { eq } from 'drizzle-orm';
import { budgets } from '../../db/schema/budget.js';
import type { DatabaseClient } from '../../db/client.js';
import { monthlyBudgets, customCategories, savingsGoals, goalContributions } from '../../db/schema/planning.js';
/** Expose typed planning persistence without coupling services to HTTP.
 * @param {DatabaseClient} client - Migrated SQLite connection. @returns {object} Planning repository. */
export function createPlanningRepository(client: DatabaseClient) {
  const { database } = client;
  return {
    /** Read allocations and categories for an authoritative copy review. @returns {object} Planning snapshot. */
    copySnapshot: () => ({
      budgets: database.select().from(budgets).all(),
      monthlyBudgets: database.select().from(monthlyBudgets).all(),
      customCategories: database.select().from(customCategories).all(),
    }),
    /** Read complete planning metadata. @returns {object} Workspace additions. */
    state: () => ({
      monthlyBudgets: database.select().from(monthlyBudgets).all(),
      customCategories: database.select().from(customCategories).all(),
      goals: database.select().from(savingsGoals).all(),
      contributions: database.select().from(goalContributions).all(),
    }),
    /** Save exactly one month. @param {typeof monthlyBudgets.$inferInsert} value - Allocation.
     * @returns {object} Persisted allocation. */
    saveBudget: (value: typeof monthlyBudgets.$inferInsert) =>
      database
        .insert(monthlyBudgets)
        .values(value)
        .onConflictDoUpdate({ target: [monthlyBudgets.month, monthlyBudgets.category], set: value })
        .returning()
        .get(),
    /** Create an immutable category name. @param {typeof customCategories.$inferInsert} value - Category.
     * @returns {object} Stored category. */
    addCategory: (value: typeof customCategories.$inferInsert) =>
      database.insert(customCategories).values(value).returning().get(),
    /** Archive without rewriting history. @param {string} id - Category ID. @param {boolean} isArchived - Flag.
     * @returns {object | undefined} Existing category. */
    archiveCategory: (id: string, isArchived: boolean) =>
      database.update(customCategories).set({ isArchived }).where(eq(customCategories.id, id)).returning().get(),
    /** Create a goal. @param {typeof savingsGoals.$inferInsert} value - Goal.
     * @returns {object} Persisted goal. */
    addGoal: (value: typeof savingsGoals.$inferInsert) => database.insert(savingsGoals).values(value).returning().get(),
    /** Edit or archive a goal. @param {string} id - Goal ID.
     * @param {Omit<typeof savingsGoals.$inferInsert, 'id'>} value - Goal details.
     * @returns {object | undefined} Goal. */
    updateGoal: (id: string, value: Omit<typeof savingsGoals.$inferInsert, 'id'>) =>
      database.update(savingsGoals).set(value).where(eq(savingsGoals.id, id)).returning().get(),
    /** Read a goal. @param {string} id - Goal ID. @returns {object | undefined} Goal. */
    goal: (id: string) => database.select().from(savingsGoals).where(eq(savingsGoals.id, id)).get(),
    /** Read a previously acknowledged contribution. @param {string} id - Request UUID.
     * @returns {object | undefined} Contribution. */
    contribution: (id: string) => database.select().from(goalContributions).where(eq(goalContributions.id, id)).get(),
    /** Calculate recorded progress. @param {string} goalId - Goal ID. @returns {number} Saved cents. */
    progress: (goalId: string) =>
      database
        .select()
        .from(goalContributions)
        .where(eq(goalContributions.goalId, goalId))
        .all()
        .reduce((sum, entry) => sum + entry.amount, 0),
    /** Insert one contribution. @param {typeof goalContributions.$inferInsert} value - Contribution.
     * @returns {object} Persisted record. */
    addContribution: (value: typeof goalContributions.$inferInsert) =>
      database.insert(goalContributions).values(value).returning().get(),
    /** Group validation and writes into one synchronous SQLite transaction.
     * @param {() => T} action - Domain action. @returns {T} Atomic result. */
    atomic: <T>(action: () => T): T => database.transaction(action),
  };
}
export type PlanningRepository = ReturnType<typeof createPlanningRepository>;

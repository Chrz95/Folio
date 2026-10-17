import { scheduleSettings, skippedOccurrences } from '../../db/schema/schedules.js';
import { requireCategory } from '../planning/categoryValidation.js';
import { clearances } from '../../db/schema/operations.js';
import { eq, desc, count, and, isNotNull } from 'drizzle-orm';
import { accounts, transactions, recurring, budgets } from '../../db/schema/budget.js';
import type { DatabaseClient } from '../../db/client.js';
/** Create a typed persistence boundary with short synchronous transactions.
 * @param {DatabaseClient} client - One connection for this application.
 * @returns {object} Budget repository. */
export function createBudgetRepository(client: DatabaseClient) {
  const { database } = client;
  return {
    /** Read controls for authoritative occurrence checks. @returns {object} Saved schedule policy. */
    scheduleState: () => ({
      scheduleSettings: database.select().from(scheduleSettings).all(),
      skippedOccurrences: database.select().from(skippedOccurrences).all(),
    }),
    /** Check categories at the persistence boundary. @param {string} name - Category name.
     * @param {string} previous - Existing value retained while editing. @returns {void} Validation result. */
    validateCategory: (name: string, previous?: string) => requireCategory(client, name, previous),
    /** Read recorded occurrences for reminder deduplication. @returns {object[]} Complete personal ledger. */
    reminderPostings: () => database.select().from(transactions).all(),
    /** Check audit locks before changing a posting. @param {string} id - Posting UUID.
     * @returns {boolean} Whether any account has reconciled this transaction. */
    isReconciled: (id: string) =>
      Boolean(
        database
          .select()
          .from(clearances)
          .where(and(eq(clearances.transactionId, id), isNotNull(clearances.reconciliationId)))
          .get(),
      ),
    /** Read one deterministically ordered, bounded ledger page.
     * @param {number} limit - Maximum row count.
     * @param {number} offset - Number of rows to skip.
     * @returns {object[]} Operation result. */
    listTransactions: (limit: number, offset: number) =>
      database
        .select()
        .from(transactions)
        .orderBy(desc(transactions.date), desc(transactions.id))
        .limit(limit)
        .offset(offset)
        .all(),
    /** Count actual postings for pagination metadata.
     * @returns {number} Operation result. */
    countTransactions: () => database.select({ total: count() }).from(transactions).get()?.total ?? 0,
    /** Look up an actual posting by its validated identifier.
     * @param {string} id - Stable resource identifier.
     * @returns {object} Operation result. */
    getTransaction: (id: string) => database.select().from(transactions).where(eq(transactions.id, id)).get(),
    /** Persist a new actual posting with database-enforced invariants.
     * @param {typeof transactions.$inferInsert} value - Typed boundary input.
     * @returns {object} Operation result. */
    insertTransaction: (value: typeof transactions.$inferInsert) =>
      database.insert(transactions).values(value).returning().get(),
    /** Replace editable posting fields while retaining its audit identity.
     * @param {string} id - Stable resource identifier.
     * @param {Partial<typeof transactions.$inferInsert>} value - Typed boundary input.
     * @returns {object} Operation result. */
    updateTransaction: (id: string, value: Partial<typeof transactions.$inferInsert>) =>
      database.update(transactions).set(value).where(eq(transactions.id, id)).returning().get(),
    /** Delete an actual posting and return the removed row.
     * @param {string} id - Stable resource identifier.
     * @returns {object} Operation result. */
    deleteTransaction: (id: string) => database.delete(transactions).where(eq(transactions.id, id)).returning().get(),
    /** Read manual accounts and their opening balances.
     * @returns {object[]} Operation result. */
    listAccounts: () => database.select().from(accounts).all(),
    /** Create a manual account without generating any postings.
     * @param {typeof accounts.$inferInsert} value - Typed boundary input.
     * @returns {object} Operation result. */
    addAccount: (value: typeof accounts.$inferInsert) => database.insert(accounts).values(value).returning().get(),
    /** Check whether a scheduled date already has an actual posting.
     * @param {string} id - Stable resource identifier.
     * @param {string} date - ISO calendar date.
     * @returns {boolean} Operation result. */
    hasOccurrence: (id: string, date: string) =>
      Boolean(
        database
          .select()
          .from(transactions)
          .where(and(eq(transactions.recurringId, id), eq(transactions.date, date)))
          .get(),
      ),
    /** Read one-time and repeating schedule definitions.
     * @returns {object[]} Operation result. */
    listRecurring: () => database.select().from(recurring).all(),
    /** Look up the original anchor and fields of a schedule.
     * @param {string} id - Stable resource identifier.
     * @returns {object} Operation result. */
    getRecurring: (id: string) => database.select().from(recurring).where(eq(recurring.id, id)).get(),
    /** Persist a schedule without affecting actual account balances.
     * @param {typeof recurring.$inferInsert} value - Typed boundary input.
     * @returns {object} Operation result. */
    addRecurring: (value: typeof recurring.$inferInsert) => database.insert(recurring).values(value).returning().get(),
    /** Change future schedule rules without rewriting actual history.
     * @param {string} id - Stable resource identifier.
     * @param {Partial<typeof recurring.$inferInsert>} value - Typed boundary input.
     * @returns {object} Operation result. */
    updateRecurring: (id: string, value: Partial<typeof recurring.$inferInsert>) =>
      database.transaction(() => {
        const previous = database.select().from(recurring).where(eq(recurring.id, id)).get();
        const updated = database.update(recurring).set(value).where(eq(recurring.id, id)).returning().get();
        if (
          previous &&
          ((value.date !== undefined && value.date !== previous.date) ||
            (value.frequency !== undefined && value.frequency !== previous.frequency))
        ) {
          database.delete(skippedOccurrences).where(eq(skippedOccurrences.recurringId, id)).run();
        }
        return updated;
      }),
    /** Remove a schedule while preserving its posted transactions.
     * @param {string} id - Stable resource identifier.
     * @returns {object} Operation result. */
    deleteRecurring: (id: string) => database.delete(recurring).where(eq(recurring.id, id)).returning().get(),
    /** Read category spending limits shared by month views.
     * @returns {object[]} Operation result. */
    listBudgets: () => database.select().from(budgets).all(),
    /** Atomically insert or update a category spending limit.
     * @param {typeof budgets.$inferInsert} value - Typed boundary input.
     * @returns {object} Operation result. */
    saveBudget: (value: typeof budgets.$inferInsert) =>
      database
        .insert(budgets)
        .values(value)
        .onConflictDoUpdate({ target: budgets.category, set: { amount: value.amount } })
        .returning()
        .get(),
    /** Return an existing posting or build a freshly validated value inside one transaction.
     * @param {string} id - Schedule ID. @param {string} date - Occurrence date.
     * @param {() => typeof transactions.$inferInsert} create - Re-read and validate current schedule state.
     * @returns {object} Single actual posting. */
    payOccurrence: (id: string, date: string, create: () => typeof transactions.$inferInsert) =>
      database.transaction((connection) => {
        const existing = connection
          .select()
          .from(transactions)
          .where(and(eq(transactions.recurringId, id), eq(transactions.date, date)))
          .get();
        return existing ?? connection.insert(transactions).values(create()).returning().get();
      }),
  };
}
export type BudgetRepository = ReturnType<typeof createBudgetRepository>;

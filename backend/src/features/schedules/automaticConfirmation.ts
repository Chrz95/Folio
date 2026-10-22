import type { DatabaseClient } from '../../db/client.js';
import { createBudgetRepository } from '../budget/budget.repository.js';
import { createBudgetService } from '../budget/budget.service.js';
import { automaticOccurrences } from './automaticPlanning.js';
import { automaticDate } from './scheduleControls.repository.js';
/** Post due opt-in instances atomically through the same policy and unique occurrence key as manual confirmation.
 * @param {DatabaseClient} client - Migrated connection. @param {number} now - Epoch milliseconds.
 * @returns {number} New postings, with no duplicates on retries or after restart. */
export function runAutomaticConfirmation(client: DatabaseClient, now: number): number {
  const repository = createBudgetRepository(client);
  const service = createBudgetService(repository);
  return client.database.transaction(() => {
    const due = automaticOccurrences(
      {
        recurring: repository.listRecurring(),
        transactions: repository.reminderPostings(),
        ...repository.scheduleState(),
      },
      automaticDate(client, now),
    );
    for (const row of due) {
      service.payOccurrence(row.recurringId, row.date);
    }
    return due.length;
  });
}

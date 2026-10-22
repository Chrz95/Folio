import { resolveScheduleEnding } from './scheduleEnding.js';
import { isScheduleDateEnabled } from '../schedules/schedulePolicy.js';
import { randomUUID } from 'node:crypto';
import { AppError } from '../../lib/errors/AppError.js';
import { HTTP } from '../../constants/http.constants.js';
import { isOccurrence } from './recurrence.js';
import type { BudgetRepository } from './budget.repository.js';
import type { TransactionInput, RecurringInput } from './budget.schema.js';
/** Assert existence without leaking storage errors.
 * @param {T | undefined} resource - Repository result.
 * @returns {T} Existing value. */
function requireResource<T>(resource: T | undefined): T {
  if (!resource) {
    throw new AppError(HTTP.notFound, 'NOT_FOUND', 'This item no longer exists.');
  }
  return resource;
}
/** Validate counted or explicit endings at the service boundary without leaking implementation errors.
 * @param {RecurringInput} input - Validated mutation. @returns {string | null | undefined} Inclusive end. */
function readEnding(input: RecurringInput) {
  try {
    return resolveScheduleEnding(input);
  } catch (error) {
    throw new AppError(HTTP.badRequest, 'INVALID_END_DATE', error instanceof Error ? error.message : 'Invalid ending.');
  }
}
/** Keep schedule posting rules separate from HTTP and persistence.
 * @param {BudgetRepository} repository - Persistence boundary.
 * @returns {object} Budget service. */
export function createBudgetService(repository: BudgetRepository) {
  /** Prevent rewriting a completed statement's financial history.
   * @param {string} id - Posting UUID. @returns {void} Rejects locked records. */
  function requireUnlocked(id: string) {
    if (repository.isReconciled(id)) {
      throw new AppError(
        HTTP.conflict,
        'RECONCILED',
        'Undo the latest statement reconciliation before editing this entry.',
      );
    }
  }
  return {
    listTransactions: repository.listTransactions,
    countTransactions: repository.countTransactions,
    /** Assign an audit timestamp and identifier before persisting a posting.
     * @param {TransactionInput} input - Typed boundary input.
     * @returns {object} Operation result. */
    createTransaction: (input: TransactionInput) => {
      repository.validateCategory(input.category);
      return repository.insertTransaction({ ...input, id: randomUUID(), createdAt: Date.now() });
    },
    /** Replace editable posting fields while retaining its audit identity.
     * @param {string} id - Stable resource identifier.
     * @param {TransactionInput} input - Typed boundary input.
     * @returns {object} Operation result. */
    updateTransaction: (id: string, input: TransactionInput) => {
      requireUnlocked(id);
      repository.validateCategory(input.category, repository.getTransaction(id)?.category);
      return requireResource(repository.updateTransaction(id, input));
    },
    /** Delete an actual posting and return the removed row.
     * @param {string} id - Stable resource identifier.
     * @returns {object} Operation result. */
    deleteTransaction: (id: string) => {
      requireUnlocked(id);
      return requireResource(repository.deleteTransaction(id));
    },
    listAccounts: repository.listAccounts,
    /** Assign an identifier and persist a manual account.
     * @param {{ name: string; openingBalance: number }} input - Typed boundary input.
     * @returns {object} Operation result. */
    createAccount: (input: { name: string; openingBalance: number }) =>
      repository.addAccount({ ...input, id: randomUUID() }),
    listRecurring: repository.listRecurring,
    /** Assign an identifier and store a planned payment rule.
     * @param {RecurringInput} input - Typed boundary input.
     * @returns {object} Operation result. */
    createRecurring: (input: RecurringInput) => {
      repository.validateCategory(input.category);
      const ending = readEnding(input);
      const { endDate: _end, repetitions: _count, countFrom: _from, autoConfirm, ...fields } = input;
      return repository.addRecurring({ ...fields, id: randomUUID() }, ending, autoConfirm);
    },
    /** Change future schedule rules without rewriting actual history.
     * @param {string} id - Stable resource identifier.
     * @param {RecurringInput} input - Typed boundary input.
     * @returns {object} Operation result. */
    updateRecurring: (id: string, input: RecurringInput) => {
      repository.validateCategory(input.category, repository.getRecurring(id)?.category);
      const requestedEnd = readEnding(input);
      const endDate =
        requestedEnd === undefined
          ? repository.scheduleState().scheduleSettings.find((entry) => entry.recurringId === id)?.endDate
          : requestedEnd;
      if (endDate && input.date > endDate) {
        throw new AppError(
          HTTP.badRequest,
          'INVALID_END_DATE',
          'Adjust the end date before moving the schedule start.',
        );
      }
      const { endDate: _end, repetitions: _count, countFrom: _from, autoConfirm, ...fields } = input;
      return requireResource(repository.updateRecurring(id, fields, requestedEnd, autoConfirm));
    },
    /** Remove a schedule while preserving its posted transactions.
     * @param {string} id - Stable resource identifier.
     * @returns {object} Operation result. */
    deleteRecurring: (id: string) => requireResource(repository.deleteRecurring(id)),
    listBudgets: repository.listBudgets,
    /** Validate catalog values for the legacy baseline endpoint.
     * @param {Parameters<BudgetRepository['saveBudget']>[0]} input - Baseline cap. @returns {object} Stored cap. */
    saveBudget: (input: Parameters<BudgetRepository['saveBudget']>[0]) => {
      repository.validateCategory(input.category);
      return repository.saveBudget(input);
    },
    /** Return the existing occurrence or atomically create its single posting.
     * @param {string} id - Stable resource identifier.
     * @param {string} date - ISO calendar date.
     * @returns {object} Operation result. */
    payOccurrence: (id: string, date: string) =>
      repository.payOccurrence(id, date, () => {
        const template = requireResource(repository.getRecurring(id));
        if (!isOccurrence(template.date, template.frequency, date)) {
          throw new AppError(HTTP.badRequest, 'INVALID_OCCURRENCE', 'Choose a date in the recurring schedule.');
        }
        if (!isScheduleDateEnabled(id, date, repository.scheduleState())) {
          throw new AppError(
            HTTP.conflict,
            'INACTIVE_OCCURRENCE',
            'Resume or restore this occurrence before recording it.',
          );
        }
        const { frequency: _frequency, reminderDays: _reminderDays, ...values } = template;
        return { ...values, id: randomUUID(), recurringId: id, date, createdAt: Date.now() };
      }),
  };
}
export type BudgetService = ReturnType<typeof createBudgetService>;

import { budgetCopyPlan } from './budgetCopy.js';
import type { BudgetCopyInput } from './budgetCopy.js';
import { PLANNING } from './planning.constants.js';
import { randomUUID } from 'node:crypto';
import type { z } from 'zod';
import type { PlanningRepository } from './planning.repository.js';
import type { contributionSchema, goalSchema, monthlyBudgetSchema } from './planning.schema.js';
import { CATEGORIES, BUDGET_LIMITS } from '../budget/budget.constants.js';
import { AppError } from '../../lib/errors/AppError.js';
import { HTTP } from '../../constants/http.constants.js';
/** Reject missing resources consistently. @param {T | undefined} value - Repository row.
 * @returns {T} Existing row. */
function existing<T>(value: T | undefined): T {
  if (!value) {
    throw new AppError(HTTP.notFound, 'NOT_FOUND', 'This item no longer exists.');
  }
  return value;
}
/** Keep goal progress and duplicate requests consistent inside atomic writes.
 * @param {PlanningRepository} repository - Persistence boundary.
 * @param {(name: string, previous?: string) => void} validateCategory - Catalog validation.
 * @returns {object} Planning operations. */
export function createPlanningService(
  repository: PlanningRepository,
  validateCategory: (name: string, previous?: string) => void,
) {
  /** Read a bounded, current copy plan. @param {BudgetCopyInput} input - Source/target selection.
   * @returns {ReturnType<typeof budgetCopyPlan>} Review snapshot. */
  function previewCopy(input: BudgetCopyInput) {
    const plan = budgetCopyPlan(repository.copySnapshot(), input);
    if (plan.rows.length > PLANNING.maximumCopyCategories) {
      throw new AppError(HTTP.badRequest, 'COPY_LIMIT', 'Copy up to 500 categories at a time.');
    }
    return plan;
  }
  return {
    previewCopy,
    /** Revalidate and copy a complete reviewed batch in one SQLite transaction.
     * @param {BudgetCopyInput & { revision: string }} input - Reviewed request. @returns {number} Copied categories. */
    commitCopy: (input: BudgetCopyInput & { revision: string }) =>
      repository.atomic(() => {
        const plan = previewCopy(input);
        if (plan.revision !== input.revision) {
          throw new AppError(HTTP.conflict, 'STALE_COPY', 'Budgets changed. Review the copy again before saving.');
        }
        const copying = plan.rows.filter((entry) => entry.action === 'copy');
        copying.forEach((entry) => validateCategory(entry.category));
        copying.forEach(({ category, amount, rollover }) =>
          repository.saveBudget({ month: input.toMonth, category, amount, rollover }),
        );
        return copying.length;
      }),
    state: repository.state,
    /** Save one month's cap. @param {z.infer<typeof monthlyBudgetSchema>} input - Month override.
     * @returns {object} Allocation. */
    saveBudget: (input: z.infer<typeof monthlyBudgetSchema>) => {
      const previous = repository
        .state()
        .monthlyBudgets.find((entry) => entry.month === input.month && entry.category === input.category);
      validateCategory(input.category, previous?.category);
      return repository.saveBudget(input);
    },
    /** Create a category while preventing case-insensitive duplicates with built-ins.
     * @param {string} name - Trimmed name. @returns {object} Category. */
    addCategory: (name: string) => {
      if (CATEGORIES.some((entry) => entry.toLowerCase() === name.toLowerCase())) {
        throw new AppError(HTTP.conflict, 'DUPLICATE_CATEGORY', 'That category already exists.');
      }
      return repository.addCategory({ id: randomUUID(), name, normalizedName: name.toLowerCase() });
    },
    /** Preserve archived category history. @param {string} id - Category UUID.
     * @param {boolean} isArchived - Archive flag. @returns {object} Category. */
    archiveCategory: (id: string, isArchived: boolean) => existing(repository.archiveCategory(id, isArchived)),
    /** Add a savings target without moving account funds. @param {z.infer<typeof goalSchema>} input - Target.
     * @returns {object} Goal. */
    addGoal: (input: z.infer<typeof goalSchema>) => repository.addGoal({ ...input, id: randomUUID() }),
    /** Change target details without losing progress. @param {string} id - Goal UUID.
     * @param {z.infer<typeof goalSchema>} input - Details. @returns {object} Goal. */
    updateGoal: (id: string, input: z.infer<typeof goalSchema>) => existing(repository.updateGoal(id, input)),
    /** Record signed progress exactly once and prohibit negative or unsafe totals.
     * @param {string} goalId - Goal UUID. @param {z.infer<typeof contributionSchema>} input - Request.
     * @returns {object} Existing or new contribution. */
    contribute: (goalId: string, input: z.infer<typeof contributionSchema>) =>
      repository.atomic(() => {
        const prior = repository.contribution(input.id);
        if (prior) {
          if (
            prior.goalId !== goalId ||
            prior.amount !== input.amount ||
            prior.date !== input.date ||
            prior.notes !== input.notes
          ) {
            throw new AppError(HTTP.conflict, 'REQUEST_REUSED', 'Use a new request ID for a different contribution.');
          }
          return prior;
        }
        const goal = existing(repository.goal(goalId));
        const progress = repository.progress(goalId) + input.amount;
        if (goal.isArchived || progress < 0 || progress > BUDGET_LIMITS.maximumMoney) {
          throw new AppError(
            HTTP.conflict,
            'INVALID_PROGRESS',
            'Restore this goal and keep progress within its range.',
          );
        }
        return repository.addContribution({ ...input, goalId, createdAt: Date.now() });
      }),
  };
}

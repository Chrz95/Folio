import { environment } from '../../app/config/environment';
import { request } from '../../lib/api/client';
import { readDemo, writeDemo } from '../../lib/storage/demoStore';
import { budgetCopyPlan } from './budgetCopy';
import type { BudgetCopyInput, BudgetCopyPlan } from './budgetCopy';
import { budgetCopySchema } from './budgetCopyValidation';
import { categoryNames } from './catalog';
import { PLANNING } from './planning.constants';
const COPY_PATH = '/planning/budget-copy';
/** Translate input validation into an actionable form message.
 * @param {BudgetCopyInput} input - Month selection. @returns {BudgetCopyInput} Validated selection. */
function validateSelection(input: BudgetCopyInput): BudgetCopyInput {
  const result = budgetCopySchema.safeParse(input);
  if (!result.success) {
    throw new Error('Choose a valid source month different from the selected month.');
  }
  return result.data;
}
/** Request a review without changing allocations. @param {BudgetCopyInput} input - Source and target selection.
 * @returns {Promise<BudgetCopyPlan>} Authoritative review snapshot. */
export async function previewBudgetCopy(input: BudgetCopyInput): Promise<BudgetCopyPlan> {
  const selection = validateSelection(input);
  const preview = environment.isDemo
    ? budgetCopyPlan(readDemo(), selection)
    : await request<BudgetCopyPlan>(`${COPY_PATH}/preview`, {
        method: 'POST',
        body: JSON.stringify(selection),
      });
  if (preview.rows.length > PLANNING.maximumCopyCategories) {
    throw new Error('Copy up to 500 categories at a time.');
  }
  return preview;
}
/** Commit only a still-current review; preview writes are synchronous and all-or-nothing.
 * @param {BudgetCopyPlan} plan - Reviewed allocations. @returns {Promise<number>} Number of copied categories. */
export async function commitBudgetCopy(plan: BudgetCopyPlan): Promise<number> {
  const selection = validateSelection({ fromMonth: plan.fromMonth, toMonth: plan.toMonth, mode: plan.mode });
  if (!environment.isDemo) {
    return request(`${COPY_PATH}/commit`, {
      method: 'POST',
      body: JSON.stringify({ ...selection, revision: plan.revision }),
    });
  }
  const data = readDemo();
  const current = budgetCopyPlan(data, selection);
  if (current.rows.length > PLANNING.maximumCopyCategories) {
    throw new Error('Copy up to 500 categories at a time.');
  }
  if (current.revision !== plan.revision) {
    throw new Error('Budgets changed. Review the copy again before saving.');
  }
  const copying = current.rows.filter((entry) => entry.action === 'copy');
  if (copying.some((entry) => !categoryNames(data).includes(entry.category))) {
    throw new Error('Choose an active category.');
  }
  const names = new Set(copying.map((entry) => entry.category));
  data.monthlyBudgets = [
    ...(data.monthlyBudgets ?? []).filter((entry) => entry.month !== selection.toMonth || !names.has(entry.category)),
    ...copying.map(({ category, amount, rollover }) => ({ month: selection.toMonth, category, amount, rollover })),
  ];
  writeDemo(data);
  return copying.length;
}

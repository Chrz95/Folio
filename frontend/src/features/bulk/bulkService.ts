import type { BudgetData } from '../../types/budget';
import { environment } from '../../app/config/environment';
import { request } from '../../lib/api/client';
import { readDemo, writeDemo } from '../../lib/storage/demoStore';
import { categoryNames } from '../planning/catalog';
import { BULK } from './bulk.constants';
import { bulkPlan } from './bulkPlan';
import type { BulkInput, BulkPlan } from './bulkPlan';
import { bulkInputSchema, bulkCommitSchema } from './bulkValidation';
/** Build a valid preview selection against fresh storage. @param {BulkInput} input - Selected operation.
 * @param {BudgetData} data - Fresh preview snapshot. @returns {BulkPlan} Exact current preview. */
function currentPlan(data: BudgetData, input: BulkInput) {
  if (input.action === 'categorize' && !categoryNames(data).includes(input.category)) {
    throw new Error('Choose an active category.');
  }
  const plan = bulkPlan(data, input);
  if (plan.rows.length !== input.ids.length) {
    throw new Error('A selected entry no longer exists. Refresh and review again.');
  }
  if (plan.rows.some((row) => row.isLocked)) {
    throw new Error('Reconciled entries cannot be changed in bulk.');
  }
  if (plan.revision.length > BULK.maximumRevision) {
    throw new Error('This review is too large. Select fewer transactions.');
  }
  return plan;
}
/** Review selected actual entries without changing the ledger.
 * @param {BulkInput} input - Selection. @returns {Promise<BulkPlan>} Authoritative review. */
export async function previewBulk(input: BulkInput): Promise<BulkPlan> {
  const result = bulkInputSchema.safeParse(input);
  if (!result.success) {
    throw new Error('Select 1–100 different transactions and an active category when needed.');
  }
  return environment.isDemo
    ? currentPlan(readDemo(), result.data)
    : request(`${BULK.path}/preview`, {
        method: 'POST',
        body: JSON.stringify(result.data),
      });
}
/** Commit a still-current review in one database transaction or one atomic browser storage write.
 * @param {BulkPlan} plan - Reviewed selection. @returns {Promise<number>} Committed row count. */
export async function commitBulk(plan: BulkPlan): Promise<number> {
  const result = bulkCommitSchema.safeParse({ selection: plan.selection, revision: plan.revision });
  if (!result.success) {
    throw new Error('Review the selected transactions again before saving.');
  }
  if (!environment.isDemo) {
    return request(`${BULK.path}/commit`, {
      method: 'POST',
      body: JSON.stringify(result.data),
    });
  }
  const data = readDemo();
  const current = currentPlan(data, result.data.selection);
  if (current.revision !== result.data.revision) {
    throw new Error('Selected entries changed. Review the batch again.');
  }
  const ids = new Set(current.selection.ids);
  if (current.selection.action === 'delete') {
    data.transactions = data.transactions.filter((entry) => !ids.has(entry.id));
    data.receipts = data.receipts?.filter((entry) => !ids.has(entry.transactionId));
    data.clearances = data.clearances?.filter((entry) => !ids.has(entry.transactionId));
    data.importLinks = data.importLinks?.filter((entry) => !ids.has(entry.transactionId));
  } else {
    const { category } = current.selection;
    data.transactions = data.transactions.map((entry) => (ids.has(entry.id) ? { ...entry, category } : entry));
  }
  writeDemo(data);
  return ids.size;
}

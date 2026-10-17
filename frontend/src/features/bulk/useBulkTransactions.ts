import { useState } from 'react';
import { useWorkspace } from '../../app/WorkspaceContext';
import type { BudgetData, Transaction } from '../../types/budget';
import { previewBulk, commitBulk } from './bulkService';
import type { BulkInput, BulkPlan } from './bulkPlan';
import { BULK } from './bulk.constants';
/** Own bounded selection and explicit review/commit state for one filtered ledger view.
 * @param {Transaction[]} transactions - Visible actual postings. @returns {object} Bulk workflow state and actions. */
export function useBulkTransactions(transactions: Transaction[]) {
  const { data, reload, setNotice, isSaving } = useWorkspace();
  const [selected, setSelected] = useState<string[]>([]);
  const [action, setAction] = useState<BulkInput['action']>('categorize');
  const [category, setCategory] = useState('');
  const [reviewed, setReviewed] = useState<{ plan: BulkPlan; data: BudgetData } | null>(null);
  const plan = reviewed?.data === data ? reviewed.plan : null;
  const [isWorking, setWorking] = useState(false);
  const [error, setError] = useState('');
  const isBusy = isWorking || isSaving;
  const locked = new Set(
    data.clearances?.filter((entry) => entry.reconciliationId).map((entry) => entry.transactionId),
  );
  const eligible = transactions.filter((entry) => !locked.has(entry.id));
  const ids = new Set(selected.filter((id) => eligible.some((entry) => entry.id === id)));
  /** Bind a review to the loaded snapshot; later refreshes hide it without cascading render effects.
   * @param {BulkPlan | null} value - Reviewed batch. @returns {void} Bound review state. */
  function setPlan(value: BulkPlan | null) {
    setReviewed(value ? { plan: value, data } : null);
  }
  /** Discard the old review whenever the selection changes.
   * @param {string[]} next - Selected visible IDs. @returns {void} Selection state. */
  function select(next: string[]) {
    if (isBusy) {
      return;
    }
    setSelected(next);
    setPlan(null);
    setError('');
  }
  /** Toggle one editable row with a hard selection cap.
   * @param {string} id - Visible posting UUID. @returns {void} Updated selection. */
  function toggle(id: string) {
    if (!eligible.some((entry) => entry.id === id)) {
      return;
    }
    select(ids.has(id) ? [...ids].filter((value) => value !== id) : [...ids, id].slice(0, BULK.maximumRows));
  }
  /** Select only the first bounded set of visible editable entries. @returns {void} Updated selection. */
  function selectAll() {
    select(eligible.slice(0, BULK.maximumRows).map((entry) => entry.id));
  }
  /** Clear visible selection and any review. @returns {void} Empty selection. */
  function clear() {
    select([]);
  }
  /** Change action and invalidate the review. @param {BulkInput['action']} value - Operation.
   * @returns {void} New action. */
  function changeAction(value: BulkInput['action']) {
    if (!isBusy) {
      setAction(value);
      setPlan(null);
      setError('');
    }
  }
  /** Change target category and invalidate the review. @param {string} value - Exact active name.
   * @returns {void} New category. */
  function changeCategory(value: string) {
    if (!isBusy) {
      setCategory(value);
      setPlan(null);
      setError('');
    }
  }
  /** Fetch an authoritative read-only review. @returns {Promise<void>} Review or visible error. */
  async function review() {
    if (isBusy || !ids.size) {
      return;
    }
    setWorking(true);
    setError('');
    setPlan(null);
    try {
      const input: BulkInput = action === 'delete' ? { action, ids: [...ids] } : { action, category, ids: [...ids] };
      setPlan(await previewBulk(input));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to review transactions.');
    } finally {
      setWorking(false);
    }
  }
  /** Commit the current review once; distinguish a failed refresh from a failed write.
   * @returns {Promise<void>} Refreshed ledger or actionable feedback. */
  async function commit() {
    if (isBusy || !plan) {
      return;
    }
    setWorking(true);
    setError('');
    let committed = false;
    try {
      const count = await commitBulk(plan);
      committed = true;
      setSelected([]);
      setPlan(null);
      setNotice(`${count} transactions ${plan.selection.action === 'delete' ? 'deleted' : 'categorized'}.`);
      await reload();
    } catch (failure) {
      setPlan(null);
      setError(
        committed
          ? 'Changes saved, but refresh failed. Reload the ledger.'
          : failure instanceof Error
            ? failure.message
            : 'Unable to save. Refresh the ledger before retrying.',
      );
    } finally {
      setWorking(false);
    }
  }
  return {
    ids,
    action,
    category,
    plan,
    isBusy,
    error,
    eligibleCount: eligible.length,
    toggle,
    selectAll,
    clear,
    changeAction,
    changeCategory,
    review,
    commit,
  };
}
export type BulkWorkflow = ReturnType<typeof useBulkTransactions>;

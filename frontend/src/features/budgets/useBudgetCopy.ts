import { useState } from 'react';
import { useWorkspace } from '../../app/WorkspaceContext';
import { shiftMonth } from '../../utils/format';
import { previewBudgetCopy, commitBudgetCopy } from '../planning/budgetCopyService';
import type { BudgetCopyInput, BudgetCopyPlan } from '../planning/budgetCopy';
/** Keep review separate from commit and invalidate it whenever the source or policy changes.
 * @returns {object} Copy workflow state and actions. */
export function useBudgetCopy() {
  const { month, reload, setNotice, isSaving } = useWorkspace();
  const [fromMonth, setFromMonth] = useState(shiftMonth(month, -1));
  const [mode, setMode] = useState<BudgetCopyInput['mode']>('missing');
  const [plan, setPlan] = useState<BudgetCopyPlan | null>(null);
  const [isBusy, setBusy] = useState(false);
  const [error, setError] = useState('');
  /** Apply a source month and discard any previous review. @param {string} value - YYYY-MM input.
   * @returns {void} Updated selection. */
  function changeMonth(value: string) {
    setFromMonth(`${value}-01`);
    setPlan(null);
    setError('');
  }
  /** Apply an explicit existing-limit policy. @param {BudgetCopyInput['mode']} value - Policy.
   * @returns {void} Clears a stale review. */
  function changeMode(value: BudgetCopyInput['mode']) {
    setMode(value);
    setPlan(null);
    setError('');
  }
  /** Load the actual reviewed rows. @returns {Promise<void>} Review or visible failure. */
  async function review() {
    setBusy(true);
    setError('');
    try {
      setPlan(await previewBudgetCopy({ fromMonth, toMonth: month, mode }));
    } catch (failure) {
      setPlan(null);
      setError(failure instanceof Error ? failure.message : 'Unable to review budgets.');
    } finally {
      setBusy(false);
    }
  }
  /** Apply a current review as one durable operation. @returns {Promise<void>} Refreshed monthly plan. */
  async function commit() {
    if (!plan || isBusy || isSaving) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      const count = await commitBudgetCopy(plan);
      setPlan(null);
      await reload();
      setNotice(`${count} category budgets copied into ${month.slice(0, MONTH_LENGTH)}.`);
    } catch (failure) {
      setPlan(null);
      setError(failure instanceof Error ? failure.message : 'Unable to copy budgets.');
    } finally {
      setBusy(false);
    }
  }
  return { fromMonth, mode, plan, isBusy: isBusy || isSaving, error, changeMonth, changeMode, review, commit };
}
const MONTH_LENGTH = 7;
export type BudgetCopyState = ReturnType<typeof useBudgetCopy>;

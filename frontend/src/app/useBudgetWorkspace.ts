import { useState, useEffect, useCallback } from 'react';
import { loadBudget, mutateBudget, payOccurrence } from '../features/transactions/budgetService';
import type { Resource } from '../features/transactions/budgetService';
import type { BudgetData, RecurringTransaction } from '../types/budget';
import { EMPTY_DATA } from '../constants/app.constants';
/** Own loading and mutation state; failed writes preserve the previous screen.
 * @returns {object} Workspace data and asynchronous actions. */
export function useBudgetWorkspace() {
  const [data, setData] = useState<BudgetData>(EMPTY_DATA);
  const [isLoading, setLoading] = useState(true);
  const [isSaving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  /** Refresh the workspace after a durable change.
   * @returns {Promise<void>} Latest server or explicit preview snapshot. */
  const reload = useCallback(async () => {
    setData(await loadBudget());
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    loadBudget(controller.signal)
      .then(setData)
      .catch((failure: Error) => {
        if (!controller.signal.aborted) {
          setError(failure.message);
        }
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);
  /** Persist a validated mutation and keep failures visible without closing forms.
   * @param {Resource} resource - Domain collection.
   * @param {string} method - Transport action.
   * @param {object} [value] - Validated input.
   * @param {string} [id] - Existing resource identifier.
   * @returns {Promise<boolean>} Whether persistence and snapshot refresh succeeded. */
  const save = useCallback(
    async (resource: Resource, method: string, value?: object, id?: string) => {
      setSaving(true);
      setError('');
      try {
        await mutateBudget(resource, method, value, id);
        await reload();
        setNotice(method === 'DELETE' ? 'Item deleted.' : 'Your changes are saved.');
        return true;
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : 'Unable to save.');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [reload],
  );
  /** Post exactly one selected occurrence and refresh balances.
   * @param {RecurringTransaction} template - Planned occurrence including its due date.
   * @returns {Promise<void>} Success or visible failure feedback. */
  const pay = useCallback(
    async (template: RecurringTransaction) => {
      setSaving(true);
      setError('');
      try {
        await payOccurrence(template);
        await reload();
        setNotice('Payment recorded. Your balance is up to date.');
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : 'Unable to record payment.');
      } finally {
        setSaving(false);
      }
    },
    [reload],
  );
  return { data, isLoading, isSaving, error, notice, setError, setNotice, reload, save, pay };
}
export type Workspace = ReturnType<typeof useBudgetWorkspace>;

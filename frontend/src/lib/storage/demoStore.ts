import { APP } from '../../constants/app.constants';
import type { BudgetData } from '../../types/budget';
import { createDemoSeed } from '../../features/transactions/demoSeed.constants';
/** Read only the explicitly labelled demo workspace. Storage failures remain visible.
 * @returns {BudgetData} Saved preview state, or initial sample data. */
export function readDemo(): BudgetData {
  const saved = localStorage.getItem(APP.storageKey);
  if (!saved) {
    return createDemoSeed();
  }
  const parsed: unknown = JSON.parse(saved);
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !('transactions' in parsed) ||
    !('accounts' in parsed) ||
    !('recurring' in parsed) ||
    !('budgets' in parsed)
  ) {
    throw new Error('Preview data is damaged. Clear it in settings.');
  }
  return parsed as BudgetData;
}
/** Persist preview edits before updating the screen, so quota failures never look like successful saves.
 * @param {BudgetData} data - Next preview snapshot.
 * @returns {void} Writes only the preview key. */
export function writeDemo(data: BudgetData) {
  localStorage.setItem(APP.storageKey, JSON.stringify(data));
}

import { useBudgetCopy } from './useBudgetCopy';
import { BudgetCopyReview } from './BudgetCopyReview';
import type { BudgetCopyInput } from '../planning/budgetCopy';
import { PLANNING } from '../planning/planning.constants';
import { VALUE } from '../../constants/app.constants';
/** Review and copy allocations while leaving carry and spending derived from actual history.
 * @returns {JSX.Element} Copy-from-month workflow. */
export function BudgetCopyPanel() {
  const workflow = useBudgetCopy();
  return (
    <section className="panel budget-copy-panel">
      <h2>A head start for this month</h2>
      <p>
        Copy another month's allocations and rollover settings into the selected month. Carried balances and spending
        are calculated separately. Categories found only in the destination stay as they are.
      </p>
      <form
        className="budget-copy-controls"
        onSubmit={(event) => {
          event.preventDefault();
          void workflow.review();
        }}
      >
        <label>
          Copy from month
          <input
            type="month"
            required
            value={workflow.fromMonth.slice(0, VALUE.monthPrefixLength)}
            min={PLANNING.minimumMonth.slice(0, VALUE.monthPrefixLength)}
            max={PLANNING.maximumMonth.slice(0, VALUE.monthPrefixLength)}
            disabled={workflow.isBusy}
            onChange={(event) => workflow.changeMonth(event.target.value)}
          />
        </label>
        <label>
          Existing destination budgets
          <select
            value={workflow.mode}
            disabled={workflow.isBusy}
            onChange={(event) => workflow.changeMode(event.target.value as BudgetCopyInput['mode'])}
          >
            <option value="missing">Keep existing; fill missing categories</option>
            <option value="replace">Replace matching categories</option>
          </select>
        </label>
        <button
          className="button secondary"
          disabled={workflow.isBusy}
        >
          {workflow.isBusy ? 'Working…' : 'Review budget copy'}
        </button>
      </form>
      {workflow.error && (
        <p
          className="error-message"
          role="alert"
        >
          {workflow.error}
        </p>
      )}
      <BudgetCopyReview workflow={workflow} />
    </section>
  );
}

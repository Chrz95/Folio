import type { BudgetCopyState } from './useBudgetCopy';
import { money } from '../../utils/format';
interface ReviewProps {
  workflow: BudgetCopyState;
}
/** Show allocations and conflicts before the single commit action.
 * @param {ReviewProps} props - Copy review. @param {BudgetCopyState} props.workflow - Reviewed state.
 * @returns {JSX.Element | null} Review table. */
export function BudgetCopyReview({ workflow }: ReviewProps) {
  const { plan } = workflow;
  if (!plan) {
    return null;
  }
  const count = plan.rows.filter((entry) => entry.action === 'copy').length;
  return (
    <div className="budget-copy-review">
      <div className="review-table-scroll">
        <table className="statement-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Source allocation</th>
              <th>Existing override</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {plan.rows.map((entry) => (
              <tr key={entry.category}>
                <td>{entry.category}</td>
                <td>
                  {money(entry.amount)}
                  <small>{entry.rollover ? 'Rollover on' : 'Rollover off'}</small>
                </td>
                <td>
                  {entry.currentAmount === null ? 'No override' : money(entry.currentAmount)}
                  {entry.currentAmount !== null && (
                    <small>{entry.currentRollover ? 'Rollover on' : 'Rollover off'}</small>
                  )}
                </td>
                <td>
                  {entry.action === 'archived'
                    ? 'Skip archived category'
                    : entry.action === 'keep'
                      ? 'Keep existing'
                      : 'Copy allocation'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!plan.rows.length && <p>No allocations are configured for the source month.</p>}
      <div className="settings-actions">
        <button
          className="button primary"
          disabled={workflow.isBusy || count === 0}
          onClick={() => void workflow.commit()}
        >
          Copy {count} category budgets
        </button>
      </div>
    </div>
  );
}

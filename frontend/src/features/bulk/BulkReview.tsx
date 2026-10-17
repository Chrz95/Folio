import { useState } from 'react';
import type { BulkWorkflow } from './useBulkTransactions';
import { BulkReviewRows } from './BulkReviewRows';
interface Props {
  workflow: BulkWorkflow;
}
/** Show exact rows and destructive consequences before explicit commit.
 * @param {Props} props - Review state. @param {BulkWorkflow} props.workflow - Reviewed selection.
 * @returns {JSX.Element | null} Review and confirmation. */
export function BulkReview({ workflow }: Props) {
  const [confirmed, setConfirmed] = useState(false);
  const { plan } = workflow;
  if (!plan) {
    return null;
  }
  const deleting = plan.selection.action === 'delete';
  const receiptCount = plan.rows.reduce((sum, row) => sum + row.receipts.length, 0);
  const importCount = plan.rows.reduce((sum, row) => sum + row.importFingerprints.length, 0);
  const recurringCount = plan.rows.filter((row) => row.transaction.recurringId).length;
  return (
    <section
      className="bulk-review"
      aria-label="Bulk transaction review"
    >
      <h2>Review {plan.rows.length} transactions</h2>
      <p>
        {deleting
          ? 'Delete these recorded transactions permanently.'
          : `Change their category to ${plan.selection.action === 'categorize' ? plan.selection.category : ''}.`}{' '}
        The whole batch is rejected if a selected entry changes or becomes reconciled.
      </p>
      {deleting && (
        <p className="bulk-delete-warning">
          Deletion removes {receiptCount} receipts and {importCount} import links; imported entries may be imported
          again.
          {recurringCount > 0 &&
            ` ${recurringCount} recorded recurring payments will become unpaid again;
          eligible dates may return to upcoming lists and reminders.`}{' '}
          Transfers lose both account legs. Account balances and spending totals will change.
        </p>
      )}
      <BulkReviewRows rows={plan.rows} />
      {!deleting && (
        <p>Amounts, account legs, dates, notes, receipts and schedule links stay attached to their originals.</p>
      )}
      {deleting && (
        <label className="inline-check">
          <input
            type="checkbox"
            checked={confirmed}
            disabled={workflow.isBusy}
            onChange={(event) => setConfirmed(event.target.checked)}
          />
          I understand these transactions and their receipts will be permanently deleted.
        </label>
      )}
      <button
        className={`button ${deleting ? 'danger' : 'primary'}`}
        disabled={workflow.isBusy || (deleting && !confirmed)}
        onClick={() => void workflow.commit()}
      >
        {deleting
          ? `Delete ${plan.rows.length} transactions permanently`
          : `Categorize ${plan.rows.length} transactions`}
      </button>
    </section>
  );
}

import { Check, ArrowLeft } from 'lucide-react';
import type { ImportWizardState } from './useImportWizard';
import { ImportReviewRow } from './ImportReviewRow';
interface ImportReviewProps {
  wizard: ImportWizardState;
}
/** Show all decisions before an atomic, idempotent statement import.
 * @param {ImportReviewProps} props - Workflow.
 * @param {ImportWizardState} props.wizard - Reviewed rows. @returns {JSX.Element} Final review. */
export function ImportReview({ wizard }: ImportReviewProps) {
  const added = wizard.preview.filter((row) => row.action === 'new').length;
  const matched = wizard.preview.filter((row) => row.action === 'match').length;
  const skipped = wizard.preview.length - added - matched;
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>A final look before it lands</h2>
          <p>
            {added} new · {matched} matched · {skipped} skipped. Matching preserves the existing amount, category and
            transfer.
          </p>
        </div>
      </div>
      <div className="review-table-scroll">
        <table className="statement-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Bank description</th>
              <th className="amount-cell">Amount</th>
              <th>Your decision</th>
            </tr>
          </thead>
          <tbody>
            {wizard.preview.map((row) => (
              <ImportReviewRow
                key={row.reviewId}
                row={row}
                onChoice={wizard.choose}
                isBusy={wizard.isBusy}
              />
            ))}
          </tbody>
        </table>
      </div>
      <div className="import-review-footer">
        <button
          className="button secondary"
          disabled={wizard.isBusy}
          onClick={() => wizard.setPreview([])}
        >
          <ArrowLeft size={16} />
          Back to mapping
        </button>
        <button
          className="button primary"
          disabled={wizard.isBusy || added + matched === 0}
          onClick={() => void wizard.commit()}
        >
          <Check size={16} />
          {wizard.isBusy ? 'Importing…' : 'Confirm import'}
        </button>
      </div>
      <p className="import-footnote">
        Approved entries are marked cleared for the selected account. No statement reconciliation is completed
        automatically.
      </p>
    </section>
  );
}

import type { ActualWizard } from './useActualImport';
import { ACTUAL } from './actual.constants';
import { ActualBalances } from './ActualBalances';
import { ActualProgressReview } from './ActualProgressReview';
import { ActualScheduleReview } from './ActualScheduleReview';
/** Download every approved addition and compatibility exclusion for inspection.
 * @param {ActualWizard} wizard - Reviewed workflow. @returns {void} Browser download. */
function download(wizard: ActualWizard) {
  const blob = new Blob([JSON.stringify({ source: wizard.file, review: wizard.review }, null, ACTUAL.jsonIndent)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'folio-actual-import-review.json';
  link.click();
  URL.revokeObjectURL(url);
}
/** Present authoritative additions and require a final acknowledgment.
 * @param {ActualWizard} wizard - Current workflow. @returns {JSX.Element | null} Review and commit controls. */
export function ActualReview({ wizard }: { wizard: ActualWizard }) {
  if (!wizard.review) {
    return null;
  }
  const { review } = wizard;
  const total = Object.values(review.added).reduce((sum, count) => sum + count, 0);
  return (
    <section className="panel actual-review">
      <span className="eyebrow">2 · REVIEW & IMPORT</span>
      <h2>{total ? 'Your data, ready for a fresh start' : 'This export is already here'}</h2>
      <p>Existing Folio records stay in place. Changed imported identities block the import.</p>
      <dl className="actual-counts">
        {Object.entries(review.added).map(([key, count]) => (
          <div key={key}>
            <dt>{key.replace(/([A-Z])/g, ' $1')}</dt>
            <dd>{count} new</dd>
          </div>
        ))}
      </dl>
      <p>{review.reused} existing source transactions skipped.</p>
      {review.preservedUnlinkedPayments > 0 && (
        <p className="actual-payment-warning">
          {review.preservedUnlinkedPayments} previously imported payments remain unlinked to schedules. Existing history
          is preserved. Review or skip their planned dates before resuming reminders.
        </p>
      )}
      {wizard.file && (
        <ActualScheduleReview
          rows={review.rows.recurring}
          file={wizard.file}
        />
      )}
      <ActualProgressReview
        review={review}
        file={wizard.file}
      />
      <ActualBalances review={review} />
      <button
        className="button secondary"
        onClick={() => download(wizard)}
      >
        Download complete review
      </button>
      {total > 0 && (
        <div className="actual-options">
          <label>
            <input
              type="checkbox"
              checked={wizard.acknowledged}
              disabled={wizard.busy}
              onChange={(event) => wizard.setAcknowledged(event.target.checked)}
            />
            I reviewed the additions, balance comparison and compatibility notes.
          </label>
          <button
            className="button primary"
            disabled={!wizard.acknowledged || wizard.busy}
            onClick={() => void wizard.commit()}
          >
            {wizard.busy ? 'Importing…' : 'Add reviewed data'}
          </button>
        </div>
      )}
    </section>
  );
}

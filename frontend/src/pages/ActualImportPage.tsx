import { Link } from 'react-router-dom';
import { useActualImport } from '../features/actual/useActualImport';
import { ActualUpload } from '../features/actual/ActualUpload';
import { ActualCompatibility } from '../features/actual/ActualCompatibility';
import { ActualReview } from '../features/actual/ActualReview';
/** Import a native Actual Budget archive through an explicit additive review.
 * @returns {JSX.Element} Migration page. */
export default function ActualImportPage() {
  const wizard = useActualImport();
  return (
    <div className="page-content actual-page">
      <div className="page-title-row">
        <div>
          <span className="eyebrow">A FAMILIAR BUDGET. A NEW HOME.</span>
          <h1>
            Move into Folio<span>.</span>
          </h1>
          <p>Import your Actual Budget history with every balance in view.</p>
        </div>
        <Link
          className="button secondary"
          to="/transactions"
        >
          Back to transactions
        </Link>
      </div>
      {wizard.error && (
        <p
          className="error-message"
          role="alert"
        >
          {wizard.error}
        </p>
      )}
      {wizard.result ? (
        <section className="panel">
          <h2>Your budget has arrived</h2>
          <p>
            {wizard.result.transactions} transactions and {wizard.result.accounts} accounts added.
          </p>
          <Link
            className="button primary"
            to="/transactions"
          >
            View transactions
          </Link>
        </section>
      ) : (
        <div className="actual-workspace">
          <div>
            <ActualUpload wizard={wizard} />
            {wizard.file && <ActualCompatibility file={wizard.file} />}
          </div>
          <ActualReview wizard={wizard} />
        </div>
      )}
    </div>
  );
}

import { ImportNavigation } from '../features/statements/ImportNavigation';
import { Link } from 'react-router-dom';
import { Check, ArrowRight } from 'lucide-react';
import { useImportWizard } from '../features/statements/useImportWizard';
import { ImportUpload } from '../features/statements/ImportUpload';
import { ImportMapping } from '../features/statements/ImportMapping';
import { ImportReview } from '../features/statements/ImportReview';
/** Review bank data before changing balances; file bytes remain on the device.
 * @returns {JSX.Element} Statement import route. */
export default function ImportPage() {
  const wizard = useImportWizard();
  return (
    <div className="page-content">
      <div className="page-title-row">
        <div>
          <span className="eyebrow">LESS TYPING. MORE CLARITY.</span>
          <h1>
            Bring your statement into balance<span>.</span>
          </h1>
          <p>Upload, map, and review. Every transaction stays in your control.</p>
        </div>
        <ImportNavigation />
      </div>
      <div className="import-steps">
        <span className={wizard.file ? 'complete' : 'active'}>1 · Choose statement</span>
        <span className={wizard.file && !wizard.preview.length ? 'active' : ''}>2 · Map columns</span>
        <span className={wizard.preview.length ? 'active' : ''}>3 · Review & import</span>
      </div>
      {wizard.error && (
        <p
          className="error-message"
          role="alert"
        >
          {wizard.error}
        </p>
      )}
      {!wizard.data.accounts.length && (
        <section className="panel empty-state">
          <h2>First, give your statement an account</h2>
          <p>Create a manual account in Settings before importing.</p>
          <Link
            className="button primary"
            to="/settings"
          >
            Create an account
          </Link>
        </section>
      )}
      {wizard.result ? (
        <section className="panel import-success">
          <Check size={34} />
          <h2>Your statement has landed</h2>
          <p>
            {`${wizard.result.imported} transactions imported · ` +
              `${wizard.result.matched} matched · ${wizard.result.skipped} skipped`}
          </p>
          <div className="settings-actions">
            <Link
              className="button primary"
              to={`/reconcile?account=${wizard.accountId}`}
            >
              Reconcile this account <ArrowRight size={16} />
            </Link>
            <Link
              className="button secondary"
              to={`/transactions?account=${wizard.accountId}`}
            >
              View transactions
            </Link>
            <button
              className="button secondary"
              onClick={() => {
                wizard.reset();
                wizard.setPreview([]);
              }}
            >
              Review another statement
            </button>
          </div>
        </section>
      ) : (
        <div className="import-workspace">
          <ImportUpload wizard={wizard} />
          <div>
            {wizard.preview.length ? (
              <ImportReview wizard={wizard} />
            ) : (
              wizard.file && <ImportMapping wizard={wizard} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

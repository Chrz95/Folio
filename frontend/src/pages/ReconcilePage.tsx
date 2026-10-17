import { Link } from 'react-router-dom';
import { useReconciliation } from '../features/statements/useReconciliation';
import { ReconciliationControls } from '../features/statements/ReconciliationControls';
import { ReconciliationLedger } from '../features/statements/ReconciliationLedger';
import { ReconciliationHistory } from '../features/statements/ReconciliationHistory';
/** Match account records to the bank without hiding differences behind adjustments.
 * @returns {JSX.Element} Reconciliation route. */
export default function ReconcilePage() {
  const statement = useReconciliation();
  return (
    <div className="page-content">
      <div className="page-title-row">
        <div>
          <span className="eyebrow">CONFIDENCE IN EVERY BALANCE</span>
          <h1>
            Make the numbers agree<span>.</span>
          </h1>
          <p>Compare cleared transactions with your bank statement, one account at a time.</p>
        </div>
        <div className="page-toolbar">
          <Link
            className="button secondary"
            to="/import"
          >
            Import a statement
          </Link>
          <Link
            className="button secondary"
            to="/transactions"
          >
            Back to transactions
          </Link>
        </div>
      </div>
      {statement.error && (
        <p
          className="error-message"
          role="alert"
        >
          {statement.error}
        </p>
      )}
      {statement.notice && <output className="reconciliation-notice">{statement.notice}</output>}
      {!statement.data.accounts.length ? (
        <section className="panel empty-state">
          <p>Create an account to start reconciling.</p>
          <Link
            className="button primary"
            to="/settings"
          >
            Account settings
          </Link>
        </section>
      ) : (
        <div className="reconciliation-workspace">
          <ReconciliationControls statement={statement} />
          <ReconciliationLedger statement={statement} />
          <ReconciliationHistory statement={statement} />
        </div>
      )}
    </div>
  );
}

import { Link } from 'react-router-dom';
import { Upload, ListChecks, TrendingUp } from 'lucide-react';
/** Keep statement workflows discoverable from the ledger and on narrow screens.
 * @returns {JSX.Element} Workflow navigation. */
export function StatementActions() {
  return (
    <nav
      className="statement-actions"
      aria-label="Financial workflows"
    >
      <Link
        className="button secondary"
        to="/import/actual"
      >
        Import Actual Budget
      </Link>
      <Link
        className="button secondary"
        to="/import"
      >
        <Upload size={16} />
        Import statement
      </Link>
      <Link
        className="button secondary"
        to="/reconcile"
      >
        <ListChecks size={16} />
        Reconcile account
      </Link>
      <Link
        className="button secondary"
        to="/forecast"
      >
        <TrendingUp size={16} />
        Cash-flow forecast
      </Link>
    </nav>
  );
}

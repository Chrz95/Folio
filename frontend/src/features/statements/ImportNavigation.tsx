import { Link } from 'react-router-dom';
/** Connect the two import paths without hiding migration from users with no accounts.
 * @returns {JSX.Element} Import navigation. */
export function ImportNavigation() {
  return (
    <nav
      className="settings-actions"
      aria-label="Import navigation"
    >
      <Link
        className="button secondary"
        to="/import/actual"
      >
        Import Actual Budget
      </Link>
      <Link
        className="button secondary"
        to="/transactions"
      >
        Back to transactions
      </Link>
    </nav>
  );
}

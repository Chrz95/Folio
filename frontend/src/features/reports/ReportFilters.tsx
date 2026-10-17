import { LedgerScopeFilters } from '../transactions/LedgerScopeFilters';
import type { ReportSelection } from './period';
interface Props {
  selection: ReportSelection;
  change: (key: string, value: string) => void;
}
/** Edit bookmarkable report dates and exact ledger scopes.
 * @param {Props} props - Filter state. @param {ReportSelection} props.selection - Current selection.
 * @param {(key: string, value: string) => void} props.change - URL updater.
 * @returns {JSX.Element} Report filter controls. */
export function ReportFilters({ selection, change }: Props) {
  return (
    <section
      className="panel report-filters"
      aria-label="Report filters"
    >
      <div className="report-date-filters">
        <label>
          Report period
          <select
            value={selection.period}
            onChange={(event) => change('period', event.target.value)}
          >
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
            <option value="custom">Custom dates</option>
          </select>
        </label>
        {selection.period === 'monthly' && (
          <label>
            Report month
            <input
              type="month"
              value={selection.month}
              min="1901-01"
              max="9998-12"
              onChange={(event) => change('month', event.target.value)}
            />
          </label>
        )}
        {selection.period === 'yearly' && (
          <label>
            Report year
            <input
              type="number"
              value={selection.year}
              min="1901"
              max="9998"
              step="1"
              onChange={(event) => change('year', event.target.value)}
            />
          </label>
        )}
        {selection.period === 'custom' && (
          <label>
            Start date
            <input
              type="date"
              value={selection.start}
              min="1901-01-01"
              max="9998-12-31"
              onChange={(event) => change('start', event.target.value)}
            />
          </label>
        )}
        {selection.period === 'custom' && (
          <label>
            End date
            <input
              type="date"
              value={selection.end}
              min="1901-01-01"
              max="9998-12-31"
              onChange={(event) => change('end', event.target.value)}
            />
          </label>
        )}
      </div>
      <LedgerScopeFilters
        accountId={selection.accountId}
        category={selection.category}
        onAccountChange={(value) => change('account', value)}
        onCategoryChange={(value) => change('category', value)}
      />
    </section>
  );
}

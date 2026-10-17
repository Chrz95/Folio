import { useSearchParams } from 'react-router-dom';
import { useWorkspace } from '../app/WorkspaceContext';
import { statistics } from '../features/overview/statistics';
import { readSelection, resolvePeriod } from '../features/reports/period';
import { reportEntries } from '../features/reports/report';
import { ReportFilters } from '../features/reports/ReportFilters';
import { ReportSummary } from '../features/reports/ReportSummary';
import { ReportTrend } from '../features/reports/ReportTrend';
import { ReportCategories } from '../features/reports/ReportCategories';
import { ReportScope } from '../features/reports/ReportScope';
/** Explore scoped recorded cash flow over calendar or custom periods with consistent comparisons and exports.
 * @returns {JSX.Element} Bookmarkable reporting route. */
export default function ReportsPage() {
  const { data, month } = useWorkspace();
  const [parameters, setParameters] = useSearchParams();
  const selection = readSelection(parameters, month);
  const { current, previous, error } = resolvePeriod(selection);
  /** Freeze all defaults into a bookmarkable report while updating one selection.
   * @param {string} key - Query key. @param {string} value - Selected value. @returns {void} URL update. */
  function change(key: string, value: string) {
    const next = new URLSearchParams(parameters);
    Object.entries({
      period: selection.period,
      month: selection.month,
      year: selection.year,
      start: selection.start,
      end: selection.end,
      account: selection.accountId,
      category: selection.category,
    }).forEach(([name, selected]) => next.set(name, selected));
    next.set(key, value);
    setParameters(next);
  }
  const entries = current ? reportEntries(data.transactions, current, selection) : [];
  const totals = statistics(entries);
  const prior = statistics(previous ? reportEntries(data.transactions, previous, selection) : []);
  return (
    <div className="page-content">
      <div className="page-title-row">
        <div>
          <span className="eyebrow">THE BIGGER PICTURE</span>
          <h1>
            A little insight. A lot of possibility<span>.</span>
          </h1>
          <p>Compare recorded cash flow across the dates and categories that matter to you.</p>
        </div>
      </div>
      <ReportFilters
        selection={selection}
        change={change}
      />
      {error && <p role="alert">{error}</p>}
      {current && previous && (
        <div className="report-results">
          <ReportScope
            report={{ selection, current, previous, totals, prior, data }}
            entries={entries}
          />
          <ReportSummary
            current={totals}
            previous={prior}
          />
          <ReportTrend
            entries={entries}
            range={current}
          />
          <ReportCategories
            current={totals}
            previous={prior}
          />
        </div>
      )}
    </div>
  );
}

import type { Transaction } from '../../types/budget';
import { exportTransactions } from '../transactions/export';
import { exportReport } from './reportExport';
import type { ReportExport } from './reportExport';
interface Props {
  report: ReportExport;
  entries: Transaction[];
}
/** Explain inclusive comparison periods and export exactly the displayed selection.
 * @param {Props} props - Report snapshot. @param {ReportExport} props.report - Totals and scope.
 * @param {Transaction[]} props.entries - Matching postings. @returns {JSX.Element} Scope and download actions. */
export function ReportScope({ report, entries }: Props) {
  const { current, previous } = report;
  return (
    <div
      className="report-scope-note"
      aria-live="polite"
    >
      <p>
        <strong>
          {current.start} to {current.end}
        </strong>
        <br />
        Compared with {previous.start} to {previous.end}. Both periods use the same filters.
      </p>
      <p>
        Recorded income and expenses only. Transfers and unpaid schedules are excluded. Calendar periods are compared in
        full, including when the selected period is still in progress.
      </p>
      <span>{entries.length} recorded cash flow transactions</span>
      <div className="report-export-actions">
        <button
          className="button secondary"
          onClick={() => exportReport(report)}
        >
          Export report CSV
        </button>
        <button
          className="button secondary"
          onClick={() => exportTransactions(entries)}
        >
          Export transactions CSV
        </button>
      </div>
    </div>
  );
}

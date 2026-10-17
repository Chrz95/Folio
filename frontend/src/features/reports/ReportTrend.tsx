/* oxlint-disable jsx-a11y/no-noninteractive-tabindex -- Keyboard access to the scrollable chart. */
import type { Transaction } from '../../types/budget';
import { money } from '../../utils/format';
import type { DateRange } from './period';
import { reportBuckets } from './report';
import { REPORT } from './report.constants';
interface Props {
  entries: Transaction[];
  range: DateRange;
}
/** Chart the selected period with readable exact values and zero-activity intervals.
 * @param {Props} props - Selected cash flow. @param {Transaction[]} props.entries - Scoped postings.
 * @param {DateRange} props.range - Inclusive dates. @returns {JSX.Element} Accessible cash flow bars. */
export function ReportTrend({ entries, range }: Props) {
  const buckets = reportBuckets(entries, range);
  const maximum = Math.max(1, ...buckets.flatMap((bucket) => [bucket.income, bucket.expenses]));
  return (
    <section
      className="panel"
      aria-label="Report cash flow"
    >
      <div className="panel-heading">
        <div>
          <h2>Cash flow over time</h2>
          <p>Recorded income and expenses. Short ranges show days; longer ranges show months.</p>
        </div>
      </div>
      <section
        className="report-trend"
        tabIndex={0}
        aria-label="Scrollable cash flow intervals"
      >
        <table>
          <caption className="report-caption">Income and expenses in euros for the selected dates and filters</caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Income</th>
              <th scope="col">Expenses</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((bucket) => (
              <tr key={bucket.label}>
                <th scope="row">{bucket.label}</th>
                <td>
                  <span>{money(bucket.income)}</span>
                  <i
                    aria-hidden="true"
                    className="report-bar income"
                    style={{ width: `${(bucket.income / maximum) * REPORT.percent}%` }}
                  />
                </td>
                <td>
                  <span>{money(bucket.expenses)}</span>
                  <i
                    aria-hidden="true"
                    className="report-bar expense"
                    style={{ width: `${(bucket.expenses / maximum) * REPORT.percent}%` }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </section>
  );
}

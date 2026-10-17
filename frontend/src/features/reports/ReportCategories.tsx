import { CategoryIcon } from '../../components/ui/CategoryIcon';
import { money } from '../../utils/format';
import type { ReportTotals } from './report';
import { REPORT } from './report.constants';
interface Props {
  current: ReportTotals;
  previous: ReportTotals;
}
/** Compare all current and previous expense categories, including categories with no current spending.
 * @param {Props} props - Filtered expense totals. @param {ReportTotals} props.current - Current totals.
 * @param {ReportTotals} props.previous - Comparison totals. @returns {JSX.Element} Category breakdown. */
export function ReportCategories({ current, previous }: Props) {
  const currentMap = new Map(current.categories);
  const previousMap = new Map(previous.categories);
  const names = [...new Set([...currentMap.keys(), ...previousMap.keys()])].sort(
    (first, second) => (currentMap.get(second) ?? 0) - (currentMap.get(first) ?? 0) || first.localeCompare(second),
  );
  return (
    <section
      className="panel"
      aria-label="Report spending categories"
    >
      <div className="panel-heading">
        <div>
          <h2>Spending by category</h2>
          <p>Current amount, share of current spending and change from the comparison period.</p>
        </div>
        <strong>{money(current.expenses)}</strong>
      </div>
      <div className="report-category-list">
        {names.map((category) => {
          const amount = currentMap.get(category) ?? 0;
          const prior = previousMap.get(category) ?? 0;
          return (
            <div
              className="report-category report-category-comparison"
              key={category}
            >
              <CategoryIcon category={category} />
              <strong>{category}</strong>
              <progress
                aria-label={`${category} share of spending`}
                value={amount}
                max={current.expenses || 1}
              />
              <span className="muted">
                {current.expenses ? Math.round((amount / current.expenses) * REPORT.percent) : 0}%
              </span>
              <b>{money(amount)}</b>
              <small>
                Previous {money(prior)} · Change {amount > prior ? '+' : ''}
                {money(amount - prior)}
              </small>
            </div>
          );
        })}
        {!names.length && (
          <div className="empty-state">
            <p>No spending in either period for these filters.</p>
          </div>
        )}
      </div>
    </section>
  );
}

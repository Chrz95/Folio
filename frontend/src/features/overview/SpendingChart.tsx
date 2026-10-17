import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useWorkspace } from '../../app/WorkspaceContext';
import { monthTransactions, statistics } from './statistics';
import { money, categoryInfo } from '../../utils/format';
import { VALUE } from '../../constants/app.constants';
/** Show category proportions with an accompanying accessible legend.
 * @returns {JSX.Element} Spending distribution. */
export function SpendingChart() {
  const { data, month } = useWorkspace();
  const { categories, expenses } = statistics(monthTransactions(data, month));
  const stops = categories.map(([category, amount], index) => {
    const start = (categories.slice(0, index).reduce((sum, entry) => sum + entry[1], 0) / expenses) * VALUE.percent;
    return `${categoryInfo(category).color} ${start}% ${start + (amount / expenses) * VALUE.percent}%`;
  });
  return (
    <section className="panel spending-panel">
      <div className="panel-heading">
        <div>
          <h2>Where it went</h2>
          <p>A little awareness goes a long way.</p>
        </div>
        <Link
          className="icon-button"
          to="/reports"
          aria-label="View spending reports"
        >
          <ArrowUpRight size={18} />
        </Link>
      </div>
      <div className="spending-content">
        <div
          className="donut"
          style={{ background: stops.length ? `conic-gradient(${stops.join(',')})` : 'var(--border)' }}
          aria-label={`Total spending ${money(expenses)}`}
        >
          <div>
            <small>Total spent</small>
            <strong>{money(expenses)}</strong>
          </div>
        </div>
        <div className="category-legend">
          {categories.slice(0, VALUE.previewRows).map(([category, amount]) => (
            <div key={category}>
              <span>
                <i
                  className="small-dot"
                  style={{ backgroundColor: categoryInfo(category).color }}
                />
                {category}
              </span>
              <strong>{Math.round((amount / expenses) * VALUE.percent)}%</strong>
            </div>
          ))}
          {categories.length === 0 && <p>No expenses this month.</p>}
        </div>
      </div>
      <Link
        className="panel-bottom-link"
        to="/reports"
      >
        Explore your spending <ArrowUpRight size={14} />
      </Link>
    </section>
  );
}

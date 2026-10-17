import { Link } from 'react-router-dom';
import { ArrowUpRight, Leaf } from 'lucide-react';
import { useWorkspace } from '../../app/WorkspaceContext';
import { monthlyPlans } from '../planning/monthlyPlanning';
import { money, categoryInfo } from '../../utils/format';
import { VALUE } from '../../constants/app.constants';
/** Compare actual category spending with user-defined monthly limits.
 * @returns {JSX.Element} Budget progress overview. */
export function BudgetPreview() {
  const { data, month } = useWorkspace();
  const plans = monthlyPlans(data, month);
  return (
    <section className="panel budget-preview">
      <div className="panel-heading">
        <div>
          <h2>Mindful spending</h2>
          <p>Your plans, taking shape.</p>
        </div>
        <Link
          className="icon-button"
          to="/budgets"
          aria-label="Manage budgets"
        >
          <ArrowUpRight size={18} />
        </Link>
      </div>
      {plans.slice(0, VALUE.upcomingRows).map((budget) => {
        const { spent } = budget;
        const percentage = Math.min(
          VALUE.percent,
          budget.available > 0 ? (spent / budget.available) * VALUE.percent : spent > 0 ? VALUE.percent : 0,
        );
        return (
          <div
            className="budget-progress"
            key={budget.category}
          >
            <div>
              <span>
                <i
                  className="small-dot"
                  style={{ backgroundColor: categoryInfo(budget.category).color }}
                />
                {budget.category}
              </span>
              <span>
                <strong>{money(spent)}</strong> / {money(budget.available)}
              </span>
            </div>
            <progress
              aria-label={`${budget.category} budget used`}
              value={percentage}
              max={VALUE.percent}
              style={{ accentColor: spent > budget.available ? '#b76551' : categoryInfo(budget.category).color }}
            />
          </div>
        );
      })}
      {!plans.length && (
        <div className="empty-state">
          <Leaf size={28} />
          <p>Give your money a little direction.</p>
          <Link to="/budgets">Create your first budget</Link>
        </div>
      )}
      <div className="budget-note">
        <Leaf size={15} />
        <span>Small choices today. More freedom tomorrow.</span>
      </div>
    </section>
  );
}

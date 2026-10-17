import { BudgetCopyPanel } from '../features/budgets/BudgetCopyPanel';
import { Leaf } from 'lucide-react';
import { useWorkspace } from '../app/WorkspaceContext';
import { MonthPicker } from '../components/ui/MonthPicker';
import { monthlyPlans } from '../features/planning/monthlyPlanning';
import { SavingsGoals } from '../features/goals/SavingsGoals';
import { BudgetCard } from '../features/budgets/BudgetCard';
import { AddBudgetForm } from '../features/budgets/AddBudgetForm';
import { money } from '../utils/format';
/** Connect monthly caps to actual category expense totals.
 * @returns {JSX.Element} Budget planning route. */
export default function BudgetsPage() {
  const { data, month } = useWorkspace();
  const plans = monthlyPlans(data, month);
  const totalBudget = plans.reduce((sum, entry) => sum + entry.available, 0);
  const totalSpent = plans.reduce((sum, entry) => sum + entry.spent, 0);
  return (
    <div className="page-content">
      <div className="page-title-row">
        <div>
          <span className="eyebrow">SPEND WITH INTENTION</span>
          <h1>
            A plan for what matters<span>.</span>
          </h1>
          <p>Give every category a little direction. Leave room for living.</p>
        </div>
        <MonthPicker />
      </div>
      <div className="recurring-banner">
        <span className="recurring-banner-icon">
          <Leaf size={25} />
        </span>
        <div>
          <span>Available in your budgets</span>
          <strong>{money(totalBudget - totalSpent)}</strong>
        </div>
        <p>
          {money(totalSpent)} spent of {money(totalBudget)} planned.
          <br />
          These are spending limits, not reserved account funds.
        </p>
      </div>
      <div className="budget-grid">
        {plans.map((plan) => (
          <BudgetCard
            key={`${month}:${plan.category}:${plan.amount}:${plan.rollover}`}
            plan={plan}
          />
        ))}
      </div>
      <p className="planning-explainer">
        Edit limits for the selected month only. Rollover carries positive unspent funds to the next month; enable it
        again there to keep carrying. Unconfigured months use your original limits.
      </p>
      <AddBudgetForm key={month} />
      <BudgetCopyPanel key={`copy:${month}`} />
      <SavingsGoals />
    </div>
  );
}

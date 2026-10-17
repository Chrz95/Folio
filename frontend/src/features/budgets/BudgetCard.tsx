import { useState } from 'react';
import { Pencil, X } from 'lucide-react';
import { money } from '../../utils/format';
import { CategoryIcon } from '../../components/ui/CategoryIcon';
import { BudgetAllocationForm } from './BudgetAllocationForm';
import type { MonthPlan } from '../../types/planning';
interface BudgetCardProps {
  plan: MonthPlan;
}
/** Show allocation and carry separately so a month edit cannot hide its source.
 * @param {BudgetCardProps} props - Monthly card. @param {MonthPlan} props.plan - Derived month plan.
 * @returns {JSX.Element} Editable spending plan. */
export function BudgetCard({ plan }: BudgetCardProps) {
  const [isEditing, setEditing] = useState(false);
  return (
    <article className="panel budget-card">
      <div className="budget-card-title">
        <CategoryIcon category={plan.category} />
        <h2>{plan.category}</h2>
        <button
          className="icon-button"
          aria-label={`Edit ${plan.category} budget`}
          onClick={() => setEditing(!isEditing)}
        >
          {isEditing ? <X size={16} /> : <Pencil size={16} />}
        </button>
      </div>
      {isEditing ? (
        <BudgetAllocationForm
          plan={plan}
          onSaved={() => setEditing(false)}
        />
      ) : (
        <div className="budget-card-values">
          <strong>{money(plan.spent)}</strong>
          <span>of {money(plan.available)} available</span>
        </div>
      )}
      <p className="planning-detail">
        {money(plan.amount)} allocated + {money(plan.carry)} carried in
      </p>
      <progress
        aria-label={`${plan.category} budget used`}
        value={Math.min(plan.spent, plan.available)}
        max={plan.available || 1}
        className={plan.remaining < 0 ? 'over-budget' : ''}
      />
      <div className="budget-card-footer">
        <span className={plan.remaining < 0 ? 'negative' : 'positive'}>
          {money(Math.abs(plan.remaining))} {plan.remaining < 0 ? 'over budget' : 'left to spend'}
        </span>
        <span>{plan.rollover ? 'Rollover on' : 'Rollover off'}</span>
      </div>
    </article>
  );
}

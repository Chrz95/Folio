import { useState } from 'react';
import { useWorkspace } from '../../app/WorkspaceContext';
import { VALUE } from '../../constants/app.constants';
import type { MonthPlan } from '../../types/planning';
interface AllocationProps {
  plan: MonthPlan;
  onSaved: () => void;
}
/** Save an exact month override, including an explicit zero allocation.
 * @param {AllocationProps} props - Budget editor. @param {MonthPlan} props.plan - Selected category and month.
 * @param {() => void} props.onSaved - Close editor after durable save. @returns {JSX.Element} Allocation form. */
export function BudgetAllocationForm({ plan, onSaved }: AllocationProps) {
  const { save, isSaving } = useWorkspace();
  const [amount, setAmount] = useState(String(plan.amount / VALUE.cents));
  const [rollover, setRollover] = useState(plan.rollover);
  return (
    <form
      className="planning-form"
      onSubmit={(event) => {
        event.preventDefault();
        void save('monthlyBudgets', 'PUT', {
          month: plan.month,
          category: plan.category,
          amount: Math.round(Number(amount) * VALUE.cents),
          rollover,
        }).then((success) => {
          if (success) {
            onSaved();
          }
        });
      }}
    >
      <label>
        Allocation for this month (€)
        <input
          type="number"
          min="0"
          step="0.01"
          max={VALUE.maximumMoney / VALUE.cents}
          required
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
      </label>
      <label className="inline-check">
        <input
          type="checkbox"
          checked={rollover}
          onChange={(event) => setRollover(event.target.checked)}
        />
        Carry unused funds into next month
      </label>
      <button
        className="button primary"
        disabled={isSaving}
      >
        Save this month
      </button>
    </form>
  );
}

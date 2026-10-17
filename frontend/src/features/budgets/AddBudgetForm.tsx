import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useWorkspace } from '../../app/WorkspaceContext';
import { VALUE } from '../../constants/app.constants';
import { categoryNames } from '../planning/catalog';
/** Add or replace a spending limit only for the month selected above.
 * @returns {JSX.Element} Inline monthly budget form. */
export function AddBudgetForm() {
  const { save, isSaving, month, data } = useWorkspace();
  const [category, setCategory] = useState('Groceries');
  const [amount, setAmount] = useState('');
  const [rollover, setRollover] = useState(false);
  return (
    <form
      className="panel add-budget-form"
      onSubmit={(event) => {
        event.preventDefault();
        void save('monthlyBudgets', 'PUT', {
          month,
          category,
          amount: Math.round(Number(amount) * VALUE.cents),
          rollover,
        }).then((success) => {
          if (success) {
            setAmount('');
          }
        });
      }}
    >
      <div>
        <h2>Give a category a plan</h2>
        <p>
          Applies only to {month.slice(0, VALUE.monthPrefixLength)}. Add your own categories in{' '}
          <Link to="/settings">Settings</Link>.
        </p>
      </div>
      <label>
        Category
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          {categoryNames(data).map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
      </label>
      <label>
        Monthly allocation (€)
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          max={VALUE.maximumMoney / VALUE.cents}
          required
          placeholder="250.00"
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
        <Plus size={16} />
        Save budget
      </button>
    </form>
  );
}

import { useState } from 'react';
import { useWorkspace } from '../../app/WorkspaceContext';
import type { SavingsGoal } from '../../types/planning';
import { VALUE } from '../../constants/app.constants';
interface GoalEditorProps {
  goal?: SavingsGoal;
  onSaved?: () => void;
}
/** Create or edit a target without generating account movements.
 * @param {GoalEditorProps} props - Goal form. @param {SavingsGoal} props.goal - Existing target.
 * @param {() => void} props.onSaved - Optional completion callback. @returns {JSX.Element} Goal form. */
export function GoalEditor({ goal, onSaved }: GoalEditorProps) {
  const { save, isSaving } = useWorkspace();
  const [name, setName] = useState(goal?.name ?? '');
  const [amount, setAmount] = useState(goal ? String(goal.targetAmount / VALUE.cents) : '');
  const [date, setDate] = useState(goal?.targetDate ?? '');
  return (
    <form
      className="planning-form"
      onSubmit={(event) => {
        event.preventDefault();
        void save(
          'goals',
          goal ? 'PUT' : 'POST',
          {
            name,
            targetAmount: Math.round(Number(amount) * VALUE.cents),
            targetDate: date || null,
            isArchived: goal?.isArchived ?? false,
          },
          goal?.id,
        ).then((success) => {
          if (success) {
            setName('');
            setAmount('');
            setDate('');
            onSaved?.();
          }
        });
      }}
    >
      <label>
        Goal name
        <input
          required
          maxLength={100}
          placeholder="e.g. Emergency fund"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <div className="form-two-columns">
        <label>
          Target (€)
          <input
            required
            type="number"
            min="0.01"
            step="0.01"
            max={VALUE.maximumMoney / VALUE.cents}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </label>
        <label>
          Target date (optional)
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
      </div>
      <button
        className="button primary"
        disabled={isSaving}
      >
        {goal ? 'Save goal' : 'Create goal'}
      </button>
    </form>
  );
}

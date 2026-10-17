import { useState } from 'react';
import { Target, Pencil } from 'lucide-react';
import { useWorkspace } from '../../app/WorkspaceContext';
import { money, formatDate } from '../../utils/format';
import { VALUE } from '../../constants/app.constants';
import type { SavingsGoal } from '../../types/planning';
import { goalProgress } from './goalProgress';
import { GoalEditor } from './GoalEditor';
import { ContributionForm } from './ContributionForm';
import { GoalHistory } from './GoalHistory';
interface GoalCardProps {
  goal: SavingsGoal;
}
/** Present a savings target, progress journal and reversible archive action.
 * @param {GoalCardProps} props - Target card. @param {SavingsGoal} props.goal - Goal details.
 * @returns {JSX.Element} Savings goal card. */
export function GoalCard({ goal }: GoalCardProps) {
  const { data, save, isSaving } = useWorkspace();
  const [isEditing, setEditing] = useState(false);
  const progress = goalProgress(goal, data.contributions ?? []);
  return (
    <article className="panel goal-card">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">
            <Target size={14} /> {goal.isArchived ? 'ARCHIVED' : 'SAVINGS GOAL'}
          </span>
          <h2>{goal.name}</h2>
        </div>
        <button
          className="icon-button"
          aria-label={`Edit ${goal.name} goal`}
          onClick={() => setEditing(!isEditing)}
        >
          <Pencil size={16} />
        </button>
      </div>
      {isEditing && (
        <GoalEditor
          goal={goal}
          onSaved={() => setEditing(false)}
        />
      )}
      <div className="goal-progress">
        <strong>{money(progress.saved)}</strong>
        <span>of {money(goal.targetAmount)}</span>
      </div>
      <progress
        aria-label={`${goal.name} progress`}
        value={progress.percentage}
        max={VALUE.percent}
      />
      <p>
        {progress.remaining === 0 ? 'You reached your target.' : `${money(progress.remaining)} still to save.`}
        {goal.targetDate && ` Target: ${formatDate(goal.targetDate)}.`}
      </p>
      {progress.monthly !== null && (
        <p className="planning-detail">{money(progress.monthly)} per calendar month, including this month.</p>
      )}
      {progress.isOverdue && <p className="negative">Your target date has passed. You can adjust it above.</p>}
      {!goal.isArchived && (
        <details className="goal-contribute">
          <summary>Update saved amount</summary>
          <ContributionForm goalId={goal.id} />
        </details>
      )}
      <GoalHistory goalId={goal.id} />
      <button
        className="text-button"
        disabled={isSaving}
        onClick={() =>
          void save(
            'goals',
            'PUT',
            {
              name: goal.name,
              targetAmount: goal.targetAmount,
              targetDate: goal.targetDate,
              isArchived: !goal.isArchived,
            },
            goal.id,
          )
        }
      >
        {goal.isArchived ? 'Restore goal' : 'Archive goal'}
      </button>
    </article>
  );
}

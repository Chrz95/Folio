import { useState } from 'react';
import { useWorkspace } from '../../app/WorkspaceContext';
import { GoalEditor } from './GoalEditor';
import { GoalCard } from './GoalCard';
/** Keep goals beside the monthly spending plan with explicit bookkeeping semantics.
 * @returns {JSX.Element} Goals section. */
export function SavingsGoals() {
  const { data } = useWorkspace();
  const [showArchived, setShowArchived] = useState(false);
  const goals = (data.goals ?? []).filter((entry) => showArchived || !entry.isArchived);
  return (
    <section className="savings-goals">
      <div className="section-heading">
        <div>
          <span className="eyebrow">MAKE ROOM FOR TOMORROW</span>
          <h2>Something to save for.</h2>
          <p>Manually track money you have set aside. Goals do not move or reserve account funds.</p>
        </div>
        <label className="inline-check">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(event) => setShowArchived(event.target.checked)}
          />
          Show archived
        </label>
      </div>
      <div className="budget-grid">
        {goals.map((goal) => (
          <GoalCard
            key={`${goal.id}:${goal.name}:${goal.targetAmount}:${goal.targetDate}`}
            goal={goal}
          />
        ))}
        <article className="panel goal-card">
          <h3>Create a savings goal</h3>
          <GoalEditor />
        </article>
      </div>
    </section>
  );
}

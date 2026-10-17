import { useWorkspace } from '../../app/WorkspaceContext';
import { money, formatDate } from '../../utils/format';
interface HistoryProps {
  goalId: string;
}
/** Make manual adjustments reviewable without mixing them into the financial ledger.
 * @param {HistoryProps} props - History scope. @param {string} props.goalId - Goal UUID.
 * @returns {JSX.Element} Expandable progress journal. */
export function GoalHistory({ goalId }: HistoryProps) {
  const { data } = useWorkspace();
  const entries = (data.contributions ?? [])
    .filter((entry) => entry.goalId === goalId)
    .sort((left, right) => right.date.localeCompare(left.date) || right.createdAt - left.createdAt);
  return (
    <details className="goal-history">
      <summary>Progress history ({entries.length})</summary>
      {!entries.length && <p>No saved amounts recorded yet.</p>}
      {entries.map((entry) => (
        <div key={entry.id}>
          <span>
            {formatDate(entry.date)}
            <small>{entry.notes || 'Manual progress update'}</small>
          </span>
          <strong className={entry.amount < 0 ? 'negative' : 'positive'}>
            {entry.amount > 0 ? '+' : '−'}
            {money(Math.abs(entry.amount))}
          </strong>
        </div>
      ))}
    </details>
  );
}

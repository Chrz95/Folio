import { Link } from 'react-router-dom';
import { ArrowUpRight, Repeat2, ArrowRight } from 'lucide-react';
import { useWorkspace } from '../../app/WorkspaceContext';
import { getOccurrences } from '../transactions/recurrence';
import { dateKey, shiftMonth, money, formatDate } from '../../utils/format';
import { CategoryIcon } from '../../components/ui/CategoryIcon';
import { VALUE } from '../../constants/app.constants';
/** Preview the next unpaid occurrences without posting them automatically.
 * @returns {JSX.Element} Upcoming payments card. */
export function UpcomingPayments() {
  const { data, setEditor } = useWorkspace();
  const upcoming = getOccurrences(data, dateKey(), shiftMonth(dateKey(), VALUE.monthCount))
    .filter((entry) => !entry.isPaid)
    .slice(0, VALUE.upcomingRows);
  const total = upcoming.reduce((sum, entry) => sum + (entry.type === 'expense' ? entry.amount : 0), 0);
  return (
    <section className="panel upcoming-panel">
      <div className="panel-heading">
        <div>
          <h2>Coming up next</h2>
          <p>Stay one step ahead of your bills.</p>
        </div>
        <span className="count-badge">{upcoming.length}</span>
      </div>
      <div className="upcoming-list">
        {upcoming.map((entry) => (
          <button
            className="upcoming-item"
            key={entry.occurrenceId}
            onClick={() =>
              setEditor({ transaction: data.recurring.find((template) => template.id === entry.id), isRecurring: true })
            }
          >
            <CategoryIcon category={entry.category} />
            <span>
              <strong>{entry.name}</strong>
              <small>
                <Repeat2 size={11} />
                {formatDate(entry.date)} · {entry.frequency}
              </small>
            </span>
            <b className={entry.type === 'income' ? 'positive' : ''}>
              {entry.type === 'income' ? '+' : ''}
              {money(entry.amount)}
            </b>
          </button>
        ))}
        {!upcoming.length && (
          <div className="empty-state">
            <p>No recurring payments yet.</p>
            <button
              className="text-button"
              onClick={() => setEditor({ isRecurring: true })}
            >
              Create a recurring transaction <ArrowUpRight size={14} />
            </button>
          </div>
        )}
      </div>
      <div className="upcoming-total">
        <span>Next planned expenses</span>
        <strong>{money(total)}</strong>
      </div>
      <Link
        className="panel-bottom-link"
        to="/recurring"
      >
        Manage recurring transactions <ArrowRight size={14} />
      </Link>
    </section>
  );
}

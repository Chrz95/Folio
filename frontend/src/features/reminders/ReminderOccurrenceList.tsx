import { Clock3, Check, BellRing } from 'lucide-react';
import type { ReminderCenterState } from './useReminderCenter';
import { useWorkspace } from '../../app/WorkspaceContext';
import { money, formatDate } from '../../utils/format';
import { CategoryIcon } from '../../components/ui/CategoryIcon';
interface ReminderOccurrenceListProps {
  center: ReminderCenterState;
}
/** Show unpaid upcoming/overdue occurrences with explicit snooze and payment actions.
 * @param {ReminderOccurrenceListProps} props - Occurrences.
 * @param {ReminderCenterState} props.center - Saved policy and status. @returns {JSX.Element} Reminder agenda. */
export function ReminderOccurrenceList({ center }: ReminderOccurrenceListProps) {
  const { pay, isSaving } = useWorkspace();
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>A little less to keep in mind</h2>
          <p>Next seven days, plus the configured overdue window. Snoozing leaves the payment date unchanged.</p>
        </div>
      </div>
      <div className="reminder-occurrence-list">
        {center.entries.map((entry) => {
          const isSnoozed = entry.snoozedUntil > center.now;
          return (
            <article
              className="reminder-occurrence"
              key={entry.occurrenceId}
            >
              <CategoryIcon category={entry.category} />
              <div>
                <strong>{entry.name}</strong>
                <small>
                  {formatDate(entry.date)} · {money(entry.amount)}
                </small>
                <span className={`occurrence-status ${entry.isOverdue ? 'negative' : ''}`}>
                  <BellRing size={12} />
                  {entry.isOverdue ? 'Overdue' : entry.isDueToday ? 'Due today' : 'Upcoming'}
                  {isSnoozed && ` · Snoozed until ${new Date(entry.snoozedUntil).toLocaleString()}`}
                </span>
              </div>
              <div className="occurrence-actions">
                <select
                  aria-label={`Snooze ${entry.name} ${entry.date}`}
                  value=""
                  disabled={center.isBusy}
                  onChange={(event) => void center.snooze(entry.id, entry.date, Number(event.target.value))}
                >
                  <option
                    value=""
                    disabled
                  >
                    Snooze…
                  </option>
                  <option value={center.snoozeDurations[0]}>1 hour</option>
                  <option value={center.snoozeDurations[1]}>24 hours</option>
                </select>
                <button
                  className="button secondary"
                  disabled={isSaving || center.isBusy}
                  onClick={() => void pay(entry)}
                >
                  <Check size={15} />
                  Mark paid
                </button>
              </div>
            </article>
          );
        })}
        {!center.entries.length && (
          <div className="empty-state">
            <Clock3 size={30} />
            <p>All clear in this reminder window.</p>
          </div>
        )}
      </div>
    </section>
  );
}

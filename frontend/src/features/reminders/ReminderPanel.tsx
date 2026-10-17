import { X, Bell, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useWorkspace } from '../../app/WorkspaceContext';
import { getOccurrences } from '../transactions/recurrence';
import { dateKey, money, formatDate } from '../../utils/format';
import { VALUE } from '../../constants/app.constants';
interface ReminderPanelProps {
  onClose: () => void;
}
/** Show upcoming unpaid items and a path to opt-in reminder settings.
 * @param {ReminderPanelProps} props - Popover actions.
 * @param {() => void} props.onClose - Close action.
 * @returns {JSX.Element} Reminder panel. */
export function ReminderPanel({ onClose }: ReminderPanelProps) {
  const { data } = useWorkspace();
  const end = reminderHorizon();
  const entries = getOccurrences(data, dateKey(), dateKey(end)).filter((entry) => !entry.isPaid);
  return (
    <section
      className="reminder-popover"
      aria-label="Upcoming reminders"
    >
      <div className="panel-heading">
        <div>
          <h2>Your gentle reminders</h2>
          <p>Planned for the next seven days</p>
        </div>
        <button
          className="icon-button"
          aria-label="Close reminders"
          onClick={onClose}
        >
          <X size={17} />
        </button>
      </div>
      {entries.map((entry) => (
        <div
          className="reminder-entry"
          key={entry.occurrenceId}
        >
          <Bell size={17} />
          <span>
            <strong>{entry.name}</strong>
            <small>
              {formatDate(entry.date)} · {money(entry.amount)}
            </small>
          </span>
        </div>
      ))}
      {!entries.length && (
        <div className="empty-state">
          <Bell size={27} />
          <p>All clear for the next seven days.</p>
        </div>
      )}
      <Link
        className="panel-bottom-link"
        to="/reminders"
        onClick={onClose}
      >
        Timing, snoozes & overdue payments <ArrowRight size={14} />
      </Link>
    </section>
  );
}

/** Return the end of the preview reminder window.
 * @returns {Date} Local date seven days ahead. */
function reminderHorizon() {
  const date = new Date();
  date.setDate(date.getDate() + VALUE.reminderDays);
  return date;
}

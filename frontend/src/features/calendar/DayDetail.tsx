import { OccurrenceActions } from '../schedules/OccurrenceActions';
import { Plus, Check, Clock3 } from 'lucide-react';
import { useWorkspace } from '../../app/WorkspaceContext';
import { calendarEntries, PAYMENT_LABEL } from './calendarEntries';
import { useToday } from '../../hooks/useToday';
import { formatDate, money } from '../../utils/format';
import { CategoryIcon } from '../../components/ui/CategoryIcon';
interface DayDetailProps {
  date: string;
}
/** Show paid and planned entries for a selected date with explicit posting controls.
 * @param {DayDetailProps} props - Selected day.
 * @param {string} props.date - ISO date to inspect.
 * @returns {JSX.Element} Day agenda. */
export function DayDetail({ date }: DayDetailProps) {
  const { data, setEditor } = useWorkspace();
  const today = useToday();
  const actual = data.transactions.filter((entry) => entry.date === date);
  const planned = calendarEntries(data, date, date, today).filter((row) => row.isPlanned);
  return (
    <section className="panel day-detail">
      <div className="panel-heading">
        <div>
          <h2>{formatDate(date, { weekday: 'long', month: 'long', day: 'numeric' })}</h2>
          <p>{actual.length + planned.length} transactions for this day</p>
        </div>
        <button
          className="icon-button"
          aria-label="Add transaction on selected day"
          onClick={() => setEditor({ isRecurring: false, date })}
        >
          <Plus size={18} />
        </button>
      </div>
      {actual.map((entry) => (
        <button
          className="agenda-item confirmed"
          key={entry.id}
          onClick={() => setEditor({ isRecurring: false, transaction: entry })}
        >
          <CategoryIcon category={entry.category} />
          <span>
            <strong>{entry.name}</strong>
            <small>
              <Check size={12} />
              Confirmed
            </small>
          </span>
          <b className={entry.type === 'income' ? 'positive' : ''}>{money(entry.amount)}</b>
        </button>
      ))}
      {planned.map(({ entry, status, key, isPaused }) => (
        <div
          className={`agenda-item planned-item ${status}`}
          key={key}
        >
          <CategoryIcon category={entry.category} />
          <span>
            <strong>{entry.name}</strong>
            <small>
              <Clock3 size={12} />
              {PAYMENT_LABEL[status]}
              {isPaused ? ' · Paused' : ''} · {money(entry.amount)}
            </small>
          </span>
          <OccurrenceActions
            occurrence={entry}
            isPaused={isPaused}
          />
        </div>
      ))}
      {!actual.length && !planned.length && (
        <div className="empty-state">
          <p>
            A little breathing room.
            <br />
            Nothing scheduled for this day.
          </p>
          <button
            className="text-button"
            onClick={() => setEditor({ isRecurring: false, date })}
          >
            Add a transaction <Plus size={14} />
          </button>
        </div>
      )}
      <p className="agenda-hint">Planned transactions affect your balance only after you mark them paid.</p>
    </section>
  );
}

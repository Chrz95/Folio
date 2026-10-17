import { useWorkspace } from '../../app/WorkspaceContext';
import { DAYS, VALUE } from '../../constants/app.constants';
import { calendarEntries, PAYMENT_LABEL } from './calendarEntries';
import { useToday } from '../../hooks/useToday';
import { dateKey, money } from '../../utils/format';
interface CalendarGridProps {
  selectedDate: string;
  onDateSelect: (date: string) => void;
}
/** Display actual and planned transactions in a keyboard-accessible month grid.
 * @param {CalendarGridProps} props - Selection state.
 * @param {string} props.selectedDate - Active calendar date.
 * @param {(date: string) => void} props.onDateSelect - Date selection callback.
 * @returns {JSX.Element} Calendar month. */
export function CalendarGrid({ selectedDate, onDateSelect }: CalendarGridProps) {
  const { data, month } = useWorkspace();
  const today = useToday();
  const first = new Date(`${month}T12:00:00`);
  first.setDate(1);
  const start = new Date(first);
  start.setDate(1 - ((first.getDay() + VALUE.daysPerWeek - 1) % VALUE.daysPerWeek));
  const days = Array.from({ length: VALUE.calendarDays }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return { key: dateKey(day), number: day.getDate(), inMonth: day.getMonth() === first.getMonth() };
  });
  const all = calendarEntries(data, days[0]?.key ?? month, days.at(-1)?.key ?? month, today);
  return (
    <div className="calendar-grid">
      <div className="calendar-weekdays">
        {DAYS.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="calendar-days">
        {days.map((day) => {
          const entries = all.filter((row) => row.entry.date === day.key);
          return (
            <button
              key={day.key}
              className={`calendar-day ${!day.inMonth ? 'outside' : ''} ${day.key === selectedDate ? 'selected' : ''}`}
              onClick={() => onDateSelect(day.key)}
              aria-label={`${day.key}, ${entries.length} transactions`}
              aria-pressed={day.key === selectedDate}
            >
              <span className={day.key === today ? 'today-number' : ''}>{day.number}</span>
              <div className="calendar-events">
                {entries.map(({ entry, status, key, isPaused, isPlanned }) => (
                  <span
                    key={key}
                    className={`calendar-event ${status} ${isPlanned ? 'planned' : ''}`}
                    title={`${entry.name} · ${PAYMENT_LABEL[status]}${isPaused ? ' · Paused' : ''}`}
                    aria-label={`${entry.name}: ${PAYMENT_LABEL[status]}${isPaused ? ', paused' : ''}`}
                  >
                    <span>{entry.name}</span>
                    <b>{money(entry.amount)}</b>
                  </span>
                ))}
              </div>
              <div className="calendar-dots">
                {entries.map(({ key, status }) => (
                  <i
                    key={key}
                    className={status}
                    aria-hidden="true"
                  />
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

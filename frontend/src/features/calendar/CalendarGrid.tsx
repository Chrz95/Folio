import { useWorkspace } from '../../app/WorkspaceContext';
import { DAYS, VALUE } from '../../constants/app.constants';
import { getOccurrences } from '../transactions/recurrence';
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
  const first = new Date(`${month}T12:00:00`);
  first.setDate(1);
  const start = new Date(first);
  start.setDate(1 - ((first.getDay() + VALUE.daysPerWeek - 1) % VALUE.daysPerWeek));
  const days = Array.from({ length: VALUE.calendarDays }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return { key: dateKey(day), number: day.getDate(), inMonth: day.getMonth() === first.getMonth() };
  });
  const occurrences = getOccurrences(data, days[0]?.key ?? month, days.at(-1)?.key ?? month).filter(
    (entry) => !entry.isPaid,
  );
  return (
    <div className="calendar-grid">
      <div className="calendar-weekdays">
        {DAYS.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="calendar-days">
        {days.map((day) => {
          const entries = [
            ...data.transactions.filter((entry) => entry.date === day.key),
            ...occurrences.filter((entry) => entry.date === day.key),
          ];
          return (
            <button
              key={day.key}
              className={`calendar-day ${!day.inMonth ? 'outside' : ''} ${day.key === selectedDate ? 'selected' : ''}`}
              onClick={() => onDateSelect(day.key)}
              aria-label={`${day.key}, ${entries.length} transactions`}
              aria-pressed={day.key === selectedDate}
            >
              <span className={day.key === dateKey() ? 'today-number' : ''}>{day.number}</span>
              <div className="calendar-events">
                {entries.slice(0, VALUE.visibleCalendarEvents).map((entry) => (
                  <span
                    key={`${entry.id}:${entry.date}`}
                    className={`calendar-event ${entry.type} ${'frequency' in entry ? 'planned' : ''}`}
                  >
                    <span>{entry.name}</span>
                    <b>{money(entry.amount)}</b>
                  </span>
                ))}
                {entries.length > VALUE.visibleCalendarEvents && (
                  <small>+{entries.length - VALUE.visibleCalendarEvents} more</small>
                )}
              </div>
              <div className="calendar-dots">
                {entries.slice(0, VALUE.visibleCalendarDots).map((entry) => (
                  <i
                    key={entry.id}
                    className={entry.type}
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

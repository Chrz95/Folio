import { useState } from 'react';
import { VALUE } from '../constants/app.constants';
import { Download } from 'lucide-react';
import { MonthPicker } from '../components/ui/MonthPicker';
import { CalendarGrid } from '../features/calendar/CalendarGrid';
import { DayDetail } from '../features/calendar/DayDetail';
import { dateKey } from '../utils/format';
import { useWorkspace } from '../app/WorkspaceContext';
import { exportCalendar } from '../features/transactions/export';
/** Compose the calendar and agenda; selection never mutates financial data.
 * @returns {JSX.Element} Calendar route. */
export default function CalendarPage() {
  const { data, setMonth } = useWorkspace();
  const [selectedDate, setSelectedDate] = useState(dateKey());
  return (
    <div className="page-content">
      <div className="page-title-row">
        <div>
          <span className="eyebrow">SEE WHAT'S AHEAD</span>
          <h1>
            Make space for what's next<span>.</span>
          </h1>
          <p>Every payment and payday, right where you can see it.</p>
        </div>
        <div className="page-toolbar">
          <button
            className="button secondary"
            onClick={() => exportCalendar(data)}
          >
            <Download size={15} />
            Calendar file
          </button>
          <MonthPicker />
        </div>
      </div>
      <div className="calendar-toolbar">
        <div className="chart-legend">
          <span>
            <i className="small-dot status-unconfirmed" />
            Unconfirmed
          </span>
          <span>
            <i className="small-dot status-overdue" />
            Overdue
          </span>
          <span>
            <i className="small-dot status-confirmed" />
            Confirmed
          </span>
          <span className="muted">Paused schedules stay visible</span>
        </div>
        <button
          className="text-button"
          onClick={() => {
            setSelectedDate(dateKey());
            setMonth(`${dateKey().slice(0, VALUE.monthPrefixLength)}-01`);
          }}
        >
          Back to today
        </button>
      </div>
      <div className="calendar-layout">
        <section className="panel">
          <CalendarGrid
            selectedDate={selectedDate}
            onDateSelect={setSelectedDate}
          />
        </section>
        <DayDetail date={selectedDate} />
      </div>
    </div>
  );
}

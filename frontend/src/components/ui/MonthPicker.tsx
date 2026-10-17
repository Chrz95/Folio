import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { useWorkspace } from '../../app/WorkspaceContext';
import { formatDate, shiftMonth } from '../../utils/format';
/** Change the reporting month without changing transaction data.
 * @returns {JSX.Element} Accessible month navigation. */
export function MonthPicker() {
  const { month, setMonth } = useWorkspace();
  return (
    <div className="month-picker">
      <button
        aria-label="Previous month"
        onClick={() => setMonth(shiftMonth(month, -1))}
      >
        <ChevronLeft size={16} />
      </button>
      <span>
        <CalendarDays size={15} />
        {formatDate(month, { month: 'long', year: 'numeric' })}
      </span>
      <button
        aria-label="Next month"
        onClick={() => setMonth(shiftMonth(month, 1))}
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

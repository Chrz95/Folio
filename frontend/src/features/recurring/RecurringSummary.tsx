import { Repeat2, Bell } from 'lucide-react';
import { useWorkspace } from '../../app/WorkspaceContext';
import { money, dateKey } from '../../utils/format';
import { VALUE } from '../../constants/app.constants';
const WEEKS_PER_YEAR = 52;
/** Keep the active monthly expense rate independent of display sorting and paused planning rows.
 * @returns {JSX.Element} Active recurring expense summary. */
export function RecurringSummary() {
  const { data } = useWorkspace();
  const activeExpenses = data.recurring.filter((entry) => {
    const settings = data.scheduleSettings?.find((control) => control.recurringId === entry.id);
    return (
      entry.type === 'expense' &&
      entry.frequency !== 'once' &&
      !settings?.isPaused &&
      (!settings?.endDate || settings.endDate >= dateKey())
    );
  });
  const monthly = activeExpenses.reduce(
    (total, entry) =>
      total +
      entry.amount *
        (entry.frequency === 'yearly'
          ? 1 / VALUE.monthCount
          : entry.frequency === 'weekly'
            ? WEEKS_PER_YEAR / VALUE.monthCount
            : 1),
    0,
  );
  return (
    <div className="recurring-banner">
      <span className="recurring-banner-icon">
        <Repeat2 size={24} />
      </span>
      <div>
        <span>Active recurring expense rate</span>
        <strong>{money(Math.round(monthly))}</strong>
      </div>
      <p>
        Across {activeExpenses.length} recurring expenses.
        <br />
        Normalized monthly rate. Individual skips are reflected in forecasts.
      </p>
      <Bell
        size={28}
        className="banner-bell"
      />
    </div>
  );
}

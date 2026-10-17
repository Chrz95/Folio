import { Plus, Repeat2, Bell } from 'lucide-react';
import { useWorkspace } from '../app/WorkspaceContext';
import { RecurringCard } from '../features/transactions/RecurringCard';
import { money, dateKey } from '../utils/format';
import { VALUE } from '../constants/app.constants';
const WEEKS_PER_YEAR = 52;
/** Manage recurring rules independently of posted financial history.
 * @returns {JSX.Element} Schedule management route. */
export default function RecurringPage() {
  const { data, setEditor } = useWorkspace();
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
    <div className="page-content">
      <div className="page-title-row">
        <div>
          <span className="eyebrow">A RHYTHM FOR YOUR MONEY</span>
          <h1>
            Set it once. Stay a step ahead<span>.</span>
          </h1>
          <p>Your subscriptions, bills, and paydays, thoughtfully organized.</p>
        </div>
        <button
          className="button primary"
          onClick={() => setEditor({ isRecurring: true })}
        >
          <Plus size={17} />
          Add recurring
        </button>
      </div>
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
      <div className="recurring-grid">
        {data.recurring.map((template) => (
          <RecurringCard
            key={template.id}
            template={template}
          />
        ))}
      </div>
      {!data.recurring.length && (
        <section className="panel empty-state">
          <Repeat2 size={32} />
          <h2>Find your rhythm</h2>
          <p>Add a recurring bill or payday to see it on your calendar.</p>
          <button
            className="button primary"
            onClick={() => setEditor({ isRecurring: true })}
          >
            Create a schedule
          </button>
        </section>
      )}
    </div>
  );
}

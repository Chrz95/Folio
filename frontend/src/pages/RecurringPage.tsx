import { Plus, Repeat2 } from 'lucide-react';
import { useState } from 'react';
import { useWorkspace } from '../app/WorkspaceContext';
import { RecurringCard } from '../features/transactions/RecurringCard';
import { useToday } from '../hooks/useToday';
import { RecurringSummary } from '../features/recurring/RecurringSummary';
import { RecurringTable } from '../features/recurring/RecurringTable';
import { recurringRows, sortRecurringRows } from '../features/recurring/recurringRows';
/** Manage recurring rules in a default table sorted by the nearest unconfirmed date.
 * @returns {JSX.Element} Schedule management route. */
export default function RecurringPage() {
  const { data, setEditor } = useWorkspace();
  const [view, setView] = useState<'table' | 'cards'>('table');
  const today = useToday();
  const rows = recurringRows(data, today);
  const ordered = sortRecurringRows(rows, today, 'proximity', 'ascending');
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
          <Plus size={17} /> Add recurring
        </button>
      </div>
      <RecurringSummary />
      <div className="recurring-view-toolbar">
        <p>Default order: closest unconfirmed date. Overdue dates win ties.</p>
        <fieldset
          className="recurring-view-toggle"
          aria-label="Recurring view"
        >
          <button
            className="button secondary"
            aria-pressed={view === 'table'}
            onClick={() => setView('table')}
          >
            Table
          </button>
          <button
            className="button secondary"
            aria-pressed={view === 'cards'}
            onClick={() => setView('cards')}
          >
            Cards
          </button>
        </fieldset>
      </div>
      {view === 'table' ? (
        <RecurringTable
          rows={rows}
          today={today}
        />
      ) : (
        <div className="recurring-grid">
          {ordered.map((row) => (
            <RecurringCard
              key={row.template.id}
              row={row}
            />
          ))}
        </div>
      )}
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

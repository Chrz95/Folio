import { useState } from 'react';
import { useWorkspace } from '../../app/WorkspaceContext';
import type { RecurringTransaction } from '../../types/budget';
/** Let migrated payments suppress a planned date while the schedule remains paused.
 * @param {object} props - Schedule and optional inclusive ending. @returns {JSX.Element} Reversible skip form. */
export function SkipPlannedDateForm({
  template,
  endDate,
}: {
  template: RecurringTransaction;
  endDate?: string | null;
}) {
  const { save, isSaving } = useWorkspace();
  const [date, setDate] = useState('');
  return (
    <form
      className="planning-form"
      onSubmit={(event) => {
        event.preventDefault();
        void save('skippedOccurrences', 'PUT', { recurringId: template.id, date, isSkipped: true });
      }}
    >
      <label>
        Planned date to skip
        <input
          type="date"
          value={date}
          min={template.date}
          max={endDate ?? undefined}
          required
          disabled={isSaving}
          onChange={(event) => setDate(event.target.value)}
        />
      </label>
      <small>Choose a scheduled date already covered by another recorded payment. Skips can be restored below.</small>
      <button
        className="button secondary"
        disabled={isSaving || !date}
      >
        Skip planned date
      </button>
    </form>
  );
}

import { Pencil } from 'lucide-react';
import { useWorkspace } from '../../app/WorkspaceContext';
import type { RecurringRow } from './recurringRows';
import { OccurrenceActions } from '../schedules/OccurrenceActions';
import { ScheduleControls } from '../schedules/ScheduleControls';
/** Retain edit, explicit confirmation, reversible skips and schedule controls in the table view.
 * @param {object} props - Display data. @param {RecurringRow} props.row - Schedule display row.
 * @returns {JSX.Element} Management controls. */
export function RecurringRowActions({ row }: { row: RecurringRow }) {
  const { setEditor } = useWorkspace();
  return (
    <div className="recurring-row-actions">
      <button
        className="icon-button schedule-action"
        aria-label={`Edit ${row.template.name}`}
        title={`Edit ${row.template.name}`}
        onClick={() => setEditor({ transaction: row.template, isRecurring: true })}
      >
        <Pencil
          size={17}
          aria-hidden="true"
        />
      </button>
      <OccurrenceActions
        occurrence={row.closest}
        isPaused={row.isPaused}
      />
      <ScheduleControls template={row.template} />
    </div>
  );
}

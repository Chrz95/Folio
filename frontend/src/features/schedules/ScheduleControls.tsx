import { useWorkspace } from '../../app/WorkspaceContext';
import type { RecurringTransaction } from '../../types/budget';
import { SkipPlannedDateForm } from './SkipPlannedDateForm';
import { ScheduleSettingsForm } from './ScheduleSettingsForm';
import { formatDate } from '../../utils/format';
interface ControlsProps {
  template: RecurringTransaction;
}
/** Make skips reversible without deleting their recurrence rule or changing posted history.
 * @param {ControlsProps} props - Schedule scope. @param {RecurringTransaction} props.template - Current template.
 * @returns {JSX.Element} Expanded controls and exception history. */
export function ScheduleControls({ template }: ControlsProps) {
  const { data, save, isSaving } = useWorkspace();
  const settings = data.scheduleSettings?.find((entry) => entry.recurringId === template.id);
  const skipped = (data.skippedOccurrences ?? [])
    .filter((entry) => entry.recurringId === template.id)
    .sort((left, right) => left.date.localeCompare(right.date));
  return (
    <details className="schedule-controls">
      <summary>Schedule controls · {skipped.length} skipped</summary>
      <ScheduleSettingsForm
        key={`${settings?.isPaused}:${settings?.endDate}`}
        template={template}
        settings={settings}
      />
      <SkipPlannedDateForm
        template={template}
        endDate={settings?.endDate}
      />
      <p>Changing the start date or frequency clears skipped dates. Recorded payments remain unchanged.</p>
      {skipped.length > 0 && (
        <div className="skipped-dates">
          {skipped.map((entry) => (
            <div key={entry.date}>
              <span>{formatDate(entry.date, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
              <button
                type="button"
                className="text-button"
                disabled={isSaving}
                aria-label={`Restore skipped ${entry.date}`}
                onClick={() => void save('skippedOccurrences', 'PUT', { ...entry, isSkipped: false })}
              >
                Restore
              </button>
            </div>
          ))}
        </div>
      )}
    </details>
  );
}

import { useState } from 'react';
import { useWorkspace } from '../../app/WorkspaceContext';
import type { RecurringTransaction } from '../../types/budget';
import type { ScheduleSettings } from './schedulePolicy';
interface SettingsProps {
  template: RecurringTransaction;
  settings?: ScheduleSettings;
}
/** Save pause and end-date choices as one complete control record.
 * @param {SettingsProps} props - Schedule controls. @param {RecurringTransaction} props.template - Anchor.
 * @param {ScheduleSettings} props.settings - Current controls. @returns {JSX.Element} Settings form. */
export function ScheduleSettingsForm({ template, settings }: SettingsProps) {
  const { save, isSaving } = useWorkspace();
  const [isPaused, setPaused] = useState(settings?.isPaused ?? false);
  const [endDate, setEndDate] = useState(settings?.endDate ?? '');
  return (
    <form
      className="planning-form"
      onSubmit={(event) => {
        event.preventDefault();
        void save('scheduleSettings', 'PUT', { recurringId: template.id, isPaused, endDate: endDate || null });
      }}
    >
      <label className="inline-check">
        <input
          type="checkbox"
          checked={isPaused}
          disabled={isSaving}
          onChange={(event) => setPaused(event.target.checked)}
        />
        Pause this schedule
      </label>
      <label>
        Last allowed payment date
        <input
          type="date"
          min={template.date}
          value={endDate}
          disabled={isSaving}
          onChange={(event) => setEndDate(event.target.value)}
        />
      </label>
      <small>Leave the end date empty for no limit. Resuming brings back unpaid dates, including overdue ones.</small>
      <button
        className="button secondary"
        disabled={isSaving}
      >
        Save schedule controls
      </button>
    </form>
  );
}

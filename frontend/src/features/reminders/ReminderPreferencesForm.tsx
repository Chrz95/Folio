import { timeZoneOptions } from './timeZoneOptions';
import { useState } from 'react';
import { Check } from 'lucide-react';
import type { ReminderPreferences } from '../../types/operations';
import { saveReminderPreferences } from './reminderStateService';
import { REMINDERS } from './reminders.constants';
interface ReminderPreferencesFormProps {
  preferences: ReminderPreferences;
}
/** Save workspace delivery time independently of browser permission.
 * @param {ReminderPreferencesFormProps} props - Initial policy.
 *
 * @param {ReminderPreferences} props.preferences - Saved timezone and cadence.
 * @returns {JSX.Element} Preference form. */
export function ReminderPreferencesForm({ preferences }: ReminderPreferencesFormProps) {
  const [draft, setDraft] = useState(preferences);
  const [message, setMessage] = useState('');
  const [isBusy, setBusy] = useState(false);
  const timeZones = timeZoneOptions(draft.timeZone);
  /** Validate and persist timezone-aware choices. @param {React.FormEvent<HTMLFormElement>} event - Submit.
   * @returns {Promise<void>} Visible saved or error state. */
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await saveReminderPreferences(draft);
      setMessage('Reminder timing saved. Notification permission is unchanged.');
    } catch (failure) {
      setMessage(failure instanceof Error ? failure.message : 'Unable to save reminder timing.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className="reminder-preferences-form"
      onSubmit={(event) => void submit(event)}
    >
      <div className="reminder-preference-grid">
        <label>
          Timezone
          <select
            value={draft.timeZone}
            onChange={(event) => setDraft({ ...draft, timeZone: event.target.value })}
          >
            {timeZones.map((zone) => (
              <option key={zone}>{zone}</option>
            ))}
          </select>
        </label>
        <label>
          Deliver at
          <input
            type="time"
            required
            value={draft.deliveryTime}
            onChange={(event) => setDraft({ ...draft, deliveryTime: event.target.value })}
          />
        </label>
        <label>
          Reminder style
          <select
            value={draft.mode}
            onChange={(event) => setDraft({ ...draft, mode: event.target.value as ReminderPreferences['mode'] })}
          >
            <option value="individual">Individual reminders</option>
            <option value="digest">One daily digest</option>
          </select>
        </label>
        <label>
          Follow up overdue payments for
          <input
            type="number"
            inputMode="numeric"
            min="0"
            max={REMINDERS.maximumOverdue}
            required
            value={draft.overdueDays}
            onChange={(event) => setDraft({ ...draft, overdueDays: Number(event.target.value) })}
          />
          <small>Days after the due date · 0 turns follow-ups off</small>
        </label>
      </div>
      <p>
        Timezone changes follow daylight-saving rules. Reminders are eligible at or after the selected time. Paid items
        are excluded. A daily digest is sent at most once per local day.
      </p>
      <button
        className="button primary"
        disabled={isBusy}
      >
        <Check size={16} />
        {isBusy ? 'Saving…' : 'Save reminder timing'}
      </button>
      {message && <output className="settings-feedback">{message}</output>}
    </form>
  );
}

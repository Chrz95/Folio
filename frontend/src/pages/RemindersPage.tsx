import { Link } from 'react-router-dom';
import { useWorkspace } from '../app/WorkspaceContext';
import { useReminderCenter } from '../features/reminders/useReminderCenter';
import { ReminderPreferencesForm } from '../features/reminders/ReminderPreferencesForm';
import { ReminderOccurrenceList } from '../features/reminders/ReminderOccurrenceList';
import { ReminderDeliveryHistory } from '../features/reminders/ReminderDeliveryHistory';
import { ReminderSettings } from '../features/reminders/ReminderSettings';
/** Bring timing, snoozes, unpaid payments and delivery visibility into one place.
 * @returns {JSX.Element} Reminder center. */
export default function RemindersPage() {
  const { data } = useWorkspace();
  const center = useReminderCenter(data);
  const { preferences } = center.state;
  return (
    <div className="page-content">
      <div className="page-title-row">
        <div>
          <span className="eyebrow">GENTLE NUDGES. CLEARER DAYS.</span>
          <h1>
            The right reminder, at the right time<span>.</span>
          </h1>
          <p>Delivery timing follows {preferences.timeZone}. You stay in control of every payment.</p>
        </div>
        <Link
          className="button secondary"
          to="/recurring"
        >
          Manage schedules
        </Link>
      </div>
      {center.error && (
        <p
          className="error-message"
          role="alert"
        >
          {center.error}
        </p>
      )}
      <div className="reminder-center-layout">
        <div className="reminder-center-main">
          <ReminderOccurrenceList center={center} />
          <ReminderDeliveryHistory center={center} />
        </div>
        <div className="reminder-center-aside">
          <section className="panel settings-panel">
            <h2>Your reminder rhythm</h2>
            <ReminderPreferencesForm
              key={`${preferences.timeZone}:${preferences.deliveryTime}:${preferences.mode}:${preferences.overdueDays}`}
              preferences={preferences}
            />
          </section>
          <ReminderSettings />
        </div>
      </div>
    </div>
  );
}

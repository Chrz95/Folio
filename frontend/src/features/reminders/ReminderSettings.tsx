import { Link } from 'react-router-dom';
import { useWorkspace } from '../../app/WorkspaceContext';
import { exportCalendar } from '../transactions/export';
import { environment } from '../../app/config/environment';
import { useNotificationDevice } from './useNotificationDevice';
import { NotificationDeviceControls } from './NotificationDeviceControls';
import { PhoneNotificationHelp } from './PhoneNotificationHelp';
/** Enroll each browser/phone explicitly and verify the provider connection without exposing financial details.
 * @returns {JSX.Element} Browser and phone notification setup. */
export function ReminderSettings() {
  const { data } = useWorkspace();
  const device = useNotificationDevice();
  return (
    <section className="panel settings-panel">
      <h2>Browser & phone notifications</h2>
      <p>
        {environment.isDemo
          ? 'This preview can notify you while it is open. Background reminders need the self-hosted app.'
          : 'Register each device to receive reminders even when Folio is closed. The server must stay running.'}
      </p>
      <NotificationDeviceControls device={device} />
      <PhoneNotificationHelp />
      <p>Set reminder lead time on each recurring transaction. Paused schedules do not send reminders.</p>
      <Link
        className="text-button"
        to="/reminders"
      >
        Timing, snoozes and delivery history →
      </Link>
      <button
        className="button secondary"
        onClick={() => exportCalendar(data)}
      >
        Export calendar instead
      </button>
    </section>
  );
}

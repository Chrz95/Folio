import { Link } from 'react-router-dom';
import { useState } from 'react';
import { Bell, Download, BellOff } from 'lucide-react';
import { enableReminders, disableReminders } from './notificationService';
import { useWorkspace } from '../../app/WorkspaceContext';
import { exportCalendar } from '../transactions/export';
import { environment } from '../../app/config/environment';
import { APP } from '../../constants/app.constants';
/** Explain reminder delivery honestly and request permission only on user action.
 * @returns {JSX.Element} Opt-in reminder settings. */
export function ReminderSettings() {
  const { data } = useWorkspace();
  const [message, setMessage] = useState('');
  const [isBusy, setBusy] = useState(false);
  const [isEnabled, setEnabled] = useState(localStorage.getItem(APP.notificationsKey) === 'enabled');
  /** Change this browser's subscription and expose unsupported/denied states.
   * @returns {Promise<void>} Updated reminder status. */
  async function toggle() {
    setBusy(true);
    setMessage('');
    try {
      if (isEnabled) {
        await disableReminders();
        setMessage('Reminders are turned off for this browser.');
      } else {
        setMessage(await enableReminders());
      }
      setEnabled(!isEnabled);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to change reminder settings.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel settings-panel">
      <h2>Gentle reminders</h2>
      <p>
        {environment.isDemo
          ? 'Preview reminders work while Folio is open. Import a calendar file for reminders when it is closed.'
          : 'Background reminders need your server running with VAPID keys configured. ' +
            'Choose timezone-aware timing in the reminder center. Delivery is best effort.'}
      </p>
      <p>
        Choose the reminder lead time on each recurring transaction. Calendar export includes the next 12 months;
        re-export after changing a schedule.
      </p>
      <div className="settings-actions">
        <button
          className="button primary"
          disabled={isBusy}
          onClick={() => void toggle()}
        >
          {isEnabled ? <BellOff size={16} /> : <Bell size={16} />}
          {isBusy ? 'Updating…' : isEnabled ? 'Turn off reminders' : 'Enable reminders'}
        </button>
        <button
          className="button secondary"
          onClick={() => exportCalendar(data)}
        >
          <Download size={16} />
          Export calendar
        </button>
      </div>
      <Link
        className="text-button"
        to="/reminders"
      >
        Timing, snoozes and delivery history →
      </Link>
      {message && <output className="settings-feedback">{message}</output>}
    </section>
  );
}

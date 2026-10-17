import { WorkspaceBackup } from '../backup/WorkspaceBackup';
import { REMINDER_STORAGE } from '../reminders/reminders.constants';
import { DeleteAllData } from '../backup/DeleteAllData';
import { RotateCcw } from 'lucide-react';
import { useWorkspace } from '../../app/WorkspaceContext';
import { environment } from '../../app/config/environment';
import { createDemoSeed } from '../transactions/demoSeed.constants';
import { writeDemo } from '../../lib/storage/demoStore';
import { APP } from '../../constants/app.constants';
/** Export, overwrite and explicitly confirm complete data deletion.
 * @returns {JSX.Element} Data management panel. */
export function DataSettings() {
  const { reload, setError, setNotice } = useWorkspace();
  /** Restore only sample preview data after explicit confirmation. @returns {Promise<void>} Durable reset. */
  async function restoreSamples() {
    if (!window.confirm('Replace your preview data with the sample workspace?')) {
      return;
    }
    try {
      writeDemo(createDemoSeed());
      localStorage.removeItem(APP.notificationsKey);
      localStorage.removeItem(REMINDER_STORAGE);
      await reload();
      setNotice('Preview workspace updated.');
    } catch {
      setError('Device storage could not be updated. Check your browser storage settings.');
    }
  }
  return (
    <section className="panel settings-panel">
      <h2>Your data belongs to you</h2>
      <p>
        {environment.isDemo
          ? 'This preview saves financial data in this browser only. There is no cross-device sync. ' +
            'Clearing site data removes it.'
          : 'Your financial data lives in your self-hosted SQLite database. Export a copy whenever you need.'}
      </p>
      <WorkspaceBackup />
      <div className="settings-actions">
        {environment.isDemo && (
          <button
            className="button secondary"
            onClick={() => void restoreSamples()}
          >
            <RotateCcw size={16} />
            Restore samples
          </button>
        )}
        <DeleteAllData />
      </div>
    </section>
  );
}

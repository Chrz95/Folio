import { WorkspaceBackup } from '../backup/WorkspaceBackup';
import { REMINDER_STORAGE } from '../reminders/reminders.constants';
import { RotateCcw, Trash2 } from 'lucide-react';
import { useWorkspace } from '../../app/WorkspaceContext';
import { environment } from '../../app/config/environment';
import { createDemoSeed } from '../transactions/demoSeed.constants';
import { writeDemo } from '../../lib/storage/demoStore';
import { APP } from '../../constants/app.constants';
/** Export portable data and offer explicit preview-data cleanup.
 * @returns {JSX.Element} Data management panel. */
export function DataSettings() {
  const { data, reload, setError, setNotice } = useWorkspace();
  /** Replace only this app's preview dataset after confirmation.
   * @param {boolean} useSamples - Restore samples or create a blank budget.
   * @returns {Promise<void>} Visible success/failure feedback. */
  async function resetDemo(useSamples: boolean) {
    if (
      !window.confirm(
        useSamples
          ? 'Replace your preview data with the sample workspace?'
          : 'Clear all preview transactions, schedules, budgets, goals and custom categories? ' +
              'Account balances will reset to zero.',
      )
    ) {
      return;
    }
    try {
      const next = useSamples
        ? createDemoSeed()
        : {
            transactions: [],
            recurring: [],
            budgets: [],
            accounts: data.accounts.map((account) => ({ ...account, openingBalance: 0 })),
          };
      writeDemo(next);
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
            onClick={() => void resetDemo(true)}
          >
            <RotateCcw size={16} />
            Restore samples
          </button>
        )}
        {environment.isDemo && (
          <button
            className="button secondary negative"
            onClick={() => void resetDemo(false)}
          >
            <Trash2 size={16} />
            Start fresh
          </button>
        )}
      </div>
    </section>
  );
}

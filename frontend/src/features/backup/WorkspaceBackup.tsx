import { useState } from 'react';
import { Download } from 'lucide-react';
import { exportBackup } from './backupService';
import { BackupRestore } from './BackupRestore';
import { downloadFile } from '../transactions/export';
import { environment } from '../../app/config/environment';
/** Export fresh data and supporting files; preview imports never replace a live SQLite database.
 * @returns {JSX.Element} Portable backup controls. */
export function WorkspaceBackup() {
  const [error, setError] = useState('');
  const [isBusy, setBusy] = useState(false);
  return (
    <div className="workspace-backup">
      <button
        type="button"
        className="button secondary"
        disabled={isBusy}
        onClick={() => {
          setBusy(true);
          setError('');
          void exportBackup()
            .then((content) => downloadFile('folio-budget.json', content, 'application/json'))
            .catch((failure: Error) => setError(failure.message))
            .finally(() => setBusy(false));
        }}
      >
        <Download size={16} />
        {isBusy ? 'Preparing backup…' : 'Export workspace'}
      </button>
      {environment.isDemo ? (
        <BackupRestore />
      ) : (
        <p>Exports include receipt bytes. Restore complete SQLite backups using the server recovery steps.</p>
      )}
      {error && (
        <p
          className="error-message"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}

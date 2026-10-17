import { useState } from 'react';
import { Download } from 'lucide-react';
import { exportBackup } from './backupService';
import { BackupRestore } from './BackupRestore';
import { downloadFile } from '../transactions/export';
/** Export fresh recovery data and offer a reviewed financial workspace import.
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
      <BackupRestore />
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

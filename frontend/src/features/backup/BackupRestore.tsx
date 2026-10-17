import { useBackupRestore } from './useBackupRestore';
import { environment } from '../../app/config/environment';
import { WorkspaceImportReview } from './WorkspaceImportReview';
/** Import a Folio JSON workspace on either the preview or self-hosted server through an explicit review.
 * @returns {JSX.Element} Source selection, validation and confirmation. */
export function BackupRestore() {
  const state = useBackupRestore();
  return (
    <div className="backup-restore">
      <label>
        Import workspace data
        <input
          type="file"
          accept="application/json,.json"
          disabled={state.isBusy}
          onChange={(event) => {
            void state.choose(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
      </label>
      <p>Choose a Folio workspace JSON export. Export your current workspace above for a recovery copy first.</p>
      <p>
        {environment.isDemo
          ? 'Preview limit: 8 MiB JSON and 2 MiB of receipt files, saved in this browser.'
          : 'Server limit: 16 MiB JSON and 8 MiB of receipt files, saved atomically in SQLite.'}
      </p>
      <p>Accounts, postings, schedules, budgets, goals, reconciliation history and receipts are included.</p>
      {state.isBusy && <output className="settings-feedback">Preparing or saving the workspace import…</output>}
      <WorkspaceImportReview state={state} />
      {state.error && (
        <p
          className="error-message"
          role="alert"
        >
          {state.error}
        </p>
      )}
    </div>
  );
}

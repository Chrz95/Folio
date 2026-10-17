import { useBackupRestore } from './useBackupRestore';
import { useWorkspace } from '../../app/WorkspaceContext';
/** Explain the replacement and counts before allowing a preview restore.
 * @returns {JSX.Element} File selection, validation and review. */
export function BackupRestore() {
  const state = useBackupRestore();
  const { data } = useWorkspace();
  return (
    <div className="backup-restore">
      <label>
        Review a preview backup
        <input
          type="file"
          accept="application/json,.json"
          disabled={state.isBusy}
          onChange={(event) => void state.choose(event.target.files?.[0])}
        />
      </label>
      <p>
        Import supports Folio JSON exports up to 8 MiB and 2 MiB of receipts. It replaces this device's financial
        workspace. Notification settings, delivery history and appearance stay as they are.
      </p>
      {state.reviewed && (
        <div className="backup-review">
          <h3>Review replacement</h3>
          <dl>
            <dt>Accounts</dt>
            <dd>
              {data.accounts.length} → {state.reviewed.accounts.length}
            </dd>
            <dt>Transactions</dt>
            <dd>
              {data.transactions.length} → {state.reviewed.transactions.length}
            </dd>
            <dt>Schedules</dt>
            <dd>
              {data.recurring.length} → {state.reviewed.recurring.length}
            </dd>
            <dt>Savings goals</dt>
            <dd>
              {data.goals?.length ?? 0} → {state.reviewed.goals.length}
            </dd>
            <dt>Category limits in backup</dt>
            <dd>{state.reviewed.budgets.length}</dd>
            <dt>Month overrides in backup</dt>
            <dd>{state.reviewed.monthlyBudgets.length}</dd>
            <dt>Custom categories in backup</dt>
            <dd>{state.reviewed.customCategories.length}</dd>
            <dt>Reconciled statements in backup</dt>
            <dd>{state.reviewed.reconciliations.length}</dd>
            <dt>Schedule controls in backup</dt>
            <dd>{state.reviewed.scheduleSettings.length}</dd>
            <dt>Skipped dates in backup</dt>
            <dd>{state.reviewed.skippedOccurrences.length}</dd>
            <dt>Receipts in backup</dt>
            <dd>{state.reviewed.receipts.length}</dd>
          </dl>
          <p>
            Export the current workspace first if you want a recovery copy. Existing financial entries will be replaced.
          </p>
          <div className="settings-actions">
            <button
              className="button primary"
              type="button"
              disabled={state.isBusy}
              onClick={() => void state.restore()}
            >
              Replace preview workspace
            </button>
            <button
              className="button secondary"
              type="button"
              disabled={state.isBusy}
              onClick={state.cancel}
            >
              Cancel restore
            </button>
          </div>
        </div>
      )}
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

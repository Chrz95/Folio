import type { WorkspaceImporter } from './useBackupRestore';
/** Review every affected collection and explicitly confirm a replacement.
 * @param {WorkspaceImporter} state - Current importer. @returns {JSX.Element | null} Review controls. */
export function WorkspaceImportReview({ state }: { state: WorkspaceImporter }) {
  if (!state.reviewed) {
    return null;
  }
  return (
    <div className="backup-review">
      <h3>Review workspace replacement</h3>
      <p>This replaces existing financial data, including receipts and reconciliations.</p>
      <dl>
        {state.reviewed.review.counts.map((row) => (
          <div key={row.key}>
            <dt>{row.key.replace(/([A-Z])/g, ' $1')}</dt>
            <dd>
              {row.before} → {row.after}
            </dd>
          </div>
        ))}
      </dl>
      <p>All imported schedules will be paused. Resume them individually after reviewing dates and reminder timing.</p>
      <p>
        Device subscriptions, notification preferences, delivery history and appearance are retained. Server snoozes
        tied to the old schedules are cleared.
      </p>
      <label className="workspace-import-consent">
        <input
          type="checkbox"
          checked={state.acknowledged}
          disabled={state.isBusy}
          onChange={(event) => state.setAcknowledged(event.target.checked)}
        />
        I understand this replaces the current financial workspace.
      </label>
      <div className="settings-actions">
        <button
          className="button primary"
          type="button"
          disabled={state.isBusy || !state.acknowledged}
          onClick={() => void state.restore()}
        >
          Replace workspace
        </button>
        <button
          className="button secondary"
          type="button"
          disabled={state.isBusy}
          onClick={state.cancel}
        >
          Cancel import
        </button>
      </div>
    </div>
  );
}

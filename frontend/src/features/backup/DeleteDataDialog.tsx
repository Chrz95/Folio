import { useEffect, useRef } from 'react';
import type { DeleteDataState } from './useDeleteData';
import { BACKUP } from './backup.constants';
/** Require visible consent plus the exact word DELETE in a focus-trapped modal.
 * @param {object} props - Dialog state. @param {DeleteDataState} props.state - Reviewed deletion.
 * @returns {JSX.Element} Destructive confirmation. */
export function DeleteDataDialog({ state }: { state: DeleteDataState }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="editor-dialog"
      aria-labelledby="delete-data-title"
      onCancel={(event) => {
        event.preventDefault();
        state.cancel();
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void state.remove();
        }}
      >
        <header className="editor-header">
          <h2 id="delete-data-title">Delete all app data?</h2>
        </header>
        <div className="editor-body">
          <p>
            This permanently deletes every account, transaction, schedule, budget, goal, receipt and reconciliation. App
            preferences, registered notification devices and delivery history are also deleted.
          </p>
          <p>Export a recovery copy before continuing. Browser notification permission is managed by your browser.</p>
          {state.busy === 'review' && <output>Preparing deletion review…</output>}
          {state.review && (
            <p>{state.review.counts.reduce((total, row) => total + row.before, 0)} stored records to delete.</p>
          )}
          {state.error && (
            <p
              role="alert"
              className="error-message"
            >
              {state.error}
            </p>
          )}
          <label className="workspace-import-consent">
            <input
              type="checkbox"
              checked={state.acknowledged}
              disabled={Boolean(state.busy) || !state.review}
              onChange={(event) => state.setAcknowledged(event.target.checked)}
            />
            I understand that deleting all app data cannot be undone.
          </label>
          <label>
            Type DELETE to confirm
            <input
              value={state.word}
              autoComplete="off"
              spellCheck={false}
              disabled={Boolean(state.busy) || !state.review}
              onChange={(event) => state.setWord(event.target.value)}
            />
          </label>
          {!state.review && !state.busy && (
            <button
              type="button"
              className="button secondary"
              onClick={() => void state.prepare()}
            >
              Refresh deletion review
            </button>
          )}
        </div>
        <footer className="editor-footer">
          <button
            type="button"
            className="button secondary"
            disabled={state.busy === 'delete'}
            onClick={state.cancel}
          >
            Cancel
          </button>
          <button
            className="button danger"
            disabled={Boolean(state.busy) || !state.review || !state.acknowledged || state.word !== BACKUP.deleteWord}
          >
            {state.busy === 'delete' ? 'Deleting…' : 'Delete all data permanently'}
          </button>
        </footer>
      </form>
    </dialog>
  );
}

import { useWorkspace } from '../../app/WorkspaceContext';
import { useReceipts } from './useReceipts';
import { ReceiptList } from './ReceiptList';
import { environment } from '../../app/config/environment';
interface AttachmentsProps {
  transactionId: string;
}
/** Attach bounded files to an existing posting without changing its financial fields.
 * @param {AttachmentsProps} props - Posting scope. @param {string} props.transactionId - Saved transaction UUID.
 * @returns {JSX.Element} Receipt upload and download controls. */
export function ReceiptAttachments({ transactionId }: AttachmentsProps) {
  const { data, isSaving } = useWorkspace();
  const state = useReceipts(transactionId);
  const locked =
    data.clearances?.some((entry) => entry.transactionId === transactionId && entry.reconciliationId) ?? false;
  return (
    <section
      className="receipt-attachments"
      aria-label="Supporting documents"
    >
      <h3>Receipts &amp; documents</h3>
      <p>
        PNG, JPEG or PDF; up to 512 KiB each and 5 files per transaction. Attachments save immediately.
        {environment.isDemo ? ' This preview stores up to 2 MiB on this device.' : ' Workspace limit: 8 MiB.'}
      </p>
      <ReceiptList
        state={state}
        locked={locked || isSaving}
      />
      {!state.entries.length && !state.isBusy && <p>No attachments yet.</p>}
      {locked ? (
        <p>Attachments are locked with this statement. Downloads remain available.</p>
      ) : (
        <div className="receipt-upload">
          <label>
            Choose receipt
            <input
              key={state.fileKey}
              type="file"
              accept="image/png,image/jpeg,application/pdf"
              disabled={state.isBusy || isSaving}
              onChange={(event) => void state.choose(event.target.files?.[0])}
            />
          </label>
          <button
            type="button"
            className="button secondary"
            disabled={state.isBusy || isSaving || !state.pending}
            onClick={() => void state.upload()}
          >
            {state.isBusy ? 'Working…' : 'Attach file'}
          </button>
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
    </section>
  );
}

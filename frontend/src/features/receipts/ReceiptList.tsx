import type { ReceiptState } from './useReceipts';
interface ListProps {
  state: ReceiptState;
  locked: boolean;
}
/** Keep downloads available on reconciled entries while protecting changes.
 * @param {ListProps} props - Receipt controls. @param {ReceiptState} props.state - File list and actions.
 * @param {boolean} props.locked - Statement lock. @returns {JSX.Element} Supporting file list. */
export function ReceiptList({ state, locked }: ListProps) {
  return (
    <ul className="receipt-list">
      {state.entries.map((entry) => (
        <li key={entry.id}>
          <span>
            {entry.name}
            <small>{entry.size} bytes</small>
          </span>
          <button
            className="text-button"
            type="button"
            disabled={state.isBusy}
            onClick={() => void state.download(entry.id)}
          >
            Download
          </button>
          <button
            className="text-button negative"
            type="button"
            disabled={state.isBusy || locked}
            aria-label={`Remove ${entry.name}`}
            onClick={() => void state.remove(entry.id)}
          >
            Remove
          </button>
        </li>
      ))}
    </ul>
  );
}

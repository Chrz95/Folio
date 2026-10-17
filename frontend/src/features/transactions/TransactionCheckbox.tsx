import { useWorkspace } from '../../app/WorkspaceContext';
import type { Transaction } from '../../types/budget';
import { BULK } from '../bulk/bulk.constants';
export interface TransactionSelection {
  ids: Set<string>;
  isBusy: boolean;
  toggle: (id: string) => void;
}
interface Props {
  entry: Transaction;
  selection: TransactionSelection;
}
/** Expose a row selection control while protecting reconciled history and the batch limit.
 * @param {Props} props - Row selection. @param {Transaction} props.entry - Actual posting.
 * @param {TransactionSelection} props.selection - Bounded state. @returns {JSX.Element} Accessible checkbox. */
export function TransactionCheckbox({ entry, selection }: Props) {
  const { data } = useWorkspace();
  const locked = data.clearances?.some((item) => item.transactionId === entry.id && item.reconciliationId);
  return (
    <label className="transaction-check-target">
      <input
        type="checkbox"
        className="transaction-checkbox"
        checked={selection.ids.has(entry.id)}
        aria-label={`Select ${entry.name} on ${entry.date}`}
        title={
          locked ? 'Reconciled entry: undo its statement reconciliation before changing it.' : 'Select transaction'
        }
        disabled={
          selection.isBusy ||
          Boolean(locked) ||
          (!selection.ids.has(entry.id) && selection.ids.size >= BULK.maximumRows)
        }
        onChange={() => selection.toggle(entry.id)}
      />
    </label>
  );
}

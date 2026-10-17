import { Repeat2 } from 'lucide-react';
import { useWorkspace } from '../../app/WorkspaceContext';
import type { Transaction } from '../../types/budget';
import { CategoryIcon } from '../../components/ui/CategoryIcon';
interface Props {
  entry: Transaction;
  isDisabled?: boolean;
}
/** Open a single actual posting while identifying protected statement history.
 * @param {Props} props - Ledger row. @param {Transaction} props.entry - Actual posting.
 * @param {boolean} props.isDisabled - Pending batch guard.
 * @returns {JSX.Element} Keyboard-accessible transaction details. */
export function TransactionName({ entry, isDisabled }: Props) {
  const { data, setEditor } = useWorkspace();
  const locked = data.clearances?.some((item) => item.transactionId === entry.id && item.reconciliationId);
  return (
    <button
      className="transaction-name"
      disabled={isDisabled}
      onClick={() => setEditor({ transaction: entry, isRecurring: false })}
    >
      <CategoryIcon category={entry.category} />
      <span>
        <strong>{entry.name}</strong>
        <small>
          {locked && 'Reconciled · '}
          {entry.type === 'transfer'
            ? 'Transfer between accounts'
            : entry.notes || (entry.recurringId ? 'Recurring transaction' : 'One-time transaction')}
        </small>
      </span>
      {entry.recurringId && (
        <Repeat2
          size={13}
          className="muted"
        />
      )}
    </button>
  );
}

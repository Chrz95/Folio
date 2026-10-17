import type { Transaction } from '../../types/budget';
import { TransactionTable } from '../transactions/TransactionTable';
import { BulkToolbar } from './BulkToolbar';
import { BulkReview } from './BulkReview';
import { useBulkTransactions } from './useBulkTransactions';
interface Props {
  transactions: Transaction[];
}
/** Bind bulk actions to one filtered view so filter navigation clears hidden selections.
 * @param {Props} props - Ledger view. @param {Transaction[]} props.transactions - Visible actual rows.
 * @returns {JSX.Element} Reviewable multi-select ledger. */
export function BulkTransactions({ transactions }: Props) {
  const workflow = useBulkTransactions(transactions);
  return (
    <div>
      <BulkToolbar workflow={workflow} />
      {workflow.error && (
        <p
          className="error-message"
          role="alert"
        >
          {workflow.error}
        </p>
      )}
      {workflow.plan && <BulkReview workflow={workflow} />}
      <TransactionTable
        transactions={transactions}
        selection={workflow}
      />
    </div>
  );
}

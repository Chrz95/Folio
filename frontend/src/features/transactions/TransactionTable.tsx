import { ArrowUpRight } from 'lucide-react';
import { useWorkspace } from '../../app/WorkspaceContext';
import type { Transaction } from '../../types/budget';
import { money, formatDate } from '../../utils/format';
import { TransactionName } from './TransactionName';
import { TransactionCheckbox } from './TransactionCheckbox';
import type { TransactionSelection } from './TransactionCheckbox';
interface TransactionTableProps {
  transactions: Transaction[];
  selection?: TransactionSelection;
}
/** Render keyboard-editable ledger rows and a useful empty state.
 * @param {TransactionTableProps} props - Ledger configuration.
 * @param {Transaction[]} props.transactions - Ordered filtered postings.
 * @param {TransactionSelection} props.selection - Optional bulk controls.
 * @returns {JSX.Element} Transaction table. */
export function TransactionTable({ transactions, selection }: TransactionTableProps) {
  const { data, setEditor } = useWorkspace();
  if (!transactions.length) {
    return (
      <div className="empty-state">
        <ArrowUpRight size={28} />
        <h3>A clean slate</h3>
        <p>No transactions match this view. Add one to get started.</p>
        <button
          className="button secondary"
          onClick={() => setEditor({ isRecurring: false })}
        >
          Add transaction
        </button>
      </div>
    );
  }
  return (
    <div className="table-scroll">
      <table className="transaction-table">
        <thead>
          <tr>
            <th>Transaction</th>
            <th>Category</th>
            <th>Account</th>
            <th>Date</th>
            <th className="amount-cell">Amount</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((entry) => (
            <tr key={entry.id}>
              <td>
                <div className="ledger-row-content">
                  {selection && (
                    <TransactionCheckbox
                      entry={entry}
                      selection={selection}
                    />
                  )}
                  <TransactionName
                    entry={entry}
                    isDisabled={selection?.isBusy}
                  />
                </div>
              </td>
              <td>
                <span className="category-pill">{entry.category}</span>
              </td>
              <td className="muted">
                {data.accounts.find((account) => account.id === entry.accountId)?.name ?? 'Account'}
              </td>
              <td className="muted date-cell">{formatDate(entry.date)}</td>
              <td className={`amount-cell ${entry.type === 'income' ? 'positive' : ''}`}>
                {entry.type === 'income' ? '+' : entry.type === 'expense' ? '−' : ''}
                {money(entry.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

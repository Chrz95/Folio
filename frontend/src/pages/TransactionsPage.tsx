import { TransactionFilters } from '../features/transactions/TransactionFilters';
import { StatementActions } from '../features/statements/StatementActions';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useWorkspace } from '../app/WorkspaceContext';
import { MonthPicker } from '../components/ui/MonthPicker';
import { BulkTransactions } from '../features/bulk/BulkTransactions';
import { monthTransactions, statistics } from '../features/overview/statistics';
import { money } from '../utils/format';
import { accountBalance } from '../features/overview/statistics';
import { AccountActions } from '../features/accounts/AccountActions';
/** Filter and export the selected month's actual ledger.
 * @returns {JSX.Element} Transaction management route. */
export default function TransactionsPage() {
  const { data, month } = useWorkspace();
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [parameters, setParameters] = useSearchParams();
  const accountId = parameters.get('account') ?? '';
  const category = parameters.get('category') ?? '';
  const account = data.accounts.find((entry) => entry.id === accountId);
  const balance = account ? accountBalance(data, account.id) : 0;
  /** Update one bookmarkable scope without discarding the other. @param {string} key - Query key.
   * @param {string} value - Selection. @returns {void} New query parameters. */
  function changeScope(key: string, value: string) {
    const next = new URLSearchParams(parameters);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    setParameters(next);
  }
  const transactions = monthTransactions(data, month)
    .filter(
      (entry) =>
        `${entry.name} ${entry.category} ${entry.notes}`.toLowerCase().includes(search.toLowerCase()) &&
        (type === 'all' || entry.type === type) &&
        (!category || entry.category === category) &&
        (!accountId || entry.accountId === accountId || entry.destinationAccountId === accountId),
    )
    .sort((first, second) => second.date.localeCompare(first.date));
  const totals = statistics(transactions);
  return (
    <div className="page-content">
      <div className="page-title-row">
        <div>
          <span className="eyebrow">THE EVERYDAY DETAILS</span>
          <h1>
            Every transaction, in view<span>.</span>
          </h1>
          <p>A home for everything coming in and going out.</p>
        </div>
        <MonthPicker />
      </div>
      {account ? (
        <section
          className="panel account-overview"
          aria-label={`${account.name} account`}
        >
          <div>
            <h2>{account.name}</h2>
            <span className="muted">Current balance</span>
            <strong className={balance < 0 ? 'negative' : ''}>{money(balance)}</strong>
          </div>
          <AccountActions
            key={account.id}
            accountId={account.id}
          />
        </section>
      ) : (
        <AccountActions />
      )}
      <div className="ledger-totals">
        <span>{transactions.length} transactions</span>
        <span>
          Income <strong className="positive">{money(totals.income)}</strong>
        </span>
        <span>
          Expenses <strong>{money(totals.expenses)}</strong>
        </span>
      </div>
      <StatementActions />
      <section className="panel">
        <TransactionFilters
          search={search}
          onSearchChange={setSearch}
          type={type}
          onTypeChange={setType}
          accountId={accountId}
          onAccountChange={(value) => changeScope('account', value)}
          category={category}
          onCategoryChange={(value) => changeScope('category', value)}
          transactions={transactions}
        />
        <BulkTransactions
          key={JSON.stringify([month, search, type, accountId, category])}
          transactions={transactions}
        />
      </section>
    </div>
  );
}

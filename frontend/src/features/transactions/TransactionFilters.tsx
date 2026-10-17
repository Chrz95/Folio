import { Search, Download, SlidersHorizontal } from 'lucide-react';
import { LedgerScopeFilters } from './LedgerScopeFilters';
import { exportTransactions } from './export';
import type { Transaction } from '../../types/budget';
interface TransactionFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  type: string;
  onTypeChange: (value: string) => void;
  category: string;
  onCategoryChange: (value: string) => void;
  accountId: string;
  onAccountChange: (value: string) => void;
  transactions: Transaction[];
}
/** Filter the ledger and export exactly the visible selection.
 * @param {TransactionFiltersProps} props - Filters.
 * @param {string} props.search - Search text.
 * @param {(value: string) => void} props.onSearchChange - Text action.
 * @param {string} props.type - Selected kind.
 * @param {(value: string) => void} props.onTypeChange - Kind action.
 * @param {string} props.category - Exact category filter.
 * @param {(value: string) => void} props.onCategoryChange - Category action.
 * @param {string} props.accountId - Selected account.
 * @param {(value: string) => void} props.onAccountChange - Account action.
 * @param {Transaction[]} props.transactions - Filtered rows. @returns {JSX.Element} Filter controls. */
export function TransactionFilters({
  search,
  onSearchChange,
  type,
  onTypeChange,
  category,
  onCategoryChange,
  accountId,
  onAccountChange,
  transactions,
}: TransactionFiltersProps) {
  return (
    <div className="filter-bar">
      <label className="search-field">
        <Search size={17} />
        <input
          aria-label="Search transactions"
          placeholder="Search transactions…"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </label>
      <label className="filter-select">
        <SlidersHorizontal size={15} />
        <select
          aria-label="Transaction type"
          value={type}
          onChange={(event) => onTypeChange(event.target.value)}
        >
          <option value="all">All types</option>
          <option value="expense">Expenses</option>
          <option value="income">Income</option>
          <option value="transfer">Transfers</option>
        </select>
      </label>
      <LedgerScopeFilters
        accountId={accountId}
        onAccountChange={onAccountChange}
        category={category}
        onCategoryChange={onCategoryChange}
      />
      <button
        className="button secondary"
        onClick={() => exportTransactions(transactions)}
      >
        <Download size={15} />
        Export CSV
      </button>
    </div>
  );
}

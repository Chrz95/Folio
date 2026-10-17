import { useWorkspace } from '../../app/WorkspaceContext';
import { categoryNames, isCategoryArchived } from '../planning/catalog';
interface ScopeProps {
  accountId: string;
  onAccountChange: (value: string) => void;
  category: string;
  onCategoryChange: (value: string) => void;
}
/** Keep historical categories searchable even when they are unavailable for new transactions.
 * @param {ScopeProps} props - Ledger scope. @param {string} props.accountId - Account UUID.
 * @param {(value: string) => void} props.onAccountChange - Account selection.
 * @param {string} props.category - Exact category name.
 * @param {(value: string) => void} props.onCategoryChange - Category selection.
 * @returns {JSX.Element} Accessible account and category selectors. */
export function LedgerScopeFilters({ accountId, onAccountChange, category, onCategoryChange }: ScopeProps) {
  const { data } = useWorkspace();
  const categories = [...new Set([...categoryNames(data), ...data.transactions.map((entry) => entry.category)])].sort();
  return (
    <div className="ledger-scope-filters">
      <select
        aria-label="Account filter"
        value={accountId}
        onChange={(event) => onAccountChange(event.target.value)}
      >
        <option value="">All accounts</option>
        {data.accounts.map((account) => (
          <option
            key={account.id}
            value={account.id}
          >
            {account.name}
          </option>
        ))}
        {accountId && !data.accounts.some((account) => account.id === accountId) && (
          <option value={accountId}>Unavailable account</option>
        )}
      </select>
      <select
        aria-label="Category filter"
        value={category}
        onChange={(event) => onCategoryChange(event.target.value)}
      >
        <option value="">All categories</option>
        {categories.map((name) => (
          <option
            key={name}
            value={name}
          >
            {name}
            {isCategoryArchived(data, name) ? ' (archived)' : ''}
          </option>
        ))}
        {category && !categories.includes(category) && <option value={category}>{category} (unavailable)</option>}
      </select>
    </div>
  );
}

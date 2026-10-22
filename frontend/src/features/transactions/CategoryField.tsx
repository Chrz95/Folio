import type { TransactionFormState } from './useTransactionForm';
import { InlineCategory } from './InlineCategory';
/** Offer existing categories and create reusable names in the same editor.
 * @param {object} props - Editor values. @param {TransactionFormState} props.form - Draft and suggestions.
 * @returns {JSX.Element} Category selector and inline creation. */
export function CategoryField({ form }: { form: TransactionFormState }) {
  const { entry } = form;
  return (
    <div className="category-field">
      <label>
        Category
        <select
          name="category"
          value={entry.category}
          onChange={(event) => entry.changeCategory(event.target.value)}
          required
        >
          {entry.categories.map((name) => (
            <option
              key={name}
              value={name}
            >
              {name}
              {entry.isArchived(name) ? ' (archived)' : ''}
            </option>
          ))}
        </select>
      </label>
      <InlineCategory onCreated={entry.changeCategory} />
    </div>
  );
}

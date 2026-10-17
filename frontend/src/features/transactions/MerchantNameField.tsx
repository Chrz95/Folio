import type { TransactionFormState } from './useTransactionForm';
interface MerchantProps {
  form: TransactionFormState;
}
/** Offer recent merchant names while retaining a fully editable native text field.
 * @param {MerchantProps} props - Editor state. @param {TransactionFormState} props.form - Entry suggestions.
 * @returns {JSX.Element} Accessible merchant input with native suggestions. */
export function MerchantNameField({ form }: MerchantProps) {
  return (
    <label>
      Transaction name
      <input
        name="name"
        list="recent-merchants"
        placeholder={form.type === 'income' ? 'e.g. Monthly salary' : 'e.g. Weekly groceries'}
        value={form.entry.name}
        onChange={(event) => form.entry.changeName(event.target.value)}
        required
        maxLength={100}
        autoComplete="off"
      />
      <datalist id="recent-merchants">
        {form.entry.suggestions.map((name) => (
          <option
            key={name}
            value={name}
            aria-label={name}
          />
        ))}
      </datalist>
    </label>
  );
}

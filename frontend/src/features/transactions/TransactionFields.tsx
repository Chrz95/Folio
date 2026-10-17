import { MerchantNameField } from './MerchantNameField';
import { AccountOptions } from './AccountOptions';
import type { TransactionFormState } from './useTransactionForm';
import { VALUE } from '../../constants/app.constants';
interface TransactionFieldsProps {
  form: TransactionFormState;
}
/** Render native labelled fields for money, dates, and category.
 * @param {TransactionFieldsProps} props - Editor state.
 * @param {TransactionFormState} props.form - Current values and type.
 * @returns {JSX.Element} Core transaction fields. */
export function TransactionFields({ form }: TransactionFieldsProps) {
  const { defaults, date, type, entry } = form;
  return (
    <div className="transaction-fields">
      <MerchantNameField form={form} />
      <div className="form-two-columns">
        <label>
          Amount (€)
          <input
            name="amount"
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            max={VALUE.maximumMoney / VALUE.cents}
            required
            placeholder="0.00"
            defaultValue={defaults ? defaults.amount / VALUE.cents : undefined}
          />
        </label>
        <label>
          {form.isRecurring ? 'First payment date' : 'Date'}
          <input
            name="date"
            type="date"
            defaultValue={date}
            required
          />
        </label>
      </div>
      <div className="form-two-columns">
        <label>
          From account
          <select
            name="accountId"
            value={entry.accountId}
            onChange={(event) => entry.changeAccount(event.target.value)}
            required
          >
            <AccountOptions accounts={form.accounts} />
          </select>
        </label>
        {type === 'transfer' ? (
          <label>
            To account
            <select
              name="destinationAccountId"
              defaultValue={defaults?.destinationAccountId ?? form.accounts[1]?.id}
              required
            >
              <AccountOptions accounts={form.accounts} />
            </select>
          </label>
        ) : (
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
        )}
      </div>
    </div>
  );
}

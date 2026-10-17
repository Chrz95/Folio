import { useState } from 'react';
import { Plus, Landmark } from 'lucide-react';
import { useWorkspace } from '../../app/WorkspaceContext';
import { accountBalance } from '../overview/statistics';
import { money } from '../../utils/format';
import { VALUE } from '../../constants/app.constants';
/** Add real manual accounts with opening balances and show their current balances.
 * @returns {JSX.Element} Account management panel. */
export function AccountsSettings() {
  const { data, save, isSaving } = useWorkspace();
  const [name, setName] = useState('');
  const [balance, setBalance] = useState('0');
  return (
    <section className="panel settings-panel">
      <h2>Your accounts</h2>
      <p>Manual accounts keep you in control. All amounts are in euros.</p>
      {data.accounts.map((account) => (
        <div
          className="settings-account"
          key={account.id}
        >
          <Landmark size={18} />
          <span>{account.name}</span>
          <strong>{money(accountBalance(data, account.id))}</strong>
        </div>
      ))}
      <form
        className="account-form"
        onSubmit={(event) => {
          event.preventDefault();
          void save('accounts', 'POST', {
            name: name.trim(),
            openingBalance: Math.round(Number(balance) * VALUE.cents),
          }).then((success) => {
            if (success) {
              setName('');
              setBalance('0');
            }
          });
        }}
      >
        <label>
          Account name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={100}
            placeholder="e.g. Savings account"
          />
        </label>
        <label>
          Opening balance (€)
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            max={VALUE.maximumMoney / VALUE.cents}
            min={-VALUE.maximumMoney / VALUE.cents}
            value={balance}
            onChange={(event) => setBalance(event.target.value)}
            required
          />
        </label>
        <button
          className="button primary"
          disabled={isSaving}
        >
          <Plus size={16} />
          Add account
        </button>
      </form>
    </section>
  );
}

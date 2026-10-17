import { Check, Scale } from 'lucide-react';
import type { ReconciliationState } from './useReconciliation';
import { money } from '../../utils/format';
interface ReconciliationControlsProps {
  statement: ReconciliationState;
}
/** Require exact agreement with a real statement, without an automatic adjustment.
 * @param {ReconciliationControlsProps} props - Comparison state.
 * @param {ReconciliationState} props.statement - Balances and handlers. @returns {JSX.Element} Statement form. */
export function ReconciliationControls({ statement }: ReconciliationControlsProps) {
  return (
    <section className="panel reconciliation-controls">
      <div className="reconciliation-inputs">
        <label>
          Account
          <select
            value={statement.accountId}
            disabled={statement.isBusy}
            onChange={(event) => statement.setAccountId(event.target.value)}
          >
            {statement.data.accounts.map((account) => (
              <option
                key={account.id}
                value={account.id}
              >
                {account.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Statement ending date
          <input
            type="date"
            value={statement.date}
            disabled={statement.isBusy}
            onChange={(event) => statement.setDate(event.target.value)}
            required
          />
        </label>
        <label>
          Statement ending balance (€)
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={statement.statement}
            disabled={statement.isBusy}
            onChange={(event) => statement.setStatement(event.target.value)}
            placeholder="Enter your bank's balance"
            required
          />
        </label>
      </div>
      <div className="reconciliation-comparison">
        <Scale size={24} />
        <span>
          Cleared balance<strong>{money(statement.clearedBalance)}</strong>
        </span>
        <span>
          Difference
          <strong className={statement.statement && statement.difference !== 0 ? 'negative' : 'positive'}>
            {statement.statement ? money(statement.difference) : '—'}
          </strong>
        </span>
        <button
          className="button primary"
          disabled={
            statement.isBusy ||
            !statement.account ||
            !statement.date ||
            !statement.statement ||
            statement.difference !== 0
          }
          onClick={() => void statement.complete()}
        >
          <Check size={16} />
          Reconcile statement
        </button>
      </div>
      <p className="import-footnote">
        Opening balance plus cleared entries through the ending date must equal your bank statement. Clear each visible
        bank movement below. No adjustment is added automatically.
      </p>
    </section>
  );
}

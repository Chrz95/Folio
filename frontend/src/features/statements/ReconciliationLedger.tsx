import { LockKeyhole } from 'lucide-react';
import type { ReconciliationState } from './useReconciliation';
import { accountDelta } from './importMatching';
import { money, formatDate } from '../../utils/format';
interface ReconciliationLedgerProps {
  statement: ReconciliationState;
}
/** Clear transfers independently for this account and expose completed-statement locks.
 * @param {ReconciliationLedgerProps} props - Account statement.
 * @param {ReconciliationState} props.statement - Rows, flags and actions. @returns {JSX.Element} Account ledger. */
export function ReconciliationLedger({ statement }: ReconciliationLedgerProps) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Match the movements on your statement</h2>
          <p>
            {statement.rows.length} recorded entries through {formatDate(statement.date)}. Imported rows are already
            cleared.
          </p>
        </div>
      </div>
      <div className="review-table-scroll">
        <table className="statement-table">
          <thead>
            <tr>
              <th>Cleared</th>
              <th>Date</th>
              <th>Transaction</th>
              <th className="amount-cell">Account movement</th>
            </tr>
          </thead>
          <tbody>
            {statement.rows.map((entry) => {
              const clearance = statement.clearances.find((item) => item.transactionId === entry.id);
              const delta = accountDelta(entry, statement.accountId);
              return (
                <tr key={entry.id}>
                  <td>
                    <label className="clearance-checkbox">
                      <input
                        aria-label={`Clear ${entry.name} ${entry.id}`}
                        type="checkbox"
                        checked={Boolean(clearance)}
                        disabled={statement.isBusy || Boolean(clearance?.reconciliationId)}
                        onChange={(event) => void statement.clear(entry.id, event.target.checked)}
                      />
                      {clearance?.reconciliationId && (
                        <LockKeyhole
                          size={14}
                          aria-label="Reconciled entry"
                        />
                      )}
                    </label>
                  </td>
                  <td>{formatDate(entry.date)}</td>
                  <td>
                    <strong>{entry.name}</strong>
                    <small>{entry.type === 'transfer' ? 'Transfer · this account only' : entry.category}</small>
                  </td>
                  <td className={`amount-cell ${delta > 0 ? 'positive' : ''}`}>
                    {delta > 0 ? '+' : '−'}
                    {money(Math.abs(delta))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!statement.rows.length && (
          <div className="empty-state">
            <p>No account movements through this date. Your opening balance still applies.</p>
          </div>
        )}
      </div>
    </section>
  );
}

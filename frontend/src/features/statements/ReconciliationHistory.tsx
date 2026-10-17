import { Undo2, CheckCheck } from 'lucide-react';
import type { ReconciliationState } from './useReconciliation';
import { money, formatDate } from '../../utils/format';
interface ReconciliationHistoryProps {
  statement: ReconciliationState;
}
/** Keep a visible statement history and allow only a chronological undo.
 * @param {ReconciliationHistoryProps} props - History.
 *
 * @param {ReconciliationState} props.statement - Account's completed statements.
 * @returns {JSX.Element} Audit history. */
export function ReconciliationHistory({ statement }: ReconciliationHistoryProps) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>A record you can trust</h2>
          <p>Undo the latest statement before correcting protected entries.</p>
        </div>
      </div>
      {statement.history.map((entry) => (
        <div
          className="statement-history-entry"
          key={entry.id}
        >
          <CheckCheck size={19} />
          <span>
            <strong>
              Statement through {formatDate(entry.date, { month: 'long', day: 'numeric', year: 'numeric' })}
            </strong>
            <small>
              {money(entry.statementBalance)} · reconciled {new Date(entry.createdAt).toLocaleString()}
            </small>
          </span>
          {statement.history[0]?.id === entry.id && (
            <button
              className="button secondary"
              disabled={statement.isBusy}
              onClick={() => void statement.undo(entry.id)}
            >
              <Undo2 size={15} />
              Undo latest
            </button>
          )}
        </div>
      ))}
      {!statement.history.length && (
        <div className="empty-state">
          <p>No reconciled statements for this account yet.</p>
        </div>
      )}
    </section>
  );
}

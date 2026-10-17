import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useWorkspace } from '../../app/WorkspaceContext';
import { accountDelta } from './importMatching';
import { setStatementClearance, reconcileStatement, undoStatement } from './statementsService';
import { dateKey } from '../../utils/format';
import { VALUE } from '../../constants/app.constants';
/** Compare an external statement against cleared account legs, never inventing balancing transactions.
 * @returns {object} Statement controls and exact differences. */
export function useReconciliation() {
  const { data, reload } = useWorkspace();
  const [parameters] = useSearchParams();
  const [accountId, setAccountId] = useState(parameters.get('account') ?? data.accounts[0]?.id ?? '');
  const [date, setDate] = useState(dateKey());
  const [statement, setStatement] = useState('');
  const [isBusy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const account = data.accounts.find((entry) => entry.id === accountId);
  const clearances = (data.clearances ?? []).filter((entry) => entry.accountId === accountId);
  const history = (data.reconciliations ?? [])
    .filter((entry) => entry.accountId === accountId)
    .sort((first, second) => second.date.localeCompare(first.date));
  const rows = data.transactions
    .filter((entry) => entry.date <= date && accountDelta(entry, accountId) !== 0)
    .sort((first, second) => second.date.localeCompare(first.date) || first.id.localeCompare(second.id));
  const clearedBalance = rows
    .filter((entry) => clearances.some((clearance) => clearance.transactionId === entry.id))
    .reduce((total, entry) => total + accountDelta(entry, accountId), account?.openingBalance ?? 0);
  const statementBalance = Math.round(Number(statement) * VALUE.cents);
  const difference = statementBalance - clearedBalance;
  /** Run a statement action and keep errors visible without changing the comparison inputs.
   * @param {() => Promise<void>} operation - Persistence action. @param {string} message - Success feedback.
   * @returns {Promise<void>} Reloads authoritative metadata. */
  async function perform(operation: () => Promise<void>, message: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await operation();
      await reload();
      setNotice(message);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to update this statement.');
    } finally {
      setBusy(false);
    }
  }
  /** Toggle one account leg. @param {string} id - Posting. @param {boolean} checked - New cleared flag.
   * @returns {Promise<void>} Saves clearing state. */
  function clear(id: string, checked: boolean) {
    return perform(() => setStatementClearance(accountId, id, checked), 'Cleared state updated.');
  }
  /** Commit a matching statement. @returns {Promise<void>} Creates an audit snapshot. */
  function complete() {
    return perform(
      () => reconcileStatement(accountId, date, statementBalance),
      'Statement reconciled. Your cleared entries are protected.',
    );
  }
  /** Confirm release of the latest statement's locks.
   * @param {string} id - Statement ID.
   * @returns {Promise<void>} Undo. */
  async function undo(id: string) {
    if (window.confirm('Undo this reconciliation? Its transactions stay cleared and become editable again.')) {
      await perform(() => undoStatement(id), 'Reconciliation undone. Cleared flags were preserved.');
    }
  }
  return {
    data,
    accountId,
    setAccountId,
    date,
    setDate,
    statement,
    setStatement,
    isBusy,
    error,
    notice,
    account,
    clearances,
    history,
    rows,
    clearedBalance,
    difference,
    clear,
    complete,
    undo,
  };
}
export type ReconciliationState = ReturnType<typeof useReconciliation>;

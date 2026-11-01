import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowRightLeft, X } from 'lucide-react';
import { useWorkspace } from '../../app/WorkspaceContext';
import { VALUE } from '../../constants/app.constants';
import { dateKey, money } from '../../utils/format';
import { accountBalance } from '../overview/statistics';
import { transferInput } from './transfer';
import type { TransferDraft } from './transfer';
import { mutateBudget } from '../transactions/budgetService';

export interface TransferDialogProps {
  accountId?: string;
  destinationAccountId?: string;
  amount?: number;
  isRepayment?: boolean;
  onClose: () => void;
}

/** Review and save a transfer without changing opening balances or creating expense/income pairs.
 * @param {TransferDialogProps} props - Initial accounts, cents and close action.
 * @returns {JSX.Element} Accessible transfer form with live balance previews. */
export function TransferDialog({ accountId, destinationAccountId, amount, isRepayment, onClose }: TransferDialogProps) {
  const { data, reload, setNotice, isSaving } = useWorkspace();
  const dialog = useRef<HTMLDialogElement>(null);
  const submitting = useRef(false);
  const titleId = useId();
  const [draft, setDraft] = useState<TransferDraft>(() => {
    const source = accountId ?? data.accounts.find((account) => account.id !== destinationAccountId)?.id ?? '';
    return {
      accountId: source,
      destinationAccountId: destinationAccountId ?? data.accounts.find((account) => account.id !== source)?.id ?? '',
      amount: amount === undefined ? '' : (amount / VALUE.cents).toFixed(2),
      date: dateKey(),
      notes: '',
    };
  });
  const [error, setError] = useState('');
  const [isSubmitting, setSubmitting] = useState(false);
  const [isRecorded, setRecorded] = useState(false);
  const busy = isSaving || isSubmitting;
  const locked = busy || isRecorded;
  const source = data.accounts.find((account) => account.id === draft.accountId);
  const destination = data.accounts.find((account) => account.id === draft.destinationAccountId);
  const cents = Math.round(Number(draft.amount) * VALUE.cents);
  const hasAmount = Number.isSafeInteger(cents) && cents > 0 && cents <= VALUE.maximumMoney;
  const sourceBalance = source ? accountBalance(data, source.id) : 0;
  const destinationBalance = destination ? accountBalance(data, destination.id) : 0;
  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  /** Save once and retain the form when persistence fails.
   * @param {FormEvent<HTMLFormElement>} event - Native submit. @returns {Promise<void>} Durable save result. */
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || isSaving || isRecorded) {
      return;
    }
    setError('');
    let committed = false;
    try {
      const input = transferInput(data, draft);
      submitting.current = true;
      setSubmitting(true);
      await mutateBudget('transactions', 'POST', input);
      committed = true;
      setRecorded(true);
      setNotice('Transfer recorded. Both account balances have been updated.');
      await reload();
      onClose();
    } catch (failure) {
      setError(
        committed
          ? 'Transfer saved, but balances could not refresh. Reload the page before recording another transfer.'
          : failure instanceof Error
            ? failure.message
            : 'Unable to save this transfer.',
      );
    } finally {
      submitting.current = false;
      setSubmitting(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="editor-dialog transfer-dialog"
      aria-labelledby={titleId}
      aria-busy={busy}
      onCancel={(event) => {
        if (busy) {
          event.preventDefault();
        } else {
          onClose();
        }
      }}
    >
      <form onSubmit={(event) => void submit(event)}>
        <header className="editor-header">
          <div>
            <span className="eyebrow">BETWEEN YOUR ACCOUNTS</span>
            <h2 id={titleId}>{isRepayment ? 'Pay negative balance' : 'Transfer money'}</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close transfer"
            disabled={busy}
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </header>
        <div className="editor-body transaction-fields">
          <p className="transfer-explanation">
            {isRepayment
              ? 'The negative balance is filled in. Choose the paying account and review the amount.'
              : 'Record a transfer between your accounts. Transfers do not count as income or spending.'}
          </p>
          <div className="form-two-columns">
            <label>
              From account
              <select
                required
                value={draft.accountId}
                disabled={locked}
                onChange={(event) => setDraft({ ...draft, accountId: event.target.value })}
              >
                <option
                  value=""
                  disabled
                >
                  Choose an account
                </option>
                {data.accounts
                  .filter((account) => account.id !== draft.destinationAccountId)
                  .map((account) => (
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
              To account
              <select
                required
                value={draft.destinationAccountId}
                disabled={locked}
                onChange={(event) => setDraft({ ...draft, destinationAccountId: event.target.value })}
              >
                <option
                  value=""
                  disabled
                >
                  Choose an account
                </option>
                {data.accounts
                  .filter((account) => account.id !== draft.accountId)
                  .map((account) => (
                    <option
                      key={account.id}
                      value={account.id}
                    >
                      {account.name}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <button
            type="button"
            className="text-button transfer-swap"
            disabled={locked}
            onClick={() =>
              setDraft({ ...draft, accountId: draft.destinationAccountId, destinationAccountId: draft.accountId })
            }
          >
            <ArrowRightLeft size={15} />
            Swap accounts
          </button>
          <div className="form-two-columns">
            <label>
              Amount (€)
              <input
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                max={VALUE.maximumMoney / VALUE.cents}
                required
                disabled={locked}
                value={draft.amount}
                onChange={(event) => setDraft({ ...draft, amount: event.target.value })}
              />
            </label>
            <label>
              Date
              <input
                type="date"
                required
                max={dateKey()}
                disabled={locked}
                value={draft.date}
                onChange={(event) => setDraft({ ...draft, date: event.target.value })}
              />
            </label>
          </div>
          <label>
            Notes (optional)
            <textarea
              maxLength={1000}
              rows={2}
              disabled={locked}
              value={draft.notes}
              onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
            />
          </label>
          {source && destination && !isRecorded && (
            <section
              className="transfer-preview"
              aria-label="Balance preview"
              aria-live="polite"
            >
              <h3>Current balances after transfer</h3>
              <dl>
                <div>
                  <dt>{source.name}</dt>
                  <dd className={sourceBalance - (hasAmount ? cents : 0) < 0 ? 'negative' : ''}>
                    {money(sourceBalance)} → {money(sourceBalance - (hasAmount ? cents : 0))}
                  </dd>
                </div>
                <div>
                  <dt>{destination.name}</dt>
                  <dd className={destinationBalance + (hasAmount ? cents : 0) < 0 ? 'negative' : ''}>
                    {money(destinationBalance)} → {money(destinationBalance + (hasAmount ? cents : 0))}
                  </dd>
                </div>
              </dl>
              {hasAmount && sourceBalance < cents && (
                <p>This transfer would leave {source.name} with a negative balance.</p>
              )}
            </section>
          )}
          {error && (
            <p
              className="error-message"
              role="alert"
            >
              {error}
            </p>
          )}
        </div>
        <footer className="editor-footer">
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={onClose}
          >
            {isRecorded ? 'Close' : 'Cancel'}
          </button>
          <button
            className="button primary"
            disabled={locked || data.accounts.length < 2}
          >
            <ArrowRightLeft size={16} />
            {busy ? 'Saving…' : 'Confirm transfer'}
          </button>
        </footer>
      </form>
    </dialog>
  );
}

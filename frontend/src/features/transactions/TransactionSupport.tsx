import type { TransactionFormState } from './useTransactionForm';
import { ReceiptAttachments } from '../receipts/ReceiptAttachments';
interface SupportProps {
  form: TransactionFormState;
}
/** Keep notes editable and files attached only to saved actual postings.
 * @param {SupportProps} props - Editor state. @param {TransactionFormState} props.form - Original and draft values.
 * @returns {JSX.Element} Supporting details. */
export function TransactionSupport({ form }: SupportProps) {
  return (
    <div className="transaction-support">
      <label>
        Notes <span className="muted">(optional)</span>
        <textarea
          name="notes"
          rows={2}
          maxLength={1000}
          defaultValue={form.defaults?.notes}
          placeholder="Anything you'd like to remember…"
        />
      </label>
      {!form.isRecurring &&
        (form.original ? (
          <ReceiptAttachments transactionId={form.original.id} />
        ) : (
          <p className="planning-detail">
            Save this transaction, then open it to attach receipts. Duplicates start without attachments.
          </p>
        ))}
    </div>
  );
}

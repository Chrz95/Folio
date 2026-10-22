import { useWorkspace } from '../../app/WorkspaceContext';
import type { TransactionFormState } from './useTransactionForm';
import { environment } from '../../app/config/environment';
/** Offer explicit per-schedule consent rather than silently posting imported or existing rules.
 * @param {object} props - Editor state. @param {TransactionFormState} props.form - Draft schedule.
 * @returns {JSX.Element | null} Automatic confirmation checkbox and its scope. */
export function AutomaticConfirmationField({ form }: { form: TransactionFormState }) {
  const { isSaving } = useWorkspace();
  if (!form.isRecurring) {
    return null;
  }
  return (
    <div className="automatic-confirmation-field">
      <label className="inline-check">
        <input
          type="checkbox"
          disabled={isSaving}
          checked={form.autoConfirm}
          onChange={(event) => form.setAutoConfirm(event.target.checked)}
        />
        Confirm automatically on the due date
      </label>
      <small className="field-hint">
        Starts today in your reminder timezone; older overdue dates stay manual. Paused, skipped and ended dates are not
        confirmed.{' '}
        {environment.isDemo
          ? 'This preview processes dates while open and catches up when reopened.'
          : 'Your running backend checks every minute, even when the app is closed.'}
      </small>
    </div>
  );
}

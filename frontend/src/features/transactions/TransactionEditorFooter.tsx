import { Trash2, Check, LoaderCircle, Copy } from 'lucide-react';
import { useWorkspace } from '../../app/WorkspaceContext';
import type { TransactionFormState } from './useTransactionForm';
interface FooterProps {
  form: TransactionFormState;
}
/** Keep save and destructive actions visible while the mobile form scrolls.
 * @param {FooterProps} props - Form actions.
 * @param {TransactionFormState} props.form - Current editor state.
 * @returns {JSX.Element} Sticky action bar. */
export function TransactionEditorFooter({ form }: FooterProps) {
  const { setEditor, isSaving } = useWorkspace();
  return (
    <footer className="editor-footer">
      {form.original && (
        <button
          type="button"
          className="icon-button delete-button"
          aria-label="Delete transaction"
          disabled={isSaving}
          onClick={() => void form.handleDelete()}
        >
          <Trash2 size={18} />
        </button>
      )}
      {form.original && !form.isRecurring && (
        <button
          type="button"
          className="button secondary duplicate-button"
          disabled={isSaving}
          onClick={() => setEditor({ transaction: form.original, isRecurring: false, isDuplicate: true })}
        >
          <Copy size={16} />
          Duplicate transaction
        </button>
      )}
      <button
        type="button"
        className="button secondary"
        disabled={isSaving}
        onClick={() => setEditor(null)}
      >
        Cancel
      </button>
      <button
        className="button primary"
        disabled={isSaving || !form.accounts.length}
      >
        {isSaving ? (
          <LoaderCircle
            size={16}
            className="spin"
          />
        ) : (
          <Check size={16} />
        )}
        {isSaving ? 'Saving…' : form.original ? 'Save changes' : 'Add transaction'}
      </button>
    </footer>
  );
}

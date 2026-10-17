import { TransactionSupport } from './TransactionSupport';
import { TransactionEditorFooter } from './TransactionEditorFooter';
import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { EditorState, TransactionType } from '../../types/budget';
import { useWorkspace } from '../../app/WorkspaceContext';
import { useTransactionForm } from './useTransactionForm';
import { TransactionFields } from './TransactionFields';
import { RecurringDates } from './RecurringDates';
import { RecurrenceFields } from './RecurrenceFields';
interface TransactionEditorProps {
  editor: EditorState;
}
/** Present a focus-trapped native modal with durable submit and visible validation errors.
 * @param {TransactionEditorProps} props - Selected editor.
 * @param {EditorState} props.editor - Posting or schedule to edit.
 * @returns {JSX.Element} Transaction editor dialog. */
export function TransactionEditor({ editor }: TransactionEditorProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { setEditor, isSaving, error: serverError } = useWorkspace();
  const form = useTransactionForm(editor);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="editor-dialog"
      aria-labelledby="editor-title"
      onCancel={(event) => {
        if (isSaving) {
          event.preventDefault();
        } else {
          setEditor(null);
        }
      }}
    >
      <form onSubmit={(event) => void form.handleSubmit(event)}>
        <header className="editor-header">
          <div>
            <span className="eyebrow">A LITTLE MORE IN BALANCE</span>
            <h2 id="editor-title">
              {form.original ? 'Edit' : 'Add'} {form.isRecurring ? 'recurring transaction' : 'transaction'}
            </h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close transaction editor"
            disabled={isSaving}
            onClick={() => setEditor(null)}
          >
            <X size={19} />
          </button>
        </header>
        <div className="editor-body">
          <fieldset
            className="type-selector"
            aria-label="Transaction type"
          >
            {(['expense', 'income', 'transfer'] as TransactionType[]).map((type) => (
              <button
                key={type}
                type="button"
                aria-pressed={form.type === type}
                className={form.type === type ? 'active' : ''}
                onClick={() => form.setType(type)}
              >
                {type}
              </button>
            ))}
          </fieldset>
          {!form.accounts.length && (
            <p className="error-message">Create an account in Settings before adding a transaction.</p>
          )}
          <TransactionFields form={form} />
          <RecurrenceFields form={form} />
          <RecurringDates form={form} />
          <TransactionSupport form={form} />
          {(form.error || serverError) && (
            <p
              className="error-message"
              role="alert"
            >
              {form.error || serverError}
            </p>
          )}
        </div>
        <TransactionEditorFooter form={form} />
      </form>
    </dialog>
  );
}

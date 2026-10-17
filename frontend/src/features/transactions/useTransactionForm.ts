import { categoryNames } from '../planning/catalog';
import { useEntrySuggestions } from './useEntrySuggestions';
import { useState } from 'react';
import type { FormEvent } from 'react';
import type { EditorState, TransactionType, Frequency } from '../../types/budget';
import { useWorkspace } from '../../app/WorkspaceContext';
import { dateKey } from '../../utils/format';
import { VALUE } from '../../constants/app.constants';
/** Prepare editor state and validate money and account selection before persistence.
 * @param {EditorState} editor - Selected posting or recurring rule.
 * @returns {object} Form state and actions. */
export function useTransactionForm(editor: EditorState) {
  const { save, setEditor, data } = useWorkspace();
  const defaults = editor.transaction;
  const original = editor.isDuplicate ? undefined : defaults;
  const [type, setType] = useState<TransactionType>(defaults?.type ?? 'expense');
  const [isRecurring, setRecurring] = useState(editor.isRecurring);
  const [frequency, setFrequency] = useState<Frequency>(
    original && 'frequency' in original ? original.frequency : 'monthly',
  );
  const [error, setError] = useState('');
  const entry = useEntrySuggestions(data, defaults, type);
  /** Change kind without overriding an explicit category. @param {TransactionType} next - Kind.
   * @returns {void} State. */
  function changeType(next: TransactionType) {
    setType(next);
    entry.changeType(next);
  }
  /** Validate the completed form and await a durable save before closing.
   * @param {FormEvent<HTMLFormElement>} event - Native form submission.
   * @returns {Promise<void>} Save outcome is reflected in shared feedback. */
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setError('');
    const amount = Math.round(Number(fields.get('amount')) * VALUE.cents);
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > VALUE.maximumMoney) {
      setError('Enter a positive amount with no more than two decimal places.');
      return;
    }
    const accountId = String(fields.get('accountId'));
    const destinationAccountId = type === 'transfer' ? String(fields.get('destinationAccountId')) : null;
    if (type === 'transfer' && accountId === destinationAccountId) {
      setError('Choose two different accounts.');
      return;
    }
    const isPlannedOneTime = !isRecurring && String(fields.get('date')) > dateKey();
    if (isPlannedOneTime && original) {
      setError('To move a recorded payment into the future, create a new planned transaction.');
      return;
    }
    const shouldSchedule = isRecurring || isPlannedOneTime;
    const value = {
      name: String(fields.get('name')).trim(),
      amount,
      type,
      category: type === 'transfer' ? 'Savings' : String(fields.get('category')),
      accountId,
      destinationAccountId,
      date: String(fields.get('date')),
      notes: String(fields.get('notes')).trim(),
      ...(shouldSchedule
        ? {
            frequency: isPlannedOneTime ? 'once' : frequency,
            reminderDays: isPlannedOneTime ? VALUE.defaultReminder : Number(fields.get('reminderDays')),
          }
        : {}),
    };
    if (!categoryNames(data, original?.category).includes(value.category)) {
      setError('This category is archived. Choose an active category or restore it in Settings.');
      return;
    }
    if (!value.name) {
      setError('Give this transaction a name.');
      return;
    }
    if (await save(shouldSchedule ? 'recurring' : 'transactions', original ? 'PUT' : 'POST', value, original?.id)) {
      setEditor(null);
    }
  }
  /** Delete an item only after an explicit destructive-action confirmation.
   * @returns {Promise<void>} Closes the editor after successful deletion. */
  async function handleDelete() {
    if (
      !original ||
      !window.confirm(
        isRecurring
          ? 'Delete this recurring schedule? Recorded payments will remain.'
          : 'Delete this transaction? This will update your balance.',
      )
    ) {
      return;
    }
    if (await save(isRecurring ? 'recurring' : 'transactions', 'DELETE', undefined, original.id)) {
      setEditor(null);
    }
  }
  return {
    type,
    setType: changeType,
    defaults,
    entry,
    isRecurring,
    setRecurring,
    frequency,
    setFrequency,
    error,
    handleSubmit,
    handleDelete,
    original,
    date: original?.date ?? editor.date ?? dateKey(),
    accounts: data.accounts,
  };
}
export type TransactionFormState = ReturnType<typeof useTransactionForm>;

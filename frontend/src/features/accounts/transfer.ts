import type { BudgetData, TransactionInput } from '../../types/budget';
import { VALUE } from '../../constants/app.constants';
import { dateKey } from '../../utils/format';

export interface TransferDraft {
  accountId: string;
  destinationAccountId: string;
  amount: string;
  date: string;
  notes: string;
}

/** Validate a transfer before creating its single, two-account ledger record.
 * @param {BudgetData} data - Current workspace. @param {TransferDraft} draft - Reviewed form.
 * @returns {TransactionInput} Posting in integer cents. */
export function transferInput(data: BudgetData, draft: TransferDraft): TransactionInput {
  const source = data.accounts.find((account) => account.id === draft.accountId);
  const destination = data.accounts.find((account) => account.id === draft.destinationAccountId);
  if (!source || !destination) {
    throw new Error('Choose an existing source and destination account.');
  }
  if (source.id === destination.id) {
    throw new Error('Choose two different accounts.');
  }
  const amount = Math.round(Number(draft.amount) * VALUE.cents);
  if (
    !/^\d+(?:\.\d{1,2})?$/.test(draft.amount) ||
    !Number.isSafeInteger(amount) ||
    amount <= 0 ||
    amount > VALUE.maximumMoney
  ) {
    throw new Error('Enter a positive amount with no more than two decimal places.');
  }
  const parsedDate = new Date(`${draft.date}T12:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(draft.date) ||
    !Number.isFinite(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== draft.date ||
    draft.date > dateKey()
  ) {
    throw new Error('Choose today or an earlier date for a recorded transfer.');
  }
  return {
    name: `Transfer to ${destination.name}`.slice(0, 100),
    amount,
    type: 'transfer',
    category: 'Savings',
    accountId: source.id,
    destinationAccountId: destination.id,
    date: draft.date,
    notes: draft.notes.trim(),
  };
}

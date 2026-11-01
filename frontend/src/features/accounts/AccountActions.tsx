import { useState } from 'react';
import { ArrowRightLeft, Wallet } from 'lucide-react';
import { useWorkspace } from '../../app/WorkspaceContext';
import { accountBalance } from '../overview/statistics';
import { TransferDialog } from './TransferDialog';
import type { TransferDialogProps } from './TransferDialog';

interface AccountActionsProps {
  accountId?: string;
  repaymentOnly?: boolean;
}

/** Offer general transfers and a prefilled payment only for an account in debt.
 * @param {AccountActionsProps} props - Optional account scope and compact settings mode.
 * @returns {JSX.Element | null} Transfer entry points and their modal. */
export function AccountActions({ accountId, repaymentOnly = false }: AccountActionsProps) {
  const { data, isSaving } = useWorkspace();
  const [transfer, setTransfer] = useState<Omit<TransferDialogProps, 'onClose'> | null>(null);
  const account = data.accounts.find((entry) => entry.id === accountId);
  const balance = account ? accountBalance(data, account.id) : 0;
  const needsPayment = balance < 0;
  const needsAccount = data.accounts.length < 2;
  if (repaymentOnly && !needsPayment) {
    return null;
  }
  return (
    <div className="account-actions">
      {!repaymentOnly && (
        <button
          type="button"
          className="button secondary"
          disabled={isSaving || needsAccount}
          onClick={() => setTransfer({ accountId: account?.id })}
        >
          <ArrowRightLeft size={16} />
          Transfer money
        </button>
      )}
      {account && needsPayment && (
        <button
          type="button"
          className="button primary"
          aria-label={`Pay negative balance for ${account.name}`}
          disabled={isSaving || needsAccount}
          onClick={() => setTransfer({ destinationAccountId: account.id, amount: -balance, isRepayment: true })}
        >
          <Wallet size={16} />
          Pay negative balance
        </button>
      )}
      {needsAccount && <small>Add another account in Settings to transfer money.</small>}
      {transfer && (
        <TransferDialog
          {...transfer}
          onClose={() => setTransfer(null)}
        />
      )}
    </div>
  );
}

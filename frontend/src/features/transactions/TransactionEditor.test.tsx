// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TransactionEditor } from './TransactionEditor';
import { dateKey } from '../../utils/format';
const workspace = vi.hoisted(() => ({
  data: {
    accounts: [
      { id: '11111111-1111-4111-8111-111111111111', name: 'Everyday', openingBalance: 0 },
      { id: '22222222-2222-4222-8222-222222222222', name: 'Savings', openingBalance: 0 },
    ],
  },
  save: vi.fn().mockResolvedValue(true),
  setEditor: vi.fn(),
  isSaving: false,
  error: '',
}));
vi.mock('../../app/WorkspaceContext', () => ({ useWorkspace: () => workspace }));
beforeEach(() => {
  workspace.save.mockClear();
  workspace.setEditor.mockClear();
  /** Model the native dialog's open state in the DOM test environment. */
  HTMLDialogElement.prototype.showModal = vi.fn(function showModal(this: HTMLDialogElement) {
    this.open = true;
  });
});
afterEach(cleanup);
/** Complete the shared native form without bypassing its transaction logic.
 * @param {string} date - Desired local date.
 * @returns {void} Populates visible fields. */
function completeForm(date: string = dateKey()) {
  fireEvent.change(screen.getByLabelText('Transaction name'), { target: { value: 'Market groceries' } });
  fireEvent.change(screen.getByLabelText('Amount (€)'), { target: { value: '12.50' } });
  fireEvent.change(screen.getByLabelText('Date'), { target: { value: date } });
}
/** Submit the editor using its native form element.
 * @returns {void} Dispatches a submit event. */
function submit() {
  const form = screen.getByRole('button', { name: 'Add transaction' }).closest('form');
  if (!form) {
    throw new Error('Missing editor form');
  }
  fireEvent.submit(form);
}
describe('transaction editor interactions', () => {
  it('saves an expense in integer cents and closes only after success', async () => {
    render(<TransactionEditor editor={{ isRecurring: false }} />);
    completeForm();
    submit();
    await waitFor(() =>
      expect(workspace.save).toHaveBeenCalledWith(
        'transactions',
        'POST',
        expect.objectContaining({
          name: 'Market groceries',
          amount: 1250,
          type: 'expense',
          destinationAccountId: null,
        }),
        undefined,
      ),
    );
    expect(workspace.setEditor).toHaveBeenCalledWith(null);
  });
  it('keeps a future one-time payment planned with its own reminder', async () => {
    render(<TransactionEditor editor={{ isRecurring: false }} />);
    completeForm('2099-10-20');
    submit();
    await waitFor(() =>
      expect(workspace.save).toHaveBeenCalledWith(
        'recurring',
        'POST',
        expect.objectContaining({
          frequency: 'once',
          reminderDays: 2,
          date: '2099-10-20',
        }),
        undefined,
      ),
    );
  });
  it('refuses transfers to the same account without issuing a write', async () => {
    render(<TransactionEditor editor={{ isRecurring: false }} />);
    completeForm();
    fireEvent.click(screen.getByRole('button', { name: 'transfer' }));
    fireEvent.change(screen.getByLabelText('To account'), { target: { value: workspace.data.accounts[0]?.id } });
    submit();
    expect(await screen.findByRole('alert')).toHaveTextContent('Choose two different accounts.');
    expect(workspace.save).not.toHaveBeenCalled();
  });
  it('preserves an open form after an unsuccessful save', async () => {
    workspace.save.mockResolvedValueOnce(false);
    render(<TransactionEditor editor={{ isRecurring: false }} />);
    completeForm();
    submit();
    await waitFor(() => expect(workspace.save).toHaveBeenCalledOnce());
    expect(workspace.setEditor).not.toHaveBeenCalled();
  });
});

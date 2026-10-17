// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TransactionEditor } from './TransactionEditor';
import type { BudgetData, RecurringTransaction } from '../../types/budget';
import { dateKey } from '../../utils/format';
const workspace = vi.hoisted(() => ({
  data: {
    recurring: [],
    transactions: [],
    budgets: [],
    accounts: [
      { id: '11111111-1111-4111-8111-111111111111', name: 'Everyday', openingBalance: 0 },
      { id: '22222222-2222-4222-8222-222222222222', name: 'Savings', openingBalance: 0 },
    ],
  } as BudgetData,
  save: vi.fn().mockResolvedValue(true),
  setEditor: vi.fn(),
  isSaving: false,
  error: '',
}));
vi.mock('../../app/WorkspaceContext', () => ({ useWorkspace: () => workspace }));
beforeEach(() => {
  workspace.data.recurring = [];
  workspace.data.transactions = [];
  workspace.data.scheduleSettings = [];
  workspace.data.skippedOccurrences = [];
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

/** Build a fictional imported monthly rule. @returns {RecurringTransaction} Original anchor and amount. */
function monthlyRule(): RecurringTransaction {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Monthly bill',
    amount: 2000,
    date: '2026-10-03',
    frequency: 'monthly',
    reminderDays: 0,
    accountId: workspace.data.accounts[0]!.id,
    destinationAccountId: null,
    category: 'Housing',
    notes: '',
    type: 'expense',
  };
}
/** Submit an existing schedule's visible save control. @returns {void} Native form submission. */
function saveSchedule() {
  fireEvent.submit(screen.getByRole('button', { name: 'Save changes' }).closest('form')!);
}
describe('editable recurring due dates and preview', () => {
  it('shows imported next due rather than the old anchor and saves an unchanged anchor without reposting', async () => {
    const template = monthlyRule();
    workspace.data.recurring = [template];
    workspace.data.skippedOccurrences = [{ recurringId: template.id, date: '2026-10-03' }];
    workspace.data.scheduleSettings = [{ recurringId: template.id, isPaused: true, endDate: '2027-01-03' }];
    render(<TransactionEditor editor={{ isRecurring: true, transaction: template }} />);
    expect(screen.getByLabelText('Due date')).toHaveValue('2026-11-03');
    expect(screen.getByLabelText('Due date')).toBeEnabled();
    expect(Array.from(document.querySelectorAll('time')).map((node) => node.dateTime)).toEqual([
      '2026-11-03',
      '2026-12-03',
      '2027-01-03',
    ]);
    expect(screen.getByText(/Paused · dates remain visible/)).toBeInTheDocument();
    saveSchedule();
    await waitFor(() =>
      expect(workspace.save).toHaveBeenCalledWith(
        'recurring',
        'PUT',
        expect.objectContaining({ date: '2026-10-03', frequency: 'monthly' }),
        template.id,
      ),
    );
    expect(workspace.save).toHaveBeenCalledTimes(1);
  });
  it('updates monthly and weekly draft dates immediately and persists the edited due date', async () => {
    const template = monthlyRule();
    workspace.data.recurring = [template];
    workspace.data.skippedOccurrences = [{ recurringId: template.id, date: '2026-10-03' }];
    render(<TransactionEditor editor={{ isRecurring: true, transaction: template }} />);
    expect(screen.getByLabelText('Due date')).toHaveValue('2026-11-03');
    fireEvent.change(screen.getByLabelText('Due date'), { target: { value: '2026-10-03' } });
    expect(document.querySelector('time')).toHaveAttribute('datetime', '2026-11-03');
    fireEvent.change(screen.getByLabelText('Due date'), { target: { value: '2026-10-20' } });
    expect(document.querySelector('time')).toHaveAttribute('datetime', '2026-10-20');
    fireEvent.change(screen.getByLabelText('Repeats'), { target: { value: 'weekly' } });
    expect(
      Array.from(document.querySelectorAll('time'))
        .slice(0, 3)
        .map((node) => node.dateTime),
    ).toEqual(['2026-10-20', '2026-10-27', '2026-11-03']);
    expect(workspace.save).not.toHaveBeenCalled();
    saveSchedule();
    await waitFor(() =>
      expect(workspace.save).toHaveBeenCalledWith(
        'recurring',
        'PUT',
        expect.objectContaining({ date: '2026-10-20', frequency: 'weekly' }),
        template.id,
      ),
    );
  });
  it('filters recorded and skipped dates, respects endings and validates a due date past the ending', async () => {
    const template = monthlyRule();
    const { frequency: _frequency, reminderDays: _reminder, ...posting } = template;
    workspace.data.transactions = [{ ...posting, id: 'posted', recurringId: template.id, createdAt: 0 }];
    workspace.data.skippedOccurrences = [{ recurringId: template.id, date: '2026-11-03' }];
    workspace.data.scheduleSettings = [{ recurringId: template.id, isPaused: false, endDate: '2026-12-03' }];
    render(<TransactionEditor editor={{ isRecurring: true, transaction: template }} />);
    expect(screen.getByLabelText('Due date')).toHaveValue('2026-12-03');
    expect(document.querySelectorAll('time')).toHaveLength(1);
    fireEvent.change(screen.getByLabelText('Ends'), { target: { value: 'date' } });
    fireEvent.change(screen.getByLabelText('Due date'), { target: { value: '2027-01-03' } });
    expect(screen.getByText(/No unconfirmed dates remain/)).toBeInTheDocument();
    saveSchedule();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The final payment date must be on or after the schedule start',
    );
    expect(workspace.save).not.toHaveBeenCalled();
  });
  it('handles an empty draft date and shows clamped month-end dates without writing', () => {
    render(<TransactionEditor editor={{ isRecurring: true }} />);
    fireEvent.change(screen.getByLabelText('Due date'), { target: { value: '' } });
    expect(document.querySelectorAll('time')).toHaveLength(0);
    fireEvent.change(screen.getByLabelText('Due date'), { target: { value: '2027-01-31' } });
    expect(
      Array.from(document.querySelectorAll('time'))
        .slice(0, 3)
        .map((node) => node.dateTime),
    ).toEqual(['2027-01-31', '2027-02-28', '2027-03-31']);
    expect(workspace.save).not.toHaveBeenCalled();
  });
});

describe('custom repetition editor', () => {
  it('previews a finite month-end series and sends the count only after saving', async () => {
    render(<TransactionEditor editor={{ isRecurring: true }} />);
    fireEvent.change(screen.getByLabelText('Transaction name'), { target: { value: 'Installment' } });
    fireEvent.change(screen.getByLabelText('Amount (€)'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Due date'), { target: { value: '2028-01-31' } });
    fireEvent.change(screen.getByLabelText('Ends'), { target: { value: 'count' } });
    fireEvent.change(screen.getByLabelText('Number of repetitions'), { target: { value: '3' } });
    expect(Array.from(document.querySelectorAll('time')).map((node) => node.dateTime)).toEqual([
      '2028-01-31',
      '2028-02-29',
      '2028-03-31',
    ]);
    expect(workspace.save).not.toHaveBeenCalled();
    fireEvent.submit(screen.getByRole('button', { name: 'Add transaction' }).closest('form')!);
    await waitFor(() =>
      expect(workspace.save).toHaveBeenCalledWith(
        'recurring',
        'POST',
        expect.objectContaining({ repetitions: 3, countFrom: '2028-01-31', date: '2028-01-31' }),
        undefined,
      ),
    );
  });
  it('shows the remaining count on reopen and counts from a clamped due date without shifting the anchor', async () => {
    const template = { ...monthlyRule(), date: '2028-01-31' };
    const { frequency: _frequency, reminderDays: _reminder, ...paid } = template;
    workspace.data.recurring = [template];
    workspace.data.transactions = [{ ...paid, id: 'payment', recurringId: template.id, createdAt: 0 }];
    workspace.data.scheduleSettings = [{ recurringId: template.id, isPaused: true, endDate: '2028-04-30' }];
    render(<TransactionEditor editor={{ isRecurring: true, transaction: template }} />);
    expect(screen.getByLabelText('Due date')).toHaveValue('2028-02-29');
    expect(screen.getByLabelText('Ends')).toHaveValue('count');
    expect(screen.getByLabelText('Number of repetitions')).toHaveValue(3);
    fireEvent.change(screen.getByLabelText('Number of repetitions'), { target: { value: '2' } });
    expect(Array.from(document.querySelectorAll('time')).map((node) => node.dateTime)).toEqual([
      '2028-02-29',
      '2028-03-31',
    ]);
    saveSchedule();
    await waitFor(() =>
      expect(workspace.save).toHaveBeenCalledWith(
        'recurring',
        'PUT',
        expect.objectContaining({ repetitions: 2, countFrom: '2028-02-29', date: '2028-01-31' }),
        template.id,
      ),
    );
  });
  it('rejects invalid counts, supports removing an ending and limits a one-time rule to one occurrence', async () => {
    const template = monthlyRule();
    workspace.data.scheduleSettings = [{ recurringId: template.id, isPaused: false, endDate: '2027-01-03' }];
    render(<TransactionEditor editor={{ isRecurring: true, transaction: template }} />);
    fireEvent.change(screen.getByLabelText('Number of repetitions'), { target: { value: '0' } });
    saveSchedule();
    expect(await screen.findByRole('alert')).toHaveTextContent('whole repetition count');
    expect(workspace.save).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Repeats'), { target: { value: 'once' } });
    expect(screen.getByLabelText('Number of repetitions')).toHaveValue(1);
    expect(document.querySelectorAll('time')).toHaveLength(1);
    fireEvent.change(screen.getByLabelText('Ends'), { target: { value: 'never' } });
    saveSchedule();
    await waitFor(() =>
      expect(workspace.save).toHaveBeenCalledWith(
        'recurring',
        'PUT',
        expect.objectContaining({ endDate: null, frequency: 'once' }),
        template.id,
      ),
    );
  });
});

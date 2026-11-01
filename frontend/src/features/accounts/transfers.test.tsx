// @vitest-environment jsdom
import { useMemo, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { WorkspaceContext } from '../../app/WorkspaceContext';
import { useBudgetWorkspace } from '../../app/useBudgetWorkspace';
import type { BudgetData, EditorState } from '../../types/budget';
import TransactionsPage from '../../pages/TransactionsPage';
import { AccountsSettings } from '../settings/AccountsSettings';
import { accountBalance, statistics } from '../overview/statistics';
import { readDemo, writeDemo } from '../../lib/storage/demoStore';
import * as budgetService from '../transactions/budgetService';
import { transferInput } from './transfer';
import type { TransferDraft } from './transfer';
import { money } from '../../utils/format';

vi.mock('../../app/config/environment', () => ({ environment: { isDemo: true, apiBaseUrl: '/api/v1' } }));
const bank = '11111111-1111-4111-8111-111111111111';
const card = '22222222-2222-4222-8222-222222222222';
const cash = '33333333-3333-4333-8333-333333333333';
let seed: BudgetData;

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-01T12:00:00Z'));
  seed = {
    accounts: [
      { id: bank, name: 'Everyday', openingBalance: 100000 },
      { id: card, name: 'Card', openingBalance: -12000 },
      { id: cash, name: 'Cash', openingBalance: 0 },
    ],
    transactions: [
      {
        id: '44444444-4444-4444-8444-444444444444',
        name: 'Card purchase',
        amount: 1250,
        type: 'expense',
        category: 'Shopping',
        accountId: card,
        destinationAccountId: null,
        date: '2026-10-31',
        notes: '',
        recurringId: null,
        createdAt: 1,
      },
    ],
    recurring: [],
    budgets: [],
  };
  writeDemo(seed);
  HTMLDialogElement.prototype.showModal = vi.fn(function showModal(this: HTMLDialogElement) {
    this.open = true;
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
  localStorage.clear();
});

/** Exercise the real workspace loader, mutations and refresh on the account route.
 * @param {object} props - Optional account or settings screen. @returns {JSX.Element} Mounted application slice. */
function Harness({ accountId, settings = false }: { accountId?: string; settings?: boolean }) {
  const workspace = useBudgetWorkspace();
  const [month, setMonth] = useState('2026-11-01');
  const [editor, setEditor] = useState<EditorState | null>(null);
  const context = useMemo(() => ({ ...workspace, month, setMonth, editor, setEditor }), [workspace, month, editor]);
  return (
    <MemoryRouter initialEntries={[accountId ? `/transactions?account=${accountId}` : '/transactions']}>
      <WorkspaceContext.Provider value={context}>
        {!workspace.isLoading && (settings ? <AccountsSettings /> : <TransactionsPage />)}
        {workspace.notice && <output>{workspace.notice}</output>}
      </WorkspaceContext.Provider>
    </MemoryRouter>
  );
}

/** Submit even when exercising validation and rapid double-submission boundaries.
 * @returns {void} Native transfer form submission. */
function confirmTransfer() {
  fireEvent.submit(screen.getByRole('dialog').querySelector('form')!);
}

describe('account transfer workflows', () => {
  it('prefills the complete current debt, pays it once, and preserves total money and spending', async () => {
    const total = accountBalance(seed);
    const totals = statistics(seed.transactions);
    render(<Harness accountId={card} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Pay negative balance for Card' }));
    expect(screen.getByRole('dialog', { name: 'Pay negative balance' })).toBeInTheDocument();
    expect(screen.getByLabelText('Amount (€)')).toHaveValue(132.5);
    expect(screen.getByLabelText('From account')).toHaveValue(bank);
    expect(screen.getByLabelText('To account')).toHaveValue(card);
    expect(screen.getByRole('region', { name: 'Balance preview' })).toHaveTextContent(`${money(-13250)} → ${money(0)}`);
    expect(readDemo().transactions).toHaveLength(1);
    confirmTransfer();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const saved = readDemo();
    expect(saved.transactions).toHaveLength(2);
    expect(saved.transactions[1]).toMatchObject({
      type: 'transfer',
      amount: 13250,
      accountId: bank,
      destinationAccountId: card,
    });
    expect(saved.transactions[0]).toEqual(seed.transactions[0]);
    expect(saved.accounts).toEqual(seed.accounts);
    expect(accountBalance(saved, card)).toBe(0);
    expect(accountBalance(saved, bank)).toBe(86750);
    expect(accountBalance(saved)).toBe(total);
    expect(statistics(saved.transactions)).toEqual(totals);
    expect(screen.queryByRole('button', { name: 'Pay negative balance for Card' })).not.toBeInTheDocument();
  });

  it('records a custom transfer and shows it from both account views after reopening', async () => {
    render(<Harness accountId={bank} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Transfer money' }));
    expect(screen.getByLabelText('From account')).toHaveValue(bank);
    fireEvent.change(screen.getByLabelText('To account'), { target: { value: cash } });
    fireEvent.change(screen.getByLabelText('Amount (€)'), { target: { value: '37.25' } });
    fireEvent.change(screen.getByLabelText('Notes (optional)'), { target: { value: ' Cash withdrawal ' } });
    confirmTransfer();
    await screen.findByRole('button', { name: /Transfer to Cash/ });
    expect(readDemo().transactions[1]).toMatchObject({
      amount: 3725,
      notes: 'Cash withdrawal',
      destinationAccountId: cash,
    });
    expect(accountBalance(readDemo(), cash)).toBe(3725);
    cleanup();
    render(<Harness accountId={cash} />);
    await screen.findByRole('button', { name: /Transfer to Cash/ });
    expect(screen.queryByRole('button', { name: /Pay negative balance/ })).not.toBeInTheDocument();
  });

  it('offers payment in Settings, but cancellation and Escape leave the ledger unchanged', async () => {
    render(<Harness settings />);
    fireEvent.click(await screen.findByRole('button', { name: 'Pay negative balance for Card' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Pay negative balance for Card' }));
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { bubbles: false, cancelable: true }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(readDemo()).toEqual(seed);
  });

  it('supports reverse transfers with only two accounts and previews a negative paying balance', async () => {
    seed.accounts = seed.accounts.slice(0, 2);
    writeDemo(seed);
    render(<Harness />);
    fireEvent.click(await screen.findByRole('button', { name: 'Transfer money' }));
    fireEvent.click(screen.getByRole('button', { name: 'Swap accounts' }));
    expect(screen.getByLabelText('From account')).toHaveValue(card);
    expect(screen.getByLabelText('To account')).toHaveValue(bank);
    fireEvent.change(screen.getByLabelText('Amount (€)'), { target: { value: '5' } });
    expect(screen.getByRole('region', { name: 'Balance preview' })).toHaveTextContent(
      /leave Card with a negative balance/,
    );
    confirmTransfer();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(readDemo().transactions[1]).toMatchObject({ accountId: card, destinationAccountId: bank, amount: 500 });
  });

  it('requires a second account and does not offer payment for zero or positive balances', async () => {
    seed.accounts = [seed.accounts[0]!];
    seed.transactions = [];
    writeDemo(seed);
    render(<Harness accountId={bank} />);
    expect(await screen.findByRole('button', { name: 'Transfer money' })).toBeDisabled();
    expect(screen.getByText(/Add another account in Settings/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Pay negative balance/ })).not.toBeInTheDocument();
  });

  it('retains entered values on a failed write and succeeds on an explicit retry', async () => {
    render(<Harness accountId={card} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Pay negative balance for Card' }));
    const storage = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new Error('Storage full');
    });
    confirmTransfer();
    expect(await screen.findByRole('alert')).toHaveTextContent('Storage full');
    expect(screen.getByLabelText('Amount (€)')).toHaveValue(132.5);
    expect(readDemo().transactions).toHaveLength(1);
    storage.mockRestore();
    confirmTransfer();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(readDemo().transactions).toHaveLength(2);
  });

  it('blocks resubmission after the write succeeds but the subsequent refresh fails', async () => {
    render(<Harness accountId={card} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Pay negative balance for Card' }));
    vi.spyOn(budgetService, 'loadBudget').mockRejectedValueOnce(new Error('Network unavailable'));
    confirmTransfer();
    expect(await screen.findByRole('alert')).toHaveTextContent('Transfer saved, but balances could not refresh');
    expect(screen.getByRole('button', { name: 'Confirm transfer' })).toBeDisabled();
    confirmTransfer();
    expect(readDemo().transactions).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('prevents a second submission while a transfer request is pending', async () => {
    render(<Harness accountId={card} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Pay negative balance for Card' }));
    const original = budgetService.mutateBudget;
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const mutation = vi.spyOn(budgetService, 'mutateBudget').mockImplementationOnce(async (...args) => {
      await pending;
      return original(...args);
    });
    confirmTransfer();
    fireEvent.submit(screen.getByRole('dialog').querySelector('form')!);
    expect(mutation).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    const cancel = new Event('cancel', { bubbles: false, cancelable: true });
    fireEvent(screen.getByRole('dialog'), cancel);
    expect(cancel.defaultPrevented).toBe(true);
    release();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(readDemo().transactions).toHaveLength(2);
  });

  it('keeps the search field labelled and usable in the scoped account view', async () => {
    const expense = seed.transactions[0]!;
    seed.transactions = [
      { ...expense, date: '2026-11-01' },
      { ...expense, id: crypto.randomUUID(), name: 'Coffee', date: '2026-11-01' },
    ];
    writeDemo(seed);
    render(<Harness accountId={card} />);
    const search = await screen.findByRole('textbox', { name: 'Search transactions' });
    expect(search.closest('label')?.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    fireEvent.change(search, { target: { value: 'Card purchase' } });
    expect(screen.getByRole('button', { name: /Card purchase/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Coffee/ })).not.toBeInTheDocument();
  });
});

describe('transfer validation', () => {
  const draft: TransferDraft = {
    accountId: bank,
    destinationAccountId: card,
    amount: '132.50',
    date: '2026-11-01',
    notes: '',
  };
  it.each([
    [{ amount: '0' }, /positive amount/],
    [{ amount: '-2' }, /positive amount/],
    [{ amount: '1.005' }, /two decimal places/],
    [{ amount: '1000000000.01' }, /positive amount/],
    [{ accountId: card }, /two different accounts/],
    [{ destinationAccountId: crypto.randomUUID() }, /existing source and destination/],
    [{ date: '2026-11-02' }, /today or an earlier date/],
    [{ date: '2026-02-30' }, /today or an earlier date/],
  ])('rejects invalid draft %j before persistence', (changes, message) => {
    expect(() => transferInput(seed, { ...draft, ...changes })).toThrow(message);
    expect(readDemo()).toEqual(seed);
  });
});

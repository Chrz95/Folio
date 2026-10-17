// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { useMemo, useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { WorkspaceContext } from '../../app/WorkspaceContext';
import { useBudgetWorkspace } from '../../app/useBudgetWorkspace';
import type { EditorState, Transaction } from '../../types/budget';
import { readDemo, writeDemo } from '../../lib/storage/demoStore';
import { ACCOUNT_IDS, createDemoSeed } from '../transactions/demoSeed.constants';
import { getOccurrences } from '../transactions/recurrence';
import { accountBalance } from '../overview/statistics';
import { previewBulk, commitBulk } from './bulkService';
import { bulkPlan } from './bulkPlan';
import { bulkPlan as serverPlan } from '../../../../backend/src/features/bulk/bulkPlan';
import TransactionsPage from '../../pages/TransactionsPage';
vi.mock('../../app/config/environment', () => ({ environment: { isDemo: true, apiBaseUrl: '/api/v1' } }));
const firstId = '44444444-4444-4444-8444-444444444444';
const transferId = '55555555-5555-4555-8555-555555555555';
const incomeId = '66666666-6666-4666-8666-666666666666';
const lockedId = '77777777-7777-4777-8777-777777777777';
/** Construct a ledger fixture with a stable original audit identity. @param {Partial<Transaction>} changes - Overrides.
 * @returns {Transaction} Actual posting. */
function posting(changes: Partial<Transaction> = {}): Transaction {
  return {
    id: firstId,
    name: 'Pet supplies',
    amount: 1000,
    type: 'expense',
    category: 'Groceries',
    accountId: ACCOUNT_IDS[0],
    destinationAccountId: null,
    date: '2026-10-01',
    notes: 'Original notes',
    createdAt: 123,
    recurringId: null,
    ...changes,
  };
}
beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-16T12:00:00Z'));
  const data = createDemoSeed();
  const reconciliationId = crypto.randomUUID();
  data.transactions = [
    posting({ recurringId: data.recurring[0]?.id ?? null }),
    posting({
      id: transferId,
      name: 'Savings transfer',
      type: 'transfer',
      category: 'Savings',
      amount: 5000,
      destinationAccountId: ACCOUNT_IDS[1],
      date: '2026-10-02',
      createdAt: 234,
    }),
    posting({
      id: incomeId,
      name: 'Monthly pay',
      type: 'income',
      category: 'Salary',
      amount: 100000,
      date: '2026-10-05',
      createdAt: 345,
    }),
    posting({ id: lockedId, name: 'Locked purchase', amount: 2000, date: '2026-10-06', createdAt: 456 }),
  ];
  data.reconciliations = [
    { id: reconciliationId, accountId: ACCOUNT_IDS[0], date: '2026-10-31', statementBalance: 808000, createdAt: 1 },
  ];
  data.clearances = [
    { transactionId: lockedId, accountId: ACCOUNT_IDS[0], reconciliationId },
    { transactionId: transferId, accountId: ACCOUNT_IDS[0], reconciliationId: null },
    { transactionId: transferId, accountId: ACCOUNT_IDS[1], reconciliationId: null },
  ];
  data.importLinks = [{ transactionId: firstId, fingerprint: 'bank:fixture' }];
  const content = '%PDF-1.4\nReceipt';
  data.receipts = [
    {
      id: crypto.randomUUID(),
      transactionId: firstId,
      name: 'receipt.pdf',
      mimeType: 'application/pdf',
      size: content.length,
      content: btoa(content),
      createdAt: 1,
    },
  ];
  data.customCategories = [{ id: crypto.randomUUID(), name: 'Archived pets', isArchived: true }];
  writeDemo(data);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
  localStorage.clear();
});
/** Load actual preview persistence and expose a manual refresh. @returns {JSX.Element} Ledger harness. */
function Harness() {
  const workspace = useBudgetWorkspace();
  const [month, setMonth] = useState('2026-10-01');
  const [editor, setEditor] = useState<EditorState | null>(null);
  const context = useMemo(() => ({ ...workspace, month, setMonth, editor, setEditor }), [workspace, month, editor]);
  return (
    <MemoryRouter>
      <WorkspaceContext.Provider value={context}>
        {!workspace.isLoading && <TransactionsPage />}
        <button onClick={() => void workspace.reload()}>Refresh ledger</button>
        {workspace.notice && <output>{workspace.notice}</output>}
      </WorkspaceContext.Provider>
    </MemoryRouter>
  );
}
/** Select all visible unlocked entries. @returns {Promise<void>} Selection ready. */
async function selectAll() {
  fireEvent.click(await screen.findByRole('button', { name: 'Select all editable' }));
}
/** Request a category review through the actual UI. @returns {Promise<HTMLElement>} Read-only review. */
async function reviewCategory() {
  fireEvent.change(screen.getByLabelText('New category'), { target: { value: 'Health' } });
  fireEvent.click(screen.getByRole('button', { name: 'Review selected transactions' }));
  return screen.findByRole('region', { name: 'Bulk transaction review' });
}
describe('bulk ledger workflows with durable preview storage', () => {
  it('reviews without writes and categorizes selected rows while retaining money and links', async () => {
    const before = readDemo();
    render(<Harness />);
    await selectAll();
    expect(screen.getByLabelText('Select Locked purchase on 2026-10-06')).toBeDisabled();
    expect(screen.getByText('3 selected')).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Archived pets' })).not.toBeInTheDocument();
    const review = await reviewCategory();
    expect(within(review).getByText('Review 3 transactions')).toBeInTheDocument();
    expect(readDemo()).toEqual(before);
    fireEvent.click(within(review).getByRole('button', { name: 'Categorize 3 transactions' }));
    await waitFor(() => expect(readDemo().transactions.filter((entry) => entry.category === 'Health')).toHaveLength(3));
    const after = readDemo();
    expect(after.transactions).toEqual(
      before.transactions.map((entry) => (entry.id === lockedId ? entry : { ...entry, category: 'Health' })),
    );
    expect(after.receipts).toEqual(before.receipts);
    expect(after.clearances).toEqual(before.clearances);
    expect(after.importLinks).toEqual(before.importLinks);
    expect(after.recurring).toEqual(before.recurring);
    expect(accountBalance(after)).toBe(accountBalance(before));
    expect(screen.getByText('0 selected')).toBeInTheDocument();
  });
  it('requires deletion acknowledgment and cascades only reviewed rows and metadata', async () => {
    render(<Harness />);
    fireEvent.click(await screen.findByLabelText('Select Pet supplies on 2026-10-01'));
    fireEvent.click(screen.getByLabelText('Select Savings transfer on 2026-10-02'));
    fireEvent.change(screen.getByLabelText('Bulk action'), { target: { value: 'delete' } });
    fireEvent.click(screen.getByRole('button', { name: 'Review selected transactions' }));
    const review = await screen.findByRole('region', { name: 'Bulk transaction review' });
    expect(review).toHaveTextContent('Deletion removes 1 receipts and 1 import links');
    expect(review).toHaveTextContent('1 recorded recurring payments will become unpaid again');
    const commit = within(review).getByRole('button', { name: 'Delete 2 transactions permanently' });
    expect(commit).toBeDisabled();
    expect(readDemo().transactions).toHaveLength(4);
    fireEvent.click(
      within(review).getByLabelText('I understand these transactions and their receipts will be permanently deleted.'),
    );
    fireEvent.click(commit);
    await waitFor(() => expect(readDemo().transactions).toHaveLength(2));
    const after = readDemo();
    expect(after.transactions.map((entry) => entry.id)).toEqual([incomeId, lockedId]);
    expect(after.receipts).toHaveLength(0);
    expect(after.importLinks).toHaveLength(0);
    expect(after.clearances?.map((entry) => entry.transactionId)).toEqual([lockedId]);
    expect(after.recurring).toHaveLength(7);
    expect(
      getOccurrences(after, '2026-10-01', '2026-10-31').find(
        (entry) => entry.id === after.recurring[0]?.id && entry.date === '2026-10-01',
      )?.isPaid,
    ).toBe(false);
  });
  it('clears hidden selection and reviews whenever text, type, account, category or month scope changes', async () => {
    render(<Harness />);
    await selectAll();
    await reviewCategory();
    fireEvent.change(screen.getByLabelText('Search transactions'), { target: { value: 'Monthly' } });
    expect(screen.getByText('0 selected')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Bulk transaction review' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Search transactions'), { target: { value: '' } });
    await selectAll();
    fireEvent.change(screen.getByLabelText('Transaction type'), { target: { value: 'income' } });
    expect(screen.getByText('0 selected')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Transaction type'), { target: { value: 'all' } });
    await selectAll();
    fireEvent.change(screen.getByLabelText('Account filter'), { target: { value: ACCOUNT_IDS[1] } });
    expect(screen.getByText('0 selected')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Account filter'), { target: { value: '' } });
    await selectAll();
    fireEvent.change(screen.getByLabelText('Category filter'), { target: { value: 'Salary' } });
    expect(screen.getByText('0 selected')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Category filter'), { target: { value: '' } });
    await selectAll();
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByText('0 selected')).toBeInTheDocument();
  });
  it('rejects stale reviews against fresh storage and leaves every other row unchanged', async () => {
    render(<Harness />);
    await selectAll();
    const review = await reviewCategory();
    const data = readDemo();
    data.transactions = data.transactions.map((entry) =>
      entry.id === firstId ? { ...entry, notes: 'Changed elsewhere' } : entry,
    );
    writeDemo(data);
    fireEvent.click(within(review).getByRole('button', { name: 'Categorize 3 transactions' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Selected entries changed');
    expect(readDemo()).toEqual(data);
    expect(screen.queryByRole('region', { name: 'Bulk transaction review' })).not.toBeInTheDocument();
  });
  it('hides an old review after refreshing the loaded workspace', async () => {
    render(<Harness />);
    await selectAll();
    await reviewCategory();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh ledger' }));
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Bulk transaction review' })).not.toBeInTheDocument(),
    );
  });
  it('preserves all storage when a write fails, then allows a fresh review and successful retry', async () => {
    const before = readDemo();
    render(<Harness />);
    await selectAll();
    const review = await reviewCategory();
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new Error('Quota exceeded');
    });
    fireEvent.click(within(review).getByRole('button', { name: 'Categorize 3 transactions' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Quota exceeded');
    expect(readDemo()).toEqual(before);
    write.mockRestore();
    fireEvent.click(screen.getByRole('button', { name: 'Review selected transactions' }));
    const retry = await screen.findByRole('region', { name: 'Bulk transaction review' });
    fireEvent.click(within(retry).getByRole('button', { name: 'Categorize 3 transactions' }));
    await waitFor(() => expect(readDemo().transactions.filter((entry) => entry.category === 'Health')).toHaveLength(3));
  });
  it('bounds select-all to 100 visible entries and permits replacing one selected row', async () => {
    const data = readDemo();
    data.transactions = Array.from({ length: 101 }, (_, index) =>
      posting({ id: crypto.randomUUID(), name: `Batch ${index}` }),
    );
    data.clearances = [];
    data.reconciliations = [];
    data.receipts = [];
    data.importLinks = [];
    writeDemo(data);
    render(<Harness />);
    fireEvent.click(await screen.findByRole('button', { name: 'Select first 100 editable' }));
    expect(screen.getByText('100 selected')).toBeInTheDocument();
    const last = screen.getByLabelText('Select Batch 100 on 2026-10-01');
    expect(last).toBeDisabled();
    fireEvent.click(screen.getByLabelText('Select Batch 0 on 2026-10-01'));
    expect(last).toBeEnabled();
    fireEvent.click(last);
    const review = await reviewCategory();
    expect(within(review).getAllByRole('row')).toHaveLength(101);
    expect(within(review).queryByText('Batch 0')).not.toBeInTheDocument();
    expect(within(review).getByText('Batch 100')).toBeInTheDocument();
  });
  it('rechecks active categories and reconciliation locks even when callers bypass the checkbox UI', async () => {
    const plan = await previewBulk({ ids: [firstId], action: 'categorize', category: 'Health' });
    const data = readDemo();
    data.clearances?.push({
      transactionId: firstId,
      accountId: ACCOUNT_IDS[0],
      reconciliationId: data.reconciliations?.[0]?.id ?? crypto.randomUUID(),
    });
    writeDemo(data);
    await expect(commitBulk(plan)).rejects.toThrow('Reconciled entries');
    await expect(previewBulk({ ids: [incomeId], action: 'categorize', category: 'Archived pets' })).rejects.toThrow(
      'active category',
    );
    expect(readDemo()).toEqual(data);
  });
  it('keeps server and preview revisions identical regardless of selection order or input key order', () => {
    const data = readDemo();
    const first = bulkPlan(data, { action: 'categorize', category: 'Health', ids: [firstId, transferId] });
    const second = serverPlan(data, { ids: [transferId, firstId], category: 'Health', action: 'categorize' });
    expect(first).toEqual(second);
    expect(first.revision).not.toContain(data.receipts?.[0]?.content);
  });
});

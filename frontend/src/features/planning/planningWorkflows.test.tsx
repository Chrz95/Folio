// @vitest-environment jsdom
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { useState, useMemo } from 'react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, fireEvent, within, waitFor, cleanup } from '@testing-library/react';
import type { EditorState, Transaction } from '../../types/budget';
import { useBudgetWorkspace } from '../../app/useBudgetWorkspace';
import { WorkspaceContext } from '../../app/WorkspaceContext';
import { TransactionEditor } from '../transactions/TransactionEditor';
import { readDemo, writeDemo } from '../../lib/storage/demoStore';
import { createDemoSeed } from '../transactions/demoSeed.constants';
import { mutatePlanning } from './planningService';
import BudgetsPage from '../../pages/BudgetsPage';
import TransactionsPage from '../../pages/TransactionsPage';
import * as ledgerExport from '../transactions/export';
import { CategoriesSettings } from '../settings/CategoriesSettings';
vi.mock('../../app/config/environment', () => ({ environment: { isDemo: true, apiBaseUrl: '/api/v1' } }));
beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-16T12:00:00Z'));
  writeDemo(createDemoSeed());
  HTMLDialogElement.prototype.showModal = vi.fn(function showModal(this: HTMLDialogElement) {
    this.open = true;
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
  vi.useRealTimers();
});
interface HarnessProps {
  children?: ReactNode;
  initialEditor?: EditorState;
}
/** Exercise real workspace loading, mutations and remount behavior under controlled navigation.
 * @param {HarnessProps} props - Test entry. @param {ReactNode} props.children - Page.
 * @param {EditorState} props.initialEditor - Initial modal. @returns {JSX.Element} Test workspace. */
function Harness({ children, initialEditor }: HarnessProps) {
  const workspace = useBudgetWorkspace();
  const [month, setMonth] = useState('2026-10-01');
  const [editor, setEditor] = useState<EditorState | null>(initialEditor ?? null);
  const context = useMemo(() => ({ ...workspace, month, setMonth, editor, setEditor }), [workspace, month, editor]);
  return (
    <MemoryRouter>
      <WorkspaceContext.Provider value={context}>
        {!workspace.isLoading && children}
        {!workspace.isLoading && editor && (
          <TransactionEditor
            key={`${editor.transaction?.id ?? 'new'}:${editor.isDuplicate ?? false}`}
            editor={editor}
          />
        )}
        {workspace.error && <p role="alert">{workspace.error}</p>}
      </WorkspaceContext.Provider>
    </MemoryRouter>
  );
}
/** Find a specific savings card without relying on screen ordering. @param {string} name - Goal title.
 * @returns {HTMLElement} Card. */
function goalCard(name: string) {
  const card = screen.getByRole('heading', { name }).closest('article');
  if (!card) {
    throw new Error('Missing goal card');
  }
  return card;
}
describe('planning workflows with real browser-local persistence', () => {
  it('edits only the selected month and shows the original limit again in the next month', async () => {
    const original = readDemo().budgets.find((entry) => entry.category === 'Groceries')?.amount;
    render(
      <Harness>
        <BudgetsPage />
      </Harness>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Groceries budget' }));
    fireEvent.change(screen.getByLabelText('Allocation for this month (€)'), { target: { value: '123.45' } });
    const form = screen.getByLabelText('Allocation for this month (€)').closest('form');
    if (!form) {
      throw new Error('Missing monthly editor');
    }
    fireEvent.click(within(form).getByLabelText('Carry unused funds into next month'));
    fireEvent.click(screen.getByRole('button', { name: 'Save this month' }));
    await waitFor(() =>
      expect(readDemo().monthlyBudgets).toEqual([
        { month: '2026-10-01', category: 'Groceries', amount: 12345, rollover: true },
      ]),
    );
    expect(readDemo().budgets.find((entry) => entry.category === 'Groceries')?.amount).toBe(original);
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit Groceries budget' }));
    expect(screen.getByLabelText('Allocation for this month (€)')).toHaveValue((original ?? 0) / 100);
  });
  it('creates a goal, records progress and withdrawals, and retains history after archive and restore', async () => {
    render(
      <Harness>
        <BudgetsPage />
      </Harness>,
    );
    fireEvent.change(await screen.findByLabelText('Goal name'), { target: { value: 'Rainy day' } });
    fireEvent.change(screen.getByLabelText('Target (€)'), { target: { value: '1000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create goal' }));
    await screen.findByRole('heading', { name: 'Rainy day' });
    fireEvent.click(within(goalCard('Rainy day')).getByText('Update saved amount'));
    const card = within(goalCard('Rainy day'));
    fireEvent.change(card.getByLabelText('Amount (€)'), { target: { value: '250' } });
    fireEvent.click(card.getByRole('button', { name: 'Record progress' }));
    await waitFor(() => expect(readDemo().contributions).toHaveLength(1));
    fireEvent.change(card.getByLabelText('Progress action'), { target: { value: 'withdraw' } });
    fireEvent.change(card.getByLabelText('Amount (€)'), { target: { value: '50' } });
    fireEvent.click(card.getByRole('button', { name: 'Record progress' }));
    await waitFor(() => expect(readDemo().contributions).toHaveLength(2));
    expect(card.getByRole('progressbar')).toHaveAttribute('value', '20');
    fireEvent.click(card.getByRole('button', { name: 'Archive goal' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Rainy day' })).not.toBeInTheDocument());
    fireEvent.click(screen.getByLabelText('Show archived'));
    fireEvent.click(within(goalCard('Rainy day')).getByRole('button', { name: 'Restore goal' }));
    await waitFor(() => expect(readDemo().goals?.[0]?.isArchived).toBe(false));
    expect(readDemo().contributions).toHaveLength(2);
    expect(readDemo().transactions).toHaveLength(createDemoSeed().transactions.length);
  });
  it('creates a custom category and offers it for new transactions, preserving the name when archived', async () => {
    render(
      <Harness>
        <CategoriesSettings />
      </Harness>,
    );
    fireEvent.change(await screen.findByLabelText('New category'), { target: { value: 'Pets' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add category' }));
    await screen.findByText('Pets');
    cleanup();
    render(<Harness initialEditor={{ isRecurring: false }} />);
    expect(await screen.findByRole('option', { name: 'Pets' })).toBeInTheDocument();
    cleanup();
    render(
      <Harness>
        <CategoriesSettings />
      </Harness>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Archive' }));
    await screen.findByText('Archived');
    expect(readDemo().customCategories?.[0]?.name).toBe('Pets');
    cleanup();
    render(<Harness initialEditor={{ isRecurring: false }} />);
    await screen.findByLabelText('Category');
    expect(screen.queryByRole('option', { name: 'Pets' })).not.toBeInTheDocument();
  });
  it('duplicates an actual transaction as a new entry dated today, leaving the original unchanged', async () => {
    const source = readDemo().transactions[0] as Transaction;
    render(<Harness initialEditor={{ transaction: source, isRecurring: false }} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Duplicate transaction' }));
    expect(screen.getByLabelText('Date')).toHaveValue('2026-10-16');
    expect(screen.getByLabelText('Transaction name')).toHaveValue(source.name);
    fireEvent.click(screen.getByRole('button', { name: 'Add transaction' }));
    await waitFor(() => expect(readDemo().transactions).toHaveLength(createDemoSeed().transactions.length + 1));
    expect(readDemo().transactions.find((entry) => entry.id === source.id)).toEqual(source);
    const duplicate = readDemo().transactions.find((entry) => entry.id !== source.id && entry.name === source.name);
    expect(duplicate).toMatchObject({ date: '2026-10-16', recurringId: null });
  });
  it('suggests a merchant category but preserves an explicit user selection on later matches', async () => {
    const data = readDemo();
    const source = data.transactions.find(
      (entry) => entry.type === 'expense' && entry.category !== 'Groceries',
    ) as Transaction;
    render(<Harness initialEditor={{ isRecurring: false }} />);
    const name = await screen.findByLabelText('Transaction name');
    fireEvent.change(name, { target: { value: source.name } });
    expect(screen.getByLabelText('Category')).toHaveValue(source.category);
    expect(screen.getByLabelText('Amount (€)')).toHaveValue(null);
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Other' } });
    fireEvent.change(name, { target: { value: '' } });
    fireEvent.change(name, { target: { value: source.name } });
    expect(screen.getByLabelText('Category')).toHaveValue('Other');
  });
  it('keeps failed preview mutations atomic and retries a contribution exactly once', async () => {
    await mutatePlanning('goals', 'POST', { name: 'Emergency', targetAmount: 10000, targetDate: null });
    const goalId = readDemo().goals?.[0]?.id;
    const input = { id: crypto.randomUUID(), amount: 5000, date: '2026-10-16', notes: '' };
    await mutatePlanning('contributions', 'POST', input, goalId);
    await mutatePlanning('contributions', 'POST', input, goalId);
    const before = localStorage.getItem('folio-demo-v1');
    await expect(mutatePlanning('contributions', 'POST', { ...input, amount: 5001 }, goalId)).rejects.toThrow();
    await expect(
      mutatePlanning('contributions', 'POST', { ...input, id: crypto.randomUUID(), amount: -6000 }, goalId),
    ).rejects.toThrow();
    expect(localStorage.getItem('folio-demo-v1')).toBe(before);
    expect(readDemo().contributions).toHaveLength(1);
  });
});

describe('budget copying and category workflows', () => {
  it('copies reviewed allocations while preserving existing overrides', async () => {
    const data = readDemo();
    data.customCategories = [{ id: crypto.randomUUID(), name: 'Pets', isArchived: false }];
    data.monthlyBudgets = [
      { month: '2026-09-01', category: 'Groceries', amount: 20000, rollover: true },
      { month: '2026-09-01', category: 'Pets', amount: 12000, rollover: true },
      { month: '2026-10-01', category: 'Groceries', amount: 90000, rollover: false },
    ];
    writeDemo(data);
    render(
      <Harness>
        <BudgetsPage />
      </Harness>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Review budget copy' }));
    await screen.findByText('Keep existing');
    fireEvent.click(screen.getByRole('button', { name: /Copy [0-9]+ category budgets/ }));
    await waitFor(() =>
      expect(
        readDemo().monthlyBudgets?.find((row) => row.month === '2026-10-01' && row.category === 'Pets'),
      ).toMatchObject({ amount: 12000, rollover: true }),
    );
    expect(
      readDemo().monthlyBudgets?.find((row) => row.month === '2026-10-01' && row.category === 'Groceries')?.amount,
    ).toBe(90000);
    expect(readDemo().transactions).toEqual(data.transactions);
  });
  it('invalidates a review when the policy changes and rejects a stale reviewed snapshot', async () => {
    render(
      <Harness>
        <BudgetsPage />
      </Harness>,
    );
    const sourceMonth = await screen.findByLabelText('Copy from month');
    fireEvent.change(sourceMonth, { target: { value: '2026-10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Review budget copy' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Choose a valid source month different from the selected month.',
    );
    fireEvent.change(sourceMonth, { target: { value: '2026-09' } });

    fireEvent.click(await screen.findByRole('button', { name: 'Review budget copy' }));
    await screen.findByRole('button', { name: /Copy [0-9]+ category budgets/ });
    fireEvent.change(screen.getByLabelText('Existing destination budgets'), { target: { value: 'replace' } });
    expect(screen.queryByRole('button', { name: /Copy [0-9]+ category budgets/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Review budget copy' }));
    await screen.findByRole('button', { name: /Copy [0-9]+ category budgets/ });
    await mutatePlanning('monthlyBudgets', 'PUT', {
      month: '2026-10-01',
      category: 'Groceries',
      amount: 7777,
      rollover: false,
    });
    fireEvent.click(screen.getByRole('button', { name: /Copy [0-9]+ category budgets/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Budgets changed. Review the copy again');
    expect(readDemo().monthlyBudgets).toEqual([
      { month: '2026-10-01', category: 'Groceries', amount: 7777, rollover: false },
    ]);
  });
  it('filters archived categories exactly and exports the visible account scope', async () => {
    const data = readDemo();
    const source = data.transactions.find((row) => row.type === 'expense') as Transaction;
    const vet = { ...source, id: crypto.randomUUID(), name: 'Vet check', category: 'Pets', amount: 5252 };
    data.customCategories = [{ id: crypto.randomUUID(), name: 'Pets', isArchived: true }];
    data.transactions.push(vet, { ...vet, id: crypto.randomUUID(), name: 'Pet shop', category: 'Pets care' });
    writeDemo(data);
    const exporting = vi.spyOn(ledgerExport, 'exportTransactions').mockImplementation(() => undefined);
    render(
      <Harness>
        <TransactionsPage />
      </Harness>,
    );
    fireEvent.change(await screen.findByLabelText('Category filter'), { target: { value: 'Pets' } });
    expect(screen.getByRole('option', { name: 'Pets (archived)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Vet check/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Pet shop/ })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Account filter'), { target: { value: source.accountId } });
    expect(screen.getByLabelText('Category filter')).toHaveValue('Pets');
    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
    expect(exporting).toHaveBeenCalledWith([vet]);
    fireEvent.change(screen.getByLabelText('Transaction type'), { target: { value: 'income' } });
    expect(screen.getByText('0 transactions')).toBeInTheDocument();
  });
  it('requires an active category for a duplicated archived entry', async () => {
    const data = readDemo();
    const source = { ...data.transactions[0], category: 'Pets' } as Transaction;
    data.transactions[0] = source;
    data.customCategories = [{ id: crypto.randomUUID(), name: 'Pets', isArchived: true }];
    writeDemo(data);
    render(<Harness initialEditor={{ transaction: source, isRecurring: false, isDuplicate: true }} />);
    expect(await screen.findByRole('option', { name: 'Pets (archived)' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add transaction' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This category is archived');
    expect(readDemo().transactions).toHaveLength(data.transactions.length);
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Other' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add transaction' }));
    await waitFor(() => expect(readDemo().transactions).toHaveLength(data.transactions.length + 1));
    expect(readDemo().transactions.find((row) => row.id === source.id)?.category).toBe('Pets');
  });
  it('retains an archived category when editing its existing historical posting', async () => {
    const data = readDemo();
    const source = { ...data.transactions[0], category: 'Pets' } as Transaction;
    data.transactions[0] = source;
    data.customCategories = [{ id: crypto.randomUUID(), name: 'Pets', isArchived: true }];
    writeDemo(data);
    render(<Harness initialEditor={{ transaction: source, isRecurring: false }} />);
    await screen.findByRole('option', { name: 'Pets (archived)' });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument());
    expect(readDemo().transactions).toHaveLength(data.transactions.length);
    expect(readDemo().transactions.find((row) => row.id === source.id)?.category).toBe('Pets');
  });
});

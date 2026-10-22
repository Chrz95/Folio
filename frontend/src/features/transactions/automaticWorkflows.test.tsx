// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { useMemo, useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { WorkspaceContext } from '../../app/WorkspaceContext';
import { useBudgetWorkspace } from '../../app/useBudgetWorkspace';
import type { EditorState } from '../../types/budget';
import { TransactionEditor } from './TransactionEditor';
import RecurringPage from '../../pages/RecurringPage';
import { createDemoSeed } from './demoSeed.constants';
import { readDemo, writeDemo } from '../../lib/storage/demoStore';
import { mutateBudget } from './budgetService';
import { mutateSchedule } from '../schedules/scheduleService';
import { confirmDemoOccurrences } from '../schedules/automaticConfirmation';
import { REMINDER_STORAGE } from '../reminders/reminders.constants';
import { APP } from '../../constants/app.constants';
vi.mock('../../app/config/environment', () => ({ environment: { isDemo: true, apiBaseUrl: '/api/v1' } }));
/** Exercise the real browser adapter and editor; only platform dialog rendering is simulated.
 * @param {object} props - Initial modal. @param {EditorState} props.initial - Selected item.
 * @returns {JSX.Element} Routed workspace. */
function Harness({ initial }: { initial?: EditorState }) {
  const workspace = useBudgetWorkspace();
  const [editor, setEditor] = useState<EditorState | null>(initial ?? null);
  const [month, setMonth] = useState('2026-10-01');
  const value = useMemo(() => ({ ...workspace, editor, setEditor, month, setMonth }), [workspace, editor, month]);
  return (
    <MemoryRouter>
      <WorkspaceContext.Provider value={value}>
        {!workspace.isLoading && <RecurringPage />}
        {!workspace.isLoading && editor && <TransactionEditor editor={editor} />}
        {workspace.error && <p role="alert">{workspace.error}</p>}
      </WorkspaceContext.Provider>
    </MemoryRouter>
  );
}
beforeEach(() => {
  localStorage.clear();
  writeDemo(createDemoSeed());
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-22T12:00:00Z'));
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
/** Populate required fields without bypassing the form. @returns {Promise<void>} Ready form. */
async function fillEntry() {
  await screen.findByRole('dialog');
  fireEvent.change(screen.getByLabelText('Transaction name'), { target: { value: 'Custom bill' } });
  fireEvent.change(screen.getByLabelText('Amount (€)'), { target: { value: '12.50' } });
}
describe('mobile recurring controls, inline categories and automatic confirmation', () => {
  it('creates and selects a custom category without submitting or losing the draft, then saves it on a rule', async () => {
    render(<Harness initial={{ isRecurring: true }} />);
    await fillEntry();
    fireEvent.click(screen.getByRole('button', { name: '+ Add category' }));
    fireEvent.change(screen.getByLabelText('New spending category'), { target: { value: '  Pet care  ' } });
    fireEvent.keyDown(screen.getByLabelText('New spending category'), { key: 'Enter' });
    await waitFor(() => expect(screen.getByLabelText('Category')).toHaveValue('Pet care'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('Transaction name')).toHaveValue('Custom bill');
    expect(readDemo().customCategories?.some((row) => row.name === 'Pet care')).toBe(true);
    expect(readDemo().recurring.some((row) => row.name === 'Custom bill')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Add transaction' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(readDemo().recurring.find((row) => row.name === 'Custom bill')?.category).toBe('Pet care');
  });
  it('preserves the draft after a duplicate category or failed category write and supports cancelling creation', async () => {
    render(<Harness initial={{ isRecurring: false }} />);
    await fillEntry();
    fireEvent.click(screen.getByRole('button', { name: '+ Add category' }));
    fireEvent.change(screen.getByLabelText('New spending category'), { target: { value: 'groceries' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create category' }));
    await screen.findAllByText('That category already exists. Restore it if archived.');
    expect(screen.getByLabelText('Transaction name')).toHaveValue('Custom bill');
    fireEvent.change(screen.getByLabelText('New spending category'), { target: { value: 'Pets' } });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new Error('Quota full');
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create category' }));
    await screen.findAllByText('Quota full');
    expect(readDemo().customCategories?.some((row) => row.name === 'Pets')).toBeFalsy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel category' }));
    expect(screen.queryByLabelText('New spending category')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
  it('defaults to manual, persists an explicit opt-in and confirms the due occurrence once on a workspace refresh', async () => {
    render(<Harness initial={{ isRecurring: true }} />);
    await fillEntry();
    const automatic = within(screen.getByRole('dialog')).getByLabelText('Confirm automatically on the due date');
    expect(automatic).not.toBeChecked();
    fireEvent.click(automatic);
    fireEvent.click(screen.getByRole('button', { name: 'Add transaction' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const rule = readDemo().recurring.find((row) => row.name === 'Custom bill')!;
    expect(readDemo().scheduleSettings?.find((row) => row.recurringId === rule.id)).toMatchObject({
      autoConfirm: true,
      autoConfirmFrom: '2026-10-22',
    });
    expect(readDemo().transactions.filter((row) => row.recurringId === rule.id)).toHaveLength(1);
    fireEvent.focus(window);
    await waitFor(() => expect(readDemo().transactions.filter((row) => row.recurringId === rule.id)).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: 'Edit Custom bill' }));
    await screen.findByRole('dialog');
    expect(within(screen.getByRole('dialog')).getByLabelText('Confirm automatically on the due date')).toBeChecked();
  });
  it('keeps every sort available in the mobile selector and labels each cell without removing actions', async () => {
    render(<Harness />);
    const table = await screen.findByRole('table', { name: 'Recurring transactions' });
    const rows = () =>
      within(table)
        .getAllByRole('rowheader')
        .map((row) => row.querySelector('strong')!.textContent);
    const expected = [...readDemo().recurring].sort((a, b) => a.name.localeCompare(b.name)).map((row) => row.name);
    fireEvent.change(screen.getByLabelText('Sort recurring transactions'), { target: { value: 'name:ascending' } });
    expect(rows()).toEqual(expected);
    expect(table.querySelectorAll('td[data-label="Actions"]')).toHaveLength(expected.length);
    expect(within(table).getAllByRole('button', { name: 'Mark paid' }).length).toBe(expected.length);
  });
  it('retains one durable snapshot on a failed automatic batch and retries exactly once in the selected timezone', async () => {
    const source = readDemo().recurring[0]!;
    await mutateBudget('recurring', 'POST', { ...source, date: '2026-10-22', frequency: 'weekly', autoConfirm: true });
    const rule = readDemo().recurring.at(-1)!;
    const before = localStorage.getItem(APP.storageKey);
    const failure = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new Error('Quota full');
    });
    expect(() => confirmDemoOccurrences(Date.now())).toThrow('Quota full');
    expect(localStorage.getItem(APP.storageKey)).toBe(before);
    failure.mockRestore();
    expect(confirmDemoOccurrences(Date.now()).transactions.filter((row) => row.recurringId === rule.id)).toHaveLength(
      1,
    );
    expect(confirmDemoOccurrences(Date.now()).transactions.filter((row) => row.recurringId === rule.id)).toHaveLength(
      1,
    );
    await mutateSchedule('scheduleSettings', { recurringId: rule.id, isPaused: true, endDate: null });
    expect(
      confirmDemoOccurrences(Date.parse('2026-10-29T12:00:00Z')).transactions.filter(
        (row) => row.recurringId === rule.id,
      ),
    ).toHaveLength(1);
    expect(localStorage.getItem(REMINDER_STORAGE)).toBeNull();
  });
});

// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { Fragment, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { render, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { WorkspaceContext } from '../../app/WorkspaceContext';
import { useBudgetWorkspace } from '../../app/useBudgetWorkspace';
import type { BudgetData, EditorState, RecurringTransaction } from '../../types/budget';
import { readDemo, writeDemo } from '../../lib/storage/demoStore';
import { CalendarGrid } from '../calendar/CalendarGrid';
import { DayDetail } from '../calendar/DayDetail';
import RecurringPage from '../../pages/RecurringPage';
vi.mock('../../app/config/environment', () => ({ environment: { isDemo: true, apiBaseUrl: '/api/v1' } }));
const accountId = '11111111-1111-4111-8111-111111111111';
/** Create a legitimate deterministic UI rule. @param {number} index - UUID suffix.
 * @param {string} name - Label. @param {string} date - Anchor. @returns {RecurringTransaction} Schedule. */
function rule(index: number, name: string, date: string): RecurringTransaction {
  return {
    id: `22222222-2222-4222-8222-${String(index).padStart(12, '0')}`,
    name,
    date,
    amount: 1000,
    type: 'expense',
    category: 'Housing',
    accountId,
    destinationAccountId: null,
    notes: '',
    frequency: 'once',
    reminderDays: 0,
  };
}
/** Build an empty workspace. @returns {BudgetData} Isolated ledger. */
function fixture(): BudgetData {
  return {
    accounts: [{ id: accountId, name: 'Everyday', openingBalance: 100000 }],
    recurring: [],
    transactions: [],
    budgets: [],
  };
}
/** Use actual storage and mutation logic while keeping the test inside one routed workspace.
 * @param {object} props - Display under test. @returns {JSX.Element} Workspace provider. */
function Harness({ children }: { children: ReactNode }) {
  const workspace = useBudgetWorkspace();
  const [month, setMonth] = useState('2026-10-01');
  const [editor, setEditor] = useState<EditorState | null>(null);
  const value = useMemo(() => ({ ...workspace, month, setMonth, editor, setEditor }), [workspace, month, editor]);
  return (
    <MemoryRouter>
      <WorkspaceContext.Provider value={value}>
        {!workspace.isLoading && children}
        {workspace.error && <p role="alert">{workspace.error}</p>}
      </WorkspaceContext.Provider>
    </MemoryRouter>
  );
}
/** Compose a selectable month and its complete agenda. @returns {JSX.Element} Calendar test surface. */
function Calendar() {
  const [date, setDate] = useState('2026-10-17');
  return (
    <Fragment>
      <CalendarGrid
        selectedDate={date}
        onDateSelect={setDate}
      />
      <DayDetail date={date} />
    </Fragment>
  );
}
beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-17T12:00:00Z'));
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.useRealTimers();
});
describe('calendar states and default recurring table', () => {
  it('shows all weekly instances and turns the selected occurrence green exactly once after confirmation', async () => {
    const data = fixture();
    data.recurring = [{ ...rule(1, 'Weekly bill', '2026-10-03'), frequency: 'weekly' }];
    writeDemo(data);
    render(
      <Harness>
        <Calendar />
      </Harness>,
    );
    const day = await screen.findByRole('button', { name: '2026-10-17, 1 transactions' });
    expect(within(day).getByLabelText('Weekly bill: Unconfirmed')).toHaveClass('unconfirmed');
    expect(screen.getAllByLabelText('Weekly bill: Overdue')).toHaveLength(2);
    expect(screen.getAllByLabelText('Weekly bill: Unconfirmed')).toHaveLength(4);
    fireEvent.click(screen.getByRole('button', { name: 'Mark paid' }));
    await screen.findByText('Confirmed');
    expect(within(day).getByLabelText('Weekly bill: Confirmed')).toHaveClass('confirmed');
    expect(within(day).queryAllByLabelText('Weekly bill: Unconfirmed')).toHaveLength(0);
    expect(readDemo().transactions).toHaveLength(1);
    expect(screen.getAllByLabelText('Weekly bill: Unconfirmed')).toHaveLength(3);
  });
  it('keeps all entries on a busy date and refreshes overdue color on foreground date change', async () => {
    const data = fixture();
    data.recurring = Array.from({ length: 4 }, (_, index) => rule(index + 1, `Bill ${index}`, '2026-10-17'));
    writeDemo(data);
    render(
      <Harness>
        <Calendar />
      </Harness>,
    );
    const day = await screen.findByRole('button', { name: '2026-10-17, 4 transactions' });
    expect(day.querySelectorAll('.calendar-event')).toHaveLength(4);
    expect(day.querySelectorAll('.calendar-dots i.unconfirmed')).toHaveLength(4);
    vi.setSystemTime(new Date('2026-10-18T12:00:00Z'));
    fireEvent.focus(window);
    await waitFor(() => expect(day.querySelectorAll('.calendar-event.overdue')).toHaveLength(4));
    expect(day.querySelectorAll('.calendar-dots i.overdue')).toHaveLength(4);
    expect(readDemo().transactions).toHaveLength(0);
  });
  it('shows paused dates, disables confirmation and allows a reversible skip', async () => {
    const data = fixture();
    data.recurring = [rule(1, 'Paused bill', '2026-10-17')];
    data.scheduleSettings = [{ recurringId: data.recurring[0]!.id, isPaused: true, endDate: null }];
    writeDemo(data);
    render(
      <Harness>
        <Calendar />
      </Harness>,
    );
    await screen.findByLabelText('Paused bill: Unconfirmed, paused');
    expect(screen.getByRole('button', { name: 'Mark paid' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Skip this occurrence' }));
    await screen.findByRole('button', { name: '2026-10-17, 0 transactions' });
    expect(readDemo().transactions).toHaveLength(0);
    expect(readDemo().scheduleSettings?.[0]?.isPaused).toBe(true);
    expect(readDemo().skippedOccurrences).toHaveLength(1);
  });
  it('defaults to the nearest table, supports sorting and retains cards with type labels', async () => {
    const data = fixture();
    data.recurring = [
      rule(1, 'Yesterday', '2026-10-16'),
      { ...rule(2, 'Tomorrow', '2026-10-18'), type: 'income', amount: 5000 },
      { ...rule(3, 'Today', '2026-10-17'), amount: 2500 },
    ];
    writeDemo(data);
    render(
      <Harness>
        <RecurringPage />
      </Harness>,
    );
    const table = await screen.findByRole('table', { name: 'Recurring transactions' });
    expect(screen.getByRole('button', { name: 'Table', pressed: true })).toBeInTheDocument();
    const names = () =>
      within(table)
        .getAllByRole('rowheader')
        .map((cell) => cell.querySelector('strong')!.textContent);
    expect(names()).toEqual(['Today', 'Yesterday', 'Tomorrow']);
    const edit = screen.getByRole('button', { name: 'Edit Today' });
    expect(edit.textContent).toBe('');
    expect(edit.querySelector('svg')).not.toBeNull();
    expect(edit).toHaveAttribute('title', 'Edit Today');
    for (const name of ['Mark paid', 'Skip this occurrence']) {
      const action = within(table).getAllByRole('button', { name })[0]!;
      expect(action.textContent).toBe('');
      expect(action.querySelector('svg')).not.toBeNull();
      expect(action).toHaveAttribute('title', name);
    }
    expect(table.querySelectorAll('.type-pill.expense')).toHaveLength(2);
    expect(table.querySelectorAll('.type-pill.income')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /^Amount/ }));
    expect(names()).toEqual(['Yesterday', 'Today', 'Tomorrow']);
    expect(screen.getByRole('columnheader', { name: /Amount/ })).toHaveAttribute('aria-sort', 'ascending');
    fireEvent.click(screen.getByRole('button', { name: /^Amount/ }));
    expect(names()).toEqual(['Tomorrow', 'Today', 'Yesterday']);
    fireEvent.click(screen.getByRole('button', { name: 'Cards' }));
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(3);
    expect(readDemo().transactions).toHaveLength(0);
  });
});

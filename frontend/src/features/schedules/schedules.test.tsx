// @vitest-environment jsdom
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import type { BudgetData, EditorState } from '../../types/budget';
import { WorkspaceContext } from '../../app/WorkspaceContext';
import { useBudgetWorkspace } from '../../app/useBudgetWorkspace';
import RecurringPage from '../../pages/RecurringPage';
import { CalendarGrid } from '../calendar/CalendarGrid';
import { readDemo, writeDemo } from '../../lib/storage/demoStore';
import { getOccurrences } from '../transactions/recurrence';
import { mutateBudget, payOccurrence } from '../transactions/budgetService';
import { mutateSchedule } from './scheduleService';
import { buildForecast } from '../forecast/forecast';
import { planReminderJobs } from '../reminders/reminderPlanning';
import { DEFAULT_REMINDER_PREFERENCES } from '../reminders/reminders.constants';
import { parseBackup, exportBackup } from '../backup/backupService';
vi.mock('../../app/config/environment', () => ({ environment: { isDemo: true, apiBaseUrl: '/api/v1' } }));
const accountId = '11111111-1111-4111-8111-111111111111';
const recurringId = '22222222-2222-4222-8222-222222222222';
/** Build one deterministic recurring bill. @returns {BudgetData} Isolated fictional ledger. */
function fixture(): BudgetData {
  return {
    accounts: [{ id: accountId, name: 'Everyday', openingBalance: 100000 }],
    transactions: [],
    budgets: [],
    recurring: [
      {
        id: recurringId,
        name: 'Rent',
        amount: 10000,
        type: 'expense',
        category: 'Housing',
        accountId,
        destinationAccountId: null,
        date: '2026-10-16',
        frequency: 'monthly',
        reminderDays: 2,
        notes: '',
      },
    ],
  };
}
beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-16T12:00:00Z'));
  writeDemo(fixture());
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.useRealTimers();
});
interface HarnessProps {
  children: ReactNode;
}
/** Exercise the actual workspace mutation and refresh path. @param {HarnessProps} props - Page under test.
 * @param {ReactNode} props.children - UI. @returns {JSX.Element} Workspace provider. */
function Harness({ children }: HarnessProps) {
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
/** Inspect the current planner and reminder outputs for today. @returns {object} Derived outcomes. */
function outcomes() {
  const data = readDemo();
  return {
    dates: getOccurrences(data, '2026-10-16', '2026-10-31').filter((entry) => !entry.isPaid),
    forecast: buildForecast(data, { startDate: '2026-10-16', days: 15, accountId, threshold: 0, includeOverdue: true }),
    reminders: planReminderJobs(data.recurring, data.transactions, [], DEFAULT_REMINDER_PREFERENCES, Date.now(), data),
  };
}
describe('schedule controls across the preview', () => {
  it('pauses and resumes a schedule through the UI without creating any recorded payments', async () => {
    render(
      <Harness>
        <RecurringPage />
      </Harness>,
    );
    fireEvent.click(await screen.findByText('Schedule controls · 0 skipped'));
    fireEvent.click(screen.getByLabelText('Pause this schedule'));
    fireEvent.click(screen.getByRole('button', { name: 'Save schedule controls' }));
    await screen.findByText('Paused');
    expect(screen.getByRole('button', { name: 'Mark paid' })).toBeDisabled();
    expect(outcomes().dates).toHaveLength(0);
    expect(outcomes().forecast.closing).toBe(100000);
    expect(outcomes().reminders).toHaveLength(0);
    fireEvent.click(screen.getByLabelText('Pause this schedule'));
    fireEvent.click(screen.getByRole('button', { name: 'Save schedule controls' }));
    await waitFor(() => expect(readDemo().scheduleSettings?.[0]?.isPaused).toBe(false));
    expect(outcomes().dates).toHaveLength(1);
    expect(readDemo().transactions).toHaveLength(0);
  });
  it('prepares a paused schedule for an off-date payment, preserving history and validating dates', async () => {
    const data = fixture();
    data.scheduleSettings = [{ recurringId, isPaused: true, endDate: null }];
    data.transactions = [
      {
        id: '33333333-3333-4333-8333-333333333333',
        name: 'Recorded elsewhere',
        amount: 10000,
        type: 'expense',
        category: 'Housing',
        accountId,
        destinationAccountId: null,
        date: '2026-10-15',
        notes: 'Original note',
        createdAt: 1,
        recurringId: null,
      },
    ];
    writeDemo(data);
    render(
      <Harness>
        <RecurringPage />
      </Harness>,
    );
    fireEvent.click(await screen.findByText('Schedule controls · 0 skipped'));
    expect(screen.getByRole('button', { name: 'Skip planned date' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Planned date to skip'), { target: { value: '2026-10-17' } });
    fireEvent.click(screen.getByRole('button', { name: 'Skip planned date' }));
    await screen.findByText('Choose a date in this recurring schedule.');
    expect(readDemo().skippedOccurrences ?? []).toHaveLength(0);
    fireEvent.change(screen.getByLabelText('Planned date to skip'), { target: { value: '2026-10-16' } });
    fireEvent.click(screen.getByRole('button', { name: 'Skip planned date' }));
    await screen.findByText('Schedule controls · 1 skipped');
    expect(readDemo().scheduleSettings?.[0]?.isPaused).toBe(true);
    expect(readDemo().transactions).toEqual(data.transactions);
    fireEvent.click(screen.getByLabelText('Pause this schedule'));
    fireEvent.click(screen.getByRole('button', { name: 'Save schedule controls' }));
    await waitFor(() => expect(readDemo().scheduleSettings?.[0]?.isPaused).toBe(false));
    expect(outcomes().dates).toHaveLength(0);
    expect(outcomes().reminders).toHaveLength(0);
    expect(readDemo().transactions).toEqual(data.transactions);
    fireEvent.click(screen.getByRole('button', { name: 'Restore skipped 2026-10-16' }));
    await waitFor(() => expect(readDemo().skippedOccurrences).toHaveLength(0));
    expect(outcomes().dates).toHaveLength(1);
  });
  it('skips one date, removes it from the calendar, forecast and reminders, then restores it', async () => {
    render(
      <Harness>
        <RecurringPage />
      </Harness>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Skip this occurrence' }));
    await screen.findByText('Schedule controls · 1 skipped');
    expect(outcomes().dates).toHaveLength(0);
    expect(outcomes().forecast.events).toHaveLength(0);
    expect(outcomes().reminders).toHaveLength(0);
    cleanup();
    render(
      <Harness>
        <CalendarGrid
          selectedDate="2026-10-16"
          onDateSelect={() => undefined}
        />
      </Harness>,
    );
    expect(await screen.findByRole('button', { name: '2026-10-16, 0 transactions' })).toBeInTheDocument();
    cleanup();
    render(
      <Harness>
        <RecurringPage />
      </Harness>,
    );
    fireEvent.click(await screen.findByText('Schedule controls · 1 skipped'));
    fireEvent.click(screen.getByRole('button', { name: 'Restore skipped 2026-10-16' }));
    await waitFor(() => expect(readDemo().skippedOccurrences).toHaveLength(0));
    expect(outcomes().dates).toHaveLength(1);
    expect(outcomes().forecast.events).toHaveLength(1);
    expect(outcomes().reminders).toHaveLength(1);
  });
  it('saves an inclusive end date while retaining existing actual postings beyond it', async () => {
    render(
      <Harness>
        <RecurringPage />
      </Harness>,
    );
    fireEvent.click(await screen.findByText('Schedule controls · 0 skipped'));
    fireEvent.change(screen.getByLabelText('Last allowed payment date'), { target: { value: '2026-10-16' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save schedule controls' }));
    await waitFor(() => expect(readDemo().scheduleSettings?.[0]?.endDate).toBe('2026-10-16'));
    expect(getOccurrences(readDemo(), '2026-10-01', '2026-12-31')).toHaveLength(1);
    const data = readDemo();
    const [template] = data.recurring;
    if (!template) {
      throw new Error('Missing schedule');
    }
    await payOccurrence(template);
    await mutateSchedule('scheduleSettings', { recurringId, isPaused: true, endDate: '2026-10-16' });
    expect(getOccurrences(readDemo(), '2026-10-01', '2026-12-31')[0]?.isPaid).toBe(true);
    expect(readDemo().transactions).toHaveLength(1);
  });
  it('preserves the audit timestamp and schedule link when editing a recorded preview payment', async () => {
    const [template] = readDemo().recurring;
    if (!template) {
      throw new Error('Missing schedule');
    }
    await payOccurrence(template);
    const [entry] = readDemo().transactions;
    if (!entry) {
      throw new Error('Missing payment');
    }
    const { id, createdAt, recurringId: link, ...input } = entry;
    vi.setSystemTime(new Date('2026-10-17T12:00:00Z'));
    await mutateBudget('transactions', 'PUT', { ...input, notes: 'Receipt checked' }, id);
    expect(readDemo().transactions[0]).toMatchObject({ createdAt, recurringId: link, notes: 'Receipt checked' });
    expect(getOccurrences(readDemo(), '2026-10-16', '2026-10-16')[0]?.isPaid).toBe(true);
    await expect(
      mutateSchedule('skippedOccurrences', { recurringId, date: '2026-10-16', isSkipped: true }),
    ).rejects.toThrow('already recorded');
  });
  it('round-trips controls and skips through a backup and rejects invalid links', async () => {
    await mutateSchedule('scheduleSettings', { recurringId, isPaused: true, endDate: '2026-12-16' });
    await mutateSchedule('skippedOccurrences', { recurringId, date: '2026-11-16', isSkipped: true });
    const data = parseBackup(await exportBackup());
    expect(data.scheduleSettings).toHaveLength(1);
    expect(data.skippedOccurrences).toHaveLength(1);
    data.skippedOccurrences[0] = { recurringId, date: '2026-11-17' };
    expect(() => parseBackup(JSON.stringify(data))).toThrow('skipped occurrence');
  });
  it('keeps newly created accounts and schedules portable and accepts legacy preview audit fields', async () => {
    await mutateBudget('accounts', 'POST', { name: 'Savings', openingBalance: 0 });
    const [template] = readDemo().recurring;
    if (!template) {
      throw new Error('Missing schedule');
    }
    const { id: _id, ...input } = template;
    await mutateBudget('recurring', 'POST', { ...input, name: 'Insurance' });
    const parsed = parseBackup(await exportBackup());
    expect(parsed.accounts).toHaveLength(2);
    expect(parsed.recurring).toHaveLength(2);
    const legacy = {
      ...parsed,
      accounts: parsed.accounts.map((entry) => ({ ...entry, createdAt: 1, recurringId: null })),
      recurring: parsed.recurring.map((entry) => ({ ...entry, createdAt: 1, recurringId: null })),
    };
    const normalized = parseBackup(JSON.stringify(legacy));
    expect(normalized.accounts[0]).not.toHaveProperty('createdAt');
    expect(normalized.recurring[0]).not.toHaveProperty('recurringId');
  });
  it('clears exceptions only on an anchor change and preserves recorded payments after schedule deletion', async () => {
    await mutateSchedule('skippedOccurrences', { recurringId, date: '2026-11-16', isSkipped: true });
    const [template] = readDemo().recurring;
    if (!template) {
      throw new Error('Missing schedule');
    }
    const { id, ...input } = template;
    await mutateBudget('recurring', 'PUT', { ...input, name: 'Renamed' }, id);
    expect(readDemo().skippedOccurrences).toHaveLength(1);
    await mutateBudget('recurring', 'PUT', { ...input, date: '2026-10-17' }, id);
    expect(readDemo().skippedOccurrences).toHaveLength(0);
    await payOccurrence({ ...template, date: '2026-10-17' });
    await mutateBudget('recurring', 'DELETE', undefined, id);
    expect(readDemo().scheduleSettings ?? []).toHaveLength(0);
    expect(readDemo().transactions[0]?.recurringId).toBeNull();
  });
});

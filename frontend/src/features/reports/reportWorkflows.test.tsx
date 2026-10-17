// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { useMemo, useState } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { WorkspaceContext } from '../../app/WorkspaceContext';
import { useBudgetWorkspace } from '../../app/useBudgetWorkspace';
import type { EditorState, Transaction } from '../../types/budget';
import { readDemo, writeDemo } from '../../lib/storage/demoStore';
import { ACCOUNT_IDS, createDemoSeed } from '../transactions/demoSeed.constants';
import * as ledgerExport from '../transactions/export';
import * as reportExport from './reportExport';
import ReportsPage from '../../pages/ReportsPage';
vi.mock('../../app/config/environment', () => ({ environment: { isDemo: true, apiBaseUrl: '/api/v1' } }));
/** Create actual entries independently of recurring plans. @param {Partial<Transaction>} changes - Overrides.
 * @returns {Transaction} Test posting. */
function posting(changes: Partial<Transaction> = {}): Transaction {
  return {
    id: crypto.randomUUID(),
    name: 'Pet supplies',
    amount: 10000,
    type: 'expense',
    category: 'Pets',
    accountId: ACCOUNT_IDS[0],
    destinationAccountId: null,
    date: '2026-10-01',
    notes: '',
    createdAt: 1,
    recurringId: null,
    ...changes,
  };
}
beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-16T12:00:00Z'));
  const data = createDemoSeed();
  data.customCategories = [
    { id: crypto.randomUUID(), name: 'Pets', isArchived: true },
    { id: crypto.randomUUID(), name: 'Pets plus', isArchived: false },
  ];
  data.transactions = [
    posting(),
    posting({ amount: 5000, date: '2026-10-31' }),
    posting({ amount: 7000, category: 'Pets plus', date: '2026-10-15' }),
    posting({ amount: 9000, accountId: ACCOUNT_IDS[1], date: '2026-10-10' }),
    posting({ amount: 100000, type: 'income', category: 'Salary', date: '2026-10-04' }),
    posting({
      amount: 20000,
      type: 'transfer',
      category: 'Savings',
      destinationAccountId: ACCOUNT_IDS[1],
      date: '2026-10-20',
    }),
    posting({ amount: 20000, date: '2026-09-30' }),
    posting({ amount: 4000, category: 'Housing', date: '2026-09-01' }),
    posting({ amount: 3000, date: '2026-01-01' }),
    posting({ amount: 8000, date: '2025-12-31' }),
    posting({ amount: 6000, date: '2026-11-01' }),
  ];
  writeDemo(data);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
  localStorage.clear();
});
/** Observe a generated bookmark. @returns {JSX.Element} Current report URL. */
function Location() {
  const location = useLocation();
  return <output aria-label="Report URL">{location.search}</output>;
}
/** Load the actual preview workspace under deterministic navigation. @param {object} props - Route state.
 * @param {string} props.url - Initial bookmark. @param {string} props.initialMonth - Global month default.
 * @returns {JSX.Element} Report with real storage and filters. */
function Harness({ url = '/reports', initialMonth = '2026-10-01' }: { url?: string; initialMonth?: string }) {
  const workspace = useBudgetWorkspace();
  const [month, setMonth] = useState(initialMonth);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const context = useMemo(() => ({ ...workspace, month, setMonth, editor, setEditor }), [workspace, month, editor]);
  return (
    <MemoryRouter initialEntries={[url]}>
      <WorkspaceContext.Provider value={context}>
        {!workspace.isLoading && <ReportsPage />}
        <Location />
      </WorkspaceContext.Provider>
    </MemoryRouter>
  );
}
/** Locate a specific report card. @param {string} name - Accessible label.
 * @returns {ReturnType<typeof within>} Card queries. */
function card(name: string) {
  return within(screen.getByRole('article', { name: `${name} report` }));
}
describe('reports with actual preview data and bookmarkable filters', () => {
  it('shows monthly flows, prior-only categories and chart totals without planned bills', async () => {
    render(<Harness />);
    await screen.findByLabelText('Report month');
    expect(card('Income').getByText('€1,000.00')).toBeInTheDocument();
    expect(card('Expenses').getByText('€310.00')).toBeInTheDocument();
    expect(card('Expenses').getByText('Previous: €240.00')).toBeInTheDocument();
    expect(card('Net savings').getByText('€690.00')).toBeInTheDocument();
    const categories = within(screen.getByRole('region', { name: 'Report spending categories' }));
    expect(categories.getByText('Housing')).toBeInTheDocument();
    expect(categories.getByText('Previous €40.00 · Change -€40.00')).toBeInTheDocument();
    const chart = within(screen.getByRole('region', { name: 'Report cash flow' }));
    expect(chart.getByRole('rowheader', { name: '2026-10-31' })).toBeInTheDocument();
    expect(chart.getByRole('rowheader', { name: '2026-10-20' }).closest('tr')).toHaveTextContent('€0.00€0.00');
    expect(screen.getByText('5 recorded cash flow transactions')).toBeInTheDocument();
  });
  it('combines archived category/account filters and exports exactly the selected report and postings', async () => {
    const ledger = vi.spyOn(ledgerExport, 'exportTransactions').mockImplementation(() => undefined);
    const report = vi.spyOn(reportExport, 'exportReport').mockImplementation(() => undefined);
    render(<Harness />);
    fireEvent.change(await screen.findByLabelText('Category filter'), { target: { value: 'Pets' } });
    fireEvent.change(screen.getByLabelText('Account filter'), { target: { value: ACCOUNT_IDS[0] } });
    expect(screen.getByRole('option', { name: 'Pets (archived)' })).toBeInTheDocument();
    expect(card('Expenses').getByText('€150.00')).toBeInTheDocument();
    expect(card('Expenses').getByText('Previous: €200.00')).toBeInTheDocument();
    expect(card('Net savings').getByText('No percentage: previous value is negative.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Export transactions CSV' }));
    expect(ledger.mock.calls[0]?.[0].map((entry) => entry.amount)).toEqual([10000, 5000]);
    fireEvent.click(screen.getByRole('button', { name: 'Export report CSV' }));
    const snapshot = report.mock.calls[0]?.[0];
    expect(snapshot).toMatchObject({
      totals: { expenses: 15000, income: 0 },
      prior: { expenses: 20000 },
      selection: { accountId: ACCOUNT_IDS[0], category: 'Pets' },
    });
    if (!snapshot) {
      throw new Error('Missing report export');
    }
    expect(reportExport.buildReportCsv(snapshot)).toContain('"Summary","Expenses",150,200,-50,');
    expect(readDemo().transactions).toHaveLength(11);
  });
  it('restores all report defaults and scopes from a bookmark with a different global month', async () => {
    const view = render(<Harness />);
    fireEvent.change(await screen.findByLabelText('Category filter'), { target: { value: 'Pets' } });
    fireEvent.change(screen.getByLabelText('Account filter'), { target: { value: ACCOUNT_IDS[0] } });
    const query = screen.getByLabelText('Report URL').textContent ?? '';
    expect(new URLSearchParams(query).get('month')).toBe('2026-10');
    view.unmount();
    render(
      <Harness
        url={`/reports${query}`}
        initialMonth="2026-11-01"
      />,
    );
    expect(await screen.findByLabelText('Report month')).toHaveValue('2026-10');
    expect(screen.getByLabelText('Category filter')).toHaveValue('Pets');
    expect(screen.getByLabelText('Account filter')).toHaveValue(ACCOUNT_IDS[0]);
    expect(card('Expenses').getByText('€150.00')).toBeInTheDocument();
  });
  it('recalculates calendar-year reports, including entries outside the global month', async () => {
    render(<Harness url="/reports?period=yearly&year=2026" />);
    expect(await screen.findByLabelText('Report year')).toHaveValue(2026);
    expect(card('Expenses').getByText('€640.00')).toBeInTheDocument();
    expect(card('Expenses').getByText('Previous: €80.00')).toBeInTheDocument();
    const chart = within(screen.getByRole('region', { name: 'Report cash flow' }));
    expect(chart.getByRole('rowheader', { name: '2026-01' }).closest('tr')).toHaveTextContent('€30.00');
    expect(chart.getByRole('rowheader', { name: '2026-12' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Report year'), { target: { value: '2025' } });
    expect(card('Expenses').getByText('€80.00')).toBeInTheDocument();
    expect(card('Income').getByText('No percentage: previous value is zero.')).toBeInTheDocument();
  });
  it('compares a one-day custom report to yesterday and blocks exports for reversed dates', async () => {
    render(<Harness url="/reports?period=custom&start=2026-10-01&end=2026-10-01" />);
    await screen.findByLabelText('Start date');
    expect(card('Expenses').getByText('€100.00')).toBeInTheDocument();
    expect(card('Expenses').getByText('Previous: €200.00')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-10-02' } });
    expect(screen.getByRole('alert')).toHaveTextContent('end date must be on or after');
    expect(screen.queryByRole('button', { name: 'Export report CSV' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Report cash flow' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-10-02' } });
    expect(card('Expenses').getByText('€0.00')).toBeInTheDocument();
    expect(card('Expenses').getByText('Previous: €100.00')).toBeInTheDocument();
  });
  it('keeps unavailable bookmarked scopes visible and empty instead of silently showing all accounts', async () => {
    render(<Harness url="/reports?account=removed-account&category=Old" />);
    expect(await screen.findByRole('option', { name: 'Unavailable account' })).toBeInTheDocument();
    expect(screen.getByLabelText('Account filter')).toHaveValue('removed-account');
    expect(screen.getByRole('option', { name: 'Old (unavailable)' })).toBeInTheDocument();
    expect(card('Expenses').getByText('€0.00')).toBeInTheDocument();
    expect(screen.getByText('No spending in either period for these filters.')).toBeInTheDocument();
  });
});

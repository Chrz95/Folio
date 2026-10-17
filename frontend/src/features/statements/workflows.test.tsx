// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { BudgetData } from '../../types/budget';
import { createDemoSeed } from '../transactions/demoSeed.constants';
import { writeDemo, readDemo } from '../../lib/storage/demoStore';
import { accountDelta } from './importMatching';
import ImportPage from '../../pages/ImportPage';
import ReconcilePage from '../../pages/ReconcilePage';
const workspace = vi.hoisted(() => ({ data: {} as BudgetData, reload: vi.fn() }));
vi.mock('../../app/config/environment', () => ({ environment: { isDemo: true, apiBaseUrl: '/api/v1' } }));
vi.mock('../../app/WorkspaceContext', () => ({ useWorkspace: () => workspace }));
beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-16T12:00:00Z'));
  workspace.data = createDemoSeed();
  writeDemo(workspace.data);
  workspace.reload.mockImplementation(async () => {
    workspace.data = readDemo();
  });
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.useRealTimers();
});
/** Review and commit the fictional sample through the actual UI and demo persistence adapter.
 * @returns {Promise<void>} Completes import without mocking its business rules. */
async function importSample() {
  render(
    <MemoryRouter>
      <ImportPage />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Try a sample statement' }));
  fireEvent.click(screen.getByRole('button', { name: 'Review transactions' }));
  await screen.findByRole('button', { name: 'Confirm import' });
  fireEvent.click(screen.getByRole('button', { name: 'Confirm import' }));
  await screen.findByText('Your statement has landed');
}
describe('statement workflows', () => {
  it('maps, reviews and imports a statement while matching the existing salary', async () => {
    const before = readDemo().transactions.length;
    await importSample();
    expect(readDemo().transactions).toHaveLength(before + 1);
    expect(screen.getByText(/1 transactions imported · 1 matched · 0 skipped/)).toBeInTheDocument();
    expect(readDemo().clearances).toHaveLength(2);
    expect(readDemo().importLinks).toHaveLength(2);
  });
  it('shows all repeated imports as duplicates without offering a second commit', async () => {
    await importSample();
    cleanup();
    render(
      <MemoryRouter>
        <ImportPage />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Try a sample statement' }));
    fireEvent.click(screen.getByRole('button', { name: 'Review transactions' }));
    expect(await screen.findByRole('button', { name: 'Confirm import' })).toBeDisabled();
    expect(screen.getByText(/0 new · 0 matched · 2 skipped/)).toBeInTheDocument();
  });
  it('reconciles the imported cleared balance and exposes protected entries', async () => {
    await importSample();
    cleanup();
    workspace.data = readDemo();
    const [account] = workspace.data.accounts;
    if (!account) {
      throw new Error('Missing account');
    }
    const flags = workspace.data.clearances ?? [];
    const balance = workspace.data.transactions
      .filter((entry) => flags.some((flag) => flag.transactionId === entry.id && flag.accountId === account.id))
      .reduce((sum, entry) => sum + accountDelta(entry, account.id), account.openingBalance);
    render(
      <MemoryRouter initialEntries={[`/reconcile?account=${account.id}`]}>
        <ReconcilePage />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText('Statement ending balance (€)'), {
      target: { value: String(balance / 100) },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reconcile statement' }));
    await waitFor(() => expect(readDemo().reconciliations).toHaveLength(1));
    expect(readDemo().clearances?.every((entry) => entry.reconciliationId)).toBe(true);
    expect(await screen.findByRole('button', { name: 'Undo latest' })).toBeEnabled();
  });
});

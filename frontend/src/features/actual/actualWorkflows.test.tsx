// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { webcrypto } from 'node:crypto';
import type { BudgetData } from '../../types/budget';
import { createDemoSeed } from '../transactions/demoSeed.constants';
import { writeDemo, readDemo } from '../../lib/storage/demoStore';
import { actualFixture } from '../../../../scripts/actualFixtures';
import { convertActual } from './convertActual';
import { readActualFile } from './actualFile';
import ActualImportPage from '../../pages/ActualImportPage';
const workspace = vi.hoisted(() => ({ data: {} as BudgetData, reload: vi.fn() }));
vi.mock('../../app/config/environment', () => ({ environment: { isDemo: true, apiBaseUrl: '/api/v1' } }));
vi.mock('../../app/WorkspaceContext', () => ({ useWorkspace: () => workspace }));
vi.mock('./actualFile', () => ({ readActualFile: vi.fn() }));
const file = convertActual(actualFixture(), JSON.stringify({ id: 'workflow-fixture', budgetName: 'Workflow fixture' }));
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('crypto', webcrypto);
  workspace.data = createDemoSeed();
  writeDemo(workspace.data);
  workspace.reload.mockImplementation(async () => {
    workspace.data = readDemo();
  });
  vi.mocked(readActualFile).mockResolvedValue(structuredClone(file));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});
/** Render the importer and select a fictional file. Parsing is tested separately against real SQLite.
 * @returns {Promise<void>} File chosen. */
async function choose() {
  render(
    <MemoryRouter>
      <ActualImportPage />
    </MemoryRouter>,
  );
  fireEvent.change(screen.getByLabelText(/Actual Budget export/), {
    target: { files: [new File(['fixture'], 'actual.zip', { type: 'application/zip' })] },
  });
  await screen.findByText('Workflow fixture');
}
/** Consent to the currency and create a read-only review. @returns {Promise<void>} Review ready. */
async function review() {
  fireEvent.click(screen.getByLabelText(/I confirm this budget uses EUR/));
  fireEvent.click(screen.getByRole('button', { name: 'Review import' }));
  await screen.findByRole('button', { name: 'Add reviewed data' });
}
/** Acknowledge the reviewed scope. @returns {void} Confirmation checked. */
function acknowledge() {
  fireEvent.click(screen.getByLabelText(/I reviewed the additions/));
}
describe('native import preview workflow with actual storage and merge logic', () => {
  it('requires both consents and preserves existing financial records and metadata', async () => {
    const before = readDemo();
    await choose();
    expect(screen.getByRole('button', { name: 'Review import' })).toBeDisabled();
    await review();
    expect(readDemo()).toEqual(before);
    expect(screen.getByRole('button', { name: 'Add reviewed data' })).toBeDisabled();
    acknowledge();
    fireEvent.click(screen.getByRole('button', { name: 'Add reviewed data' }));
    await screen.findByText('Your budget has arrived');
    expect(readDemo().transactions.slice(0, before.transactions.length)).toEqual(before.transactions);
    expect(readDemo().transactions).toHaveLength(before.transactions.length + 4);
    expect(readDemo().scheduleSettings?.find((row) => row.recurringId === file.recurring[0]!.id)?.isPaused).toBe(true);
    expect(readDemo().goals).toEqual(before.goals);
  });
  it('offers a complete review download and no second commit for an identical export', async () => {
    await choose();
    await review();
    const create = vi.fn(() => 'blob:review');
    const revoke = vi.fn();
    URL.createObjectURL = create;
    URL.revokeObjectURL = revoke;
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    fireEvent.click(screen.getByRole('button', { name: 'Download complete review' }));
    expect(create.mock.calls[0]![0].size).toBeGreaterThan(0);
    expect(click).toHaveBeenCalled();
    acknowledge();
    fireEvent.click(screen.getByRole('button', { name: 'Add reviewed data' }));
    await screen.findByText('Your budget has arrived');
    cleanup();
    await choose();
    fireEvent.click(screen.getByLabelText(/I confirm this budget uses EUR/));
    fireEvent.click(screen.getByRole('button', { name: 'Review import' }));
    await screen.findByText('This export is already here');
    expect(screen.queryByRole('button', { name: 'Add reviewed data' })).not.toBeInTheDocument();
  });
  it('invalidates a review when scope changes and omits optional schedules, links and allocations', async () => {
    await choose();
    await review();
    fireEvent.click(screen.getByLabelText(/Include monthly allocations/));
    expect(screen.queryByRole('button', { name: 'Add reviewed data' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Include supported schedules/));
    fireEvent.click(screen.getByRole('button', { name: 'Review import' }));
    await screen.findByRole('button', { name: 'Add reviewed data' });
    acknowledge();
    const before = readDemo();
    fireEvent.click(screen.getByRole('button', { name: 'Add reviewed data' }));
    await screen.findByText('Your budget has arrived');
    expect(readDemo().recurring).toEqual(before.recurring);
    expect(readDemo().monthlyBudgets).toEqual(before.monthlyBudgets ?? []);
    expect(
      readDemo()
        .transactions.slice(before.transactions.length)
        .every((row) => !row.recurringId),
    ).toBe(true);
  });
  it('rejects a workspace edit made after review without losing it or adding partial records', async () => {
    await choose();
    await review();
    const changed = readDemo();
    changed.transactions[0]!.notes = 'Late edit';
    writeDemo(changed);
    acknowledge();
    fireEvent.click(screen.getByRole('button', { name: 'Add reviewed data' }));
    await screen.findByText('The workspace changed. Review this import again.');
    expect(readDemo()).toEqual(changed);
  });
  it('preserves storage on quota failure and permits a fresh reviewed retry', async () => {
    await choose();
    await review();
    const before = readDemo();
    const storage = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new Error('Quota full');
    });
    acknowledge();
    fireEvent.click(screen.getByRole('button', { name: 'Add reviewed data' }));
    await screen.findByText('Quota full');
    expect(readDemo()).toEqual(before);
    storage.mockRestore();
    fireEvent.click(screen.getByRole('button', { name: 'Review import' }));
    await screen.findByRole('button', { name: 'Add reviewed data' });
    acknowledge();
    fireEvent.click(screen.getByRole('button', { name: 'Add reviewed data' }));
    await screen.findByText('Your budget has arrived');
  });
  it('allows cancellation and ignores an old worker result', async () => {
    let finish: (value: typeof file) => void = () => undefined;
    vi.mocked(readActualFile).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    render(
      <MemoryRouter>
        <ActualImportPage />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText(/Actual Budget export/), {
      target: { files: [new File(['x'], 'old.zip')] },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel reading' }));
    finish(file);
    await waitFor(() => expect(screen.getByLabelText(/Actual Budget export/)).toBeEnabled());
    expect(screen.queryByText('Workflow fixture')).not.toBeInTheDocument();
  });
});

// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { webcrypto } from 'node:crypto';
import type { BudgetData } from '../../types/budget';
import { createDemoSeed } from '../transactions/demoSeed.constants';
import { writeDemo, readDemo } from '../../lib/storage/demoStore';
import { actualFixture, actualMigrationFixture } from '../../../../scripts/actualFixtures';
import { actualPlan, mergeActual } from './actualMerge';
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
  it('shows approximate recurring amounts before acknowledgment and persists them paused', async () => {
    const source = actualFixture();
    const conditions = JSON.parse(String(source.rules[0]!.conditions));
    conditions[2].op = 'isapprox';
    conditions[3].op = 'isapprox';
    source.rules[0]!.conditions = JSON.stringify(conditions);
    vi.mocked(readActualFile).mockResolvedValueOnce(
      convertActual(source, JSON.stringify({ id: 'approx-workflow', budgetName: 'Workflow fixture' })),
    );
    await choose();
    await review();
    expect(screen.getByText('1 recurring transactions to add · all paused')).toBeInTheDocument();
    expect(screen.getByText(/Actual approximate amount:.*fixed estimate/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add reviewed data' })).toBeDisabled();
    acknowledge();
    fireEvent.click(screen.getByRole('button', { name: 'Add reviewed data' }));
    await screen.findByText('Your budget has arrived');
    expect(screen.getByRole('link', { name: 'Review them in Recurring' })).toHaveAttribute('href', '/recurring');
    const recurring = readDemo().recurring.find((row) => row.name === 'Rent' && row.notes.includes('fixed estimate'))!;
    expect(recurring.amount).toBe(300);
    expect(readDemo().scheduleSettings?.find((row) => row.recurringId === recurring.id)?.isPaused).toBe(true);
  });
  it('reports source compatibility separately from schedule selection and warns about off-date payments', async () => {
    vi.mocked(readActualFile).mockResolvedValueOnce(
      convertActual(
        actualMigrationFixture(),
        JSON.stringify({
          id: 'workflow-mixture',
          budgetName: 'Workflow fixture',
        }),
      ),
    );
    await choose();
    expect(screen.getByRole('status')).toHaveTextContent('15 of 15 schedules supported');
    expect(screen.getByRole('status')).toHaveTextContent('15 schedules selected');
    expect(screen.getByRole('status')).toHaveTextContent('6 supported schedules have a final payment date');
    expect(screen.getByRole('status')).toHaveTextContent('13 historical payments match');
    expect(screen.getByText(/ordinary transactions: 3/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Include supported schedules/));
    expect(screen.getByRole('status')).toHaveTextContent('15 of 15 schedules supported');
    expect(screen.getByRole('status')).toHaveTextContent('0 schedules selected');
    expect(screen.getByText(/Schedules excluded by your choice/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Include supported schedules/));
    await review();
    expect(screen.getByText('15 recurring transactions to add · all paused')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add reviewed data' })).toBeDisabled();
  });
  it('counts legacy payments whose existing null schedule links are preserved during an upgrade', async () => {
    const converted = convertActual(
      actualMigrationFixture(),
      JSON.stringify({
        id: 'workflow-mixture',
        budgetName: 'Workflow fixture',
      }),
    );
    const legacy = {
      ...converted,
      recurring: [],
      scheduleSettings: [],
      transactions: converted.transactions.map((row) => ({ ...row, recurringId: null })),
    };
    const target = readDemo();
    const existing = mergeActual(target, actualPlan(target, legacy).rows);
    writeDemo(existing);
    workspace.data = existing;
    vi.mocked(readActualFile).mockResolvedValueOnce(converted);
    await choose();
    await review();
    expect(screen.getByText(/13 previously imported payments remain unlinked/)).toBeInTheDocument();
    expect(screen.getByText('15 recurring transactions to add · all paused')).toBeInTheDocument();
    acknowledge();
    fireEvent.click(screen.getByRole('button', { name: 'Add reviewed data' }));
    await screen.findByText('Your budget has arrived');
    expect(readDemo().transactions).toEqual(existing.transactions);
    expect(readDemo().recurring.length).toBe(existing.recurring.length + 15);
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
  it('downloads failed rules without import or transaction history', async () => {
    const source = actualFixture();
    const conditions = JSON.parse(String(source.rules[0]!.conditions));
    conditions[2].value = { ...conditions[2].value, interval: 2, endMode: 'never', endOccurrences: 1 };
    source.rules[0]!.conditions = JSON.stringify(conditions);
    vi.mocked(readActualFile).mockResolvedValueOnce(
      convertActual(source, JSON.stringify({ id: 'workflow-fixture', budgetName: 'Workflow fixture' })),
    );
    await choose();
    expect(screen.getByText('Actual importer 1.10.2')).toBeInTheDocument();
    expect(screen.getByText(/Schedule date.interval/)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('0 of 1 schedules supported');
    expect(screen.queryByText('No schedules require manual recreation.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review import' })).toBeDisabled();
    const create = vi.fn(() => 'blob:diagnostic');
    URL.createObjectURL = create;
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const reader = new FileReader();
    const loaded = new Promise<string>((resolve) => {
      reader.onload = () => resolve(String(reader.result));
    });
    fireEvent.click(screen.getByRole('button', { name: 'Download schedule diagnostics' }));
    reader.readAsText(create.mock.calls[0]![0]);
    const report = JSON.parse(await loaded);
    expect(click).toHaveBeenCalledOnce();
    expect(report.format).toBe('folio-actual-schedule-diagnostics');
    expect(report.importerVersion).toBe('1.10.2');
    expect(report.schedules[0].source.conditions[2].value.interval).toBe(2);
    expect(report.transactions).toBeUndefined();
    expect(Object.keys(report.schedules[0].source)).not.toContain('transactions');
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

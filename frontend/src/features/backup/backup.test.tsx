// @vitest-environment jsdom
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { createDemoSeed } from '../transactions/demoSeed.constants';
import { writeDemo, readDemo } from '../../lib/storage/demoStore';
import { parseBackup, restoreBackup, exportBackup } from './backupService';
import { BackupRestore } from './BackupRestore';
import { saveReceipt } from '../receipts/receiptService';
import { APP } from '../../constants/app.constants';
import type { BudgetData } from '../../types/budget';
const workspace = vi.hoisted(() => ({ data: {} as BudgetData, reload: vi.fn(), setNotice: vi.fn() }));
vi.mock('../../app/config/environment', () => ({ environment: { isDemo: true, apiBaseUrl: '/api/v1' } }));
vi.mock('../../app/WorkspaceContext', () => ({ useWorkspace: () => workspace }));
beforeEach(() => {
  localStorage.clear();
  workspace.data = createDemoSeed();
  writeDemo(workspace.data);
  workspace.reload.mockImplementation(async () => {
    workspace.data = readDemo();
  });
  workspace.setNotice.mockClear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});
/** Clone the fictional workspace for a mutable validation fixture.
 * @returns {ReturnType<typeof createDemoSeed>} Copy. */
function seed() {
  return structuredClone(createDemoSeed());
}
/** Select an actual browser File in the import control. @param {string} text - JSON payload.
 * @returns {void} File selection event. */
function select(text: string) {
  fireEvent.change(screen.getByLabelText('Review a preview backup'), {
    target: { files: [new File([text], 'folio.json', { type: 'application/json' })] },
  });
}
describe('portable preview backups', () => {
  it('accepts legacy raw exports and round-trips versioned backups with receipt bytes', async () => {
    const [source] = readDemo().transactions;
    if (!source) {
      throw new Error('Missing posting');
    }
    const bytes = '%PDF-1.4\nReceipt';
    await saveReceipt(source.id, {
      id: crypto.randomUUID(),
      name: 'receipt.pdf',
      mimeType: 'application/pdf',
      size: bytes.length,
      content: btoa(bytes),
    });
    const text = await exportBackup();
    const parsed = parseBackup(text);
    expect(parsed.receipts[0]?.content).toBe(btoa(bytes));
    expect(parseBackup(JSON.stringify(seed())).transactions).toHaveLength(seed().transactions.length);
    const previous = localStorage.getItem(APP.storageKey);
    restoreBackup(parsed, previous);
    expect(readDemo().receipts).toHaveLength(1);
  });
  it('rejects malformed JSON, unsupported versions, invalid amounts, duplicate IDs and missing account links', () => {
    expect(() => parseBackup('{')).toThrow('not valid JSON');
    expect(() =>
      parseBackup(
        JSON.stringify({ format: 'folio-workspace', version: 99, exportedAt: new Date().toISOString(), data: seed() }),
      ),
    ).toThrow('not supported');
    for (const change of ['amount', 'duplicate', 'account', 'transfer'] as const) {
      const data = seed();
      const [entry] = data.transactions;
      if (!entry) {
        throw new Error('Missing posting');
      }
      if (change === 'amount') {
        entry.amount = -1;
      }
      if (change === 'duplicate') {
        data.transactions.push({ ...entry });
      }
      if (change === 'account') {
        entry.accountId = crypto.randomUUID();
      }
      if (change === 'transfer') {
        entry.type = 'transfer';
        entry.destinationAccountId = entry.accountId;
      }
      expect(() => parseBackup(JSON.stringify(data))).toThrow();
    }
  });
  it('validates goals, statement locks, import identities and attachment references', () => {
    const data = parseBackup(JSON.stringify(seed()));
    data.contributions.push({
      id: crypto.randomUUID(),
      goalId: crypto.randomUUID(),
      amount: 100,
      date: '2026-10-16',
      notes: '',
      createdAt: 1,
    });
    expect(() => parseBackup(JSON.stringify(data))).toThrow();
    data.contributions = [];
    const [entry] = data.transactions;
    if (!entry) {
      throw new Error('Missing posting');
    }
    data.clearances.push({
      transactionId: entry.id,
      accountId: entry.accountId,
      reconciliationId: crypto.randomUUID(),
    });
    expect(() => parseBackup(JSON.stringify(data))).toThrow();
    data.clearances = [];
    data.importLinks.push({ fingerprint: 'damaged', transactionId: entry.id });
    expect(() => parseBackup(JSON.stringify(data))).toThrow();
    data.importLinks = [];
    const bytes = '%PDF-1.4\nFixture';
    data.receipts.push({
      id: crypto.randomUUID(),
      transactionId: crypto.randomUUID(),
      name: 'file.pdf',
      size: bytes.length,
      mimeType: 'application/pdf',
      content: btoa(bytes),
      createdAt: 1,
    });
    expect(() => parseBackup(JSON.stringify(data))).toThrow();
  });
  it('accepts reconciled history and rejects a mismatching statement balance', () => {
    const data = parseBackup(JSON.stringify(seed()));
    data.transactions = data.transactions.filter((entry) => entry.type === 'expense').slice(0, 1);
    const [entry] = data.transactions;
    const account = data.accounts.find((row) => row.id === entry?.accountId);
    if (!entry || !account) {
      throw new Error('Missing posting');
    }
    const statement = {
      id: crypto.randomUUID(),
      accountId: account.id,
      date: entry.date,
      statementBalance: account.openingBalance - entry.amount,
      createdAt: 1,
    };
    data.reconciliations = [statement];
    data.clearances = [{ transactionId: entry.id, accountId: account.id, reconciliationId: statement.id }];
    expect(parseBackup(JSON.stringify(data)).reconciliations).toHaveLength(1);
    statement.statementBalance += 1;
    expect(() => parseBackup(JSON.stringify(data))).toThrow('does not match');
  });
  it('requires explicit replacement after a read-only review and supports cancellation', async () => {
    const source = seed();
    source.transactions = [];
    source.recurring = [];
    const before = localStorage.getItem(APP.storageKey);
    render(<BackupRestore />);
    select(JSON.stringify(source));
    await screen.findByRole('button', { name: 'Replace preview workspace' });
    expect(localStorage.getItem(APP.storageKey)).toBe(before);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel restore' }));
    expect(screen.queryByRole('button', { name: 'Replace preview workspace' })).not.toBeInTheDocument();
    select(JSON.stringify(source));
    await screen.findByRole('button', { name: 'Replace preview workspace' });
    fireEvent.click(screen.getByRole('button', { name: 'Replace preview workspace' }));
    await waitFor(() => expect(readDemo().transactions).toHaveLength(0));
    expect(workspace.setNotice).toHaveBeenCalledWith('Preview workspace restored.');
  });
  it('rejects stale reviews and preserves storage when the browser refuses a replacement', () => {
    const data = parseBackup(JSON.stringify(seed()));
    const previous = localStorage.getItem(APP.storageKey);
    writeDemo({ ...readDemo(), budgets: [] });
    const changed = localStorage.getItem(APP.storageKey);
    expect(() => restoreBackup(data, previous)).toThrow('preview changed');
    expect(localStorage.getItem(APP.storageKey)).toBe(changed);
    const writing = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Quota exceeded');
    });
    expect(() => restoreBackup(data, changed)).toThrow('Quota');
    writing.mockRestore();
    expect(localStorage.getItem(APP.storageKey)).toBe(changed);
  });
  it('keeps an invalid uploaded backup out of the review state', async () => {
    const previous = localStorage.getItem(APP.storageKey);
    render(<BackupRestore />);
    select('{broken');
    expect(await screen.findByRole('alert')).toHaveTextContent('not valid JSON');
    expect(screen.queryByRole('button', { name: 'Replace preview workspace' })).not.toBeInTheDocument();
    expect(localStorage.getItem(APP.storageKey)).toBe(previous);
  });
});

// @vitest-environment jsdom
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import type { BudgetData } from '../../types/budget';
import { createDemoSeed } from '../transactions/demoSeed.constants';
import { readDemo, writeDemo } from '../../lib/storage/demoStore';
import { ReceiptAttachments } from './ReceiptAttachments';
import { saveReceipt } from './receiptService';
const workspace = vi.hoisted(() => ({ data: {} as BudgetData, isSaving: false }));
vi.mock('../../app/config/environment', () => ({ environment: { isDemo: true, apiBaseUrl: '/api/v1' } }));
vi.mock('../../app/WorkspaceContext', () => ({ useWorkspace: () => workspace }));
const bytes = '%PDF-1.4\nSupporting receipt';
let transactionId: string;
beforeEach(() => {
  localStorage.clear();
  workspace.data = createDemoSeed();
  writeDemo(workspace.data);
  transactionId = workspace.data.transactions[0]?.id ?? '';
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:receipt') });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});
/** Select a real browser file through the UI. @param {File} file - Local fixture.
 * @returns {void} File selection event. */
function select(file: File) {
  fireEvent.change(screen.getByLabelText('Choose receipt'), { target: { files: [file] } });
}
describe('receipt interactions with durable preview storage', () => {
  it('uploads, downloads and removes a receipt without changing any transaction amounts', async () => {
    render(<ReceiptAttachments transactionId={transactionId} />);
    await screen.findByText('No attachments yet.');
    select(new File([bytes], 'market.pdf', { type: 'application/pdf' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Attach file' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Attach file' }));
    await screen.findByText('market.pdf');
    expect(readDemo().receipts?.[0]?.content).toBe(btoa(bytes));
    fireEvent.click(screen.getByRole('button', { name: 'Download' }));
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Remove market.pdf' })).toBeEnabled());
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Remove market.pdf' }));
    await waitFor(() => expect(readDemo().receipts).toHaveLength(0));
    expect(readDemo().transactions).toEqual(workspace.data.transactions);
  });
  it('preserves a failed upload for retry when storage rejects the write', async () => {
    render(<ReceiptAttachments transactionId={transactionId} />);
    await screen.findByText('No attachments yet.');
    select(new File([bytes], 'retry.pdf', { type: 'application/pdf' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Attach file' })).toBeEnabled());
    const writing = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new Error('Storage full');
    });
    fireEvent.click(screen.getByRole('button', { name: 'Attach file' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Storage full');
    expect(readDemo().receipts ?? []).toHaveLength(0);
    writing.mockRestore();
    fireEvent.click(screen.getByRole('button', { name: 'Attach file' }));
    await screen.findByText('retry.pdf');
    expect(readDemo().receipts).toHaveLength(1);
  });
  it('rejects unsupported files before writing and preserves a protected statement attachment', async () => {
    render(<ReceiptAttachments transactionId={transactionId} />);
    await screen.findByText('No attachments yet.');
    select(new File(['<html>file'], 'file.html', { type: 'text/html' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('PNG, JPEG or PDF');
    expect(readDemo().receipts ?? []).toHaveLength(0);
    cleanup();
    await saveReceipt(transactionId, {
      id: crypto.randomUUID(),
      name: 'locked.pdf',
      mimeType: 'application/pdf',
      size: bytes.length,
      content: btoa(bytes),
    });
    workspace.data.clearances = [
      { transactionId, accountId: workspace.data.accounts[0]?.id ?? '', reconciliationId: crypto.randomUUID() },
    ];
    render(<ReceiptAttachments transactionId={transactionId} />);
    await screen.findByText('locked.pdf');
    expect(screen.queryByLabelText('Choose receipt')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove locked.pdf' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Download' })).toBeEnabled();
  });
});

import { environment } from '../../app/config/environment';
import { request } from '../../lib/api/client';
import { readDemo, writeDemo } from '../../lib/storage/demoStore';
import type { Receipt, ReceiptMetadata, ReceiptInput } from '../../types/receipts';
import { receiptInputSchema } from './receiptValidation';
import { RECEIPT } from './receipt.constants';
/** Protect historical evidence before a preview mutation. @param {string} id - Posting ID.
 * @param {ReturnType<typeof readDemo>} data - Fresh workspace. @returns {void} Lock validation. */
function requireEditable(id: string, data: ReturnType<typeof readDemo>) {
  if (!data.transactions.some((entry) => entry.id === id)) {
    throw new Error('This transaction no longer exists.');
  }
  if (data.clearances?.some((entry) => entry.transactionId === id && entry.reconciliationId)) {
    throw new Error('Undo the latest statement reconciliation before changing attachments.');
  }
}
/** Load only metadata for the current posting. @param {string} transactionId - Posting UUID.
 * @returns {Promise<ReceiptMetadata[]>} Document list. */
export async function listReceipts(transactionId: string): Promise<ReceiptMetadata[]> {
  return environment.isDemo
    ? (readDemo().receipts ?? [])
        .filter((entry) => entry.transactionId === transactionId)
        .map(({ content: _content, ...metadata }) => metadata)
    : request(`/transactions/${transactionId}${RECEIPT.path}`);
}
/** Persist an acknowledged upload with a stable ID. @param {string} transactionId - Posting UUID.
 * @param {ReceiptInput} value - Encoded upload. @returns {Promise<void>} Durable completion. */
export async function saveReceipt(transactionId: string, value: ReceiptInput): Promise<void> {
  const parsed = receiptInputSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error('Choose a valid PNG, JPEG or PDF file of up to 512 KiB.');
  }
  const input = parsed.data;
  if (!environment.isDemo) {
    await request(`/transactions/${transactionId}${RECEIPT.path}`, { method: 'POST', body: JSON.stringify(input) });
    return;
  }
  const data = readDemo();
  const entries = data.receipts ?? [];
  const previous = entries.find((entry) => entry.id === input.id);
  if (previous) {
    if (
      previous.transactionId !== transactionId ||
      previous.content !== input.content ||
      previous.name !== input.name ||
      previous.mimeType !== input.mimeType ||
      previous.size !== input.size
    ) {
      throw new Error('Use a new upload ID for a different file.');
    }
    return;
  }
  requireEditable(transactionId, data);
  if (
    entries.filter((entry) => entry.transactionId === transactionId).length >= RECEIPT.perTransaction ||
    entries.reduce((sum, entry) => sum + entry.size, 0) + input.size > RECEIPT.previewBytes
  ) {
    throw new Error('Keep up to 5 attachments per transaction and 2 MiB in this preview.');
  }
  data.receipts = [...entries, { ...input, transactionId, createdAt: Date.now() }];
  writeDemo(data);
}
/** Read one file only when the user downloads it. @param {string} id - Receipt UUID.
 * @returns {Promise<Receipt>} File bytes and metadata. */
export async function getReceipt(id: string): Promise<Receipt> {
  if (!environment.isDemo) {
    return request(`${RECEIPT.path}/${id}`);
  }
  const entry = readDemo().receipts?.find((row) => row.id === id);
  if (!entry) {
    throw new Error('This attachment no longer exists.');
  }
  return entry;
}
/** Delete one unlocked supporting file. @param {string} id - Receipt UUID. @returns {Promise<void>} Durable removal. */
export async function removeReceipt(id: string): Promise<void> {
  if (!environment.isDemo) {
    await request(`${RECEIPT.path}/${id}`, { method: 'DELETE' });
    return;
  }
  const data = readDemo();
  const entry = data.receipts?.find((row) => row.id === id);
  if (!entry) {
    throw new Error('This attachment no longer exists.');
  }
  requireEditable(entry.transactionId, data);
  data.receipts = data.receipts?.filter((row) => row.id !== id);
  writeDemo(data);
}

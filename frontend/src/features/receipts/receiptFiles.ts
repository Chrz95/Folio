import type { ReceiptInput, Receipt } from '../../types/receipts';
import { RECEIPT } from './receipt.constants';
/** Read a bounded user-selected file without uploading its original path.
 * @param {File} file - Local receipt. @returns {Promise<ReceiptInput>} Retry-safe encoded upload. */
export async function encodeReceipt(file: File): Promise<ReceiptInput> {
  if (file.size > RECEIPT.fileBytes || !['image/png', 'image/jpeg', 'application/pdf'].includes(file.type)) {
    throw new Error('Choose a PNG, JPEG or PDF file of up to 512 KiB.');
  }
  const content = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(new Error('This file could not be read.'));
    reader.readAsDataURL(file);
  });
  return {
    id: crypto.randomUUID(),
    name: file.name,
    mimeType: file.type as ReceiptInput['mimeType'],
    size: file.size,
    content,
  };
}
/** Download bytes without embedding untrusted documents in the page.
 * @param {Receipt} receipt - Acknowledged file. @returns {void} User-initiated download. */
export function downloadReceipt(receipt: Receipt) {
  const bytes = Uint8Array.from(atob(receipt.content), (character) => character.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = receipt.name;
  link.click();
  URL.revokeObjectURL(url);
}

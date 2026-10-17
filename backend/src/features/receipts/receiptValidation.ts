import { z } from 'zod';
import { RECEIPT } from './receipt.constants.js';
/** Verify canonical base64, byte length and an allowed file signature before storage.
 * @param {object} input - Receipt. @param {string} input.content - Base64 bytes.
 * @param {number} input.size - Declared bytes. @param {string} input.mimeType - Allowed media type.
 * @returns {boolean} Whether the payload matches its declared format. */
function isContentValid(input: { content: string; size: number; mimeType: string }): boolean {
  if (input.content.length > RECEIPT.base64Length) {
    return false;
  }
  try {
    const bytes = atob(input.content);
    const prefix =
      input.mimeType === 'image/png' ? RECEIPT.png : input.mimeType === 'image/jpeg' ? RECEIPT.jpeg : RECEIPT.pdf;
    return bytes.length === input.size && btoa(bytes) === input.content && bytes.startsWith(prefix);
  } catch {
    return false;
  }
}
/** Reject path separators and control characters in portable download names.
 * @param {string} name - Display filename. @returns {boolean} Whether the name is safe to download. */
function isFilenameValid(name: string): boolean {
  return (
    !name.includes('/') &&
    !name.includes('\\') &&
    Array.from(name).every(
      (character) =>
        character.charCodeAt(0) >= RECEIPT.firstPrintable && character.charCodeAt(0) !== RECEIPT.deleteCharacter,
    )
  );
}
export const receiptInputSchema = z
  .object({
    id: z.uuid(),
    name: z.string().trim().min(1).max(RECEIPT.nameLength).refine(isFilenameValid),
    mimeType: z.enum(['image/png', 'image/jpeg', 'application/pdf']),
    size: z.number().int().positive().max(RECEIPT.fileBytes),
    content: z.string().max(RECEIPT.base64Length),
  })
  .strict()
  .refine(isContentValid, 'Choose a valid PNG, JPEG or PDF file of up to 512 KiB.');
export type ReceiptInput = z.infer<typeof receiptInputSchema>;

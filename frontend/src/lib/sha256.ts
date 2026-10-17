import { sha256Fallback } from './sha256Fallback';
const HEX = { radix: 16, width: 2 };
/** Hash a review snapshot on HTTPS or local HTTP without persisting the underlying private values.
 * @param {string} text - Canonical snapshot. @returns {Promise<string>} Standard SHA-256 hexadecimal revision. */
export async function sha256(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const subtle = globalThis.crypto?.subtle;
  const hash = subtle ? new Uint8Array(await subtle.digest('SHA-256', bytes)) : sha256Fallback(bytes);
  return [...hash].map((byte) => byte.toString(HEX.radix).padStart(HEX.width, '0')).join('');
}

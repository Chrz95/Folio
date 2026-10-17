import { ACTUAL } from './actual.constants';
import { actualFileSchema } from './actualSchema';
import type { ActualFile } from './actualSchema';
/** Read a selected native ZIP with cancellation, time and memory bounds.
 * @param {File} file - Explicit user file. @param {AbortSignal} signal - Selection lifetime.
 * @returns {Promise<ActualFile>} Validated data; no storage writes. */
export async function readActualFile(file: File, signal: AbortSignal): Promise<ActualFile> {
  if (!file.name.toLowerCase().endsWith('.zip') || file.size > ACTUAL.zipBytes) {
    throw new Error('Choose an Actual export ZIP of up to 25 MiB.');
  }
  const bytes = await file.arrayBuffer();
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./actual.worker.ts', import.meta.url), { type: 'module' });
    /** Release all worker resources exactly once. @returns {void} Cleanup. */
    function cleanup() {
      worker.terminate();
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
    }
    /** Cancel an old selection. @returns {void} Rejected read. */
    function abort() {
      cleanup();
      reject(new Error('Reading cancelled.'));
    }
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Reading timed out. Choose a smaller export.'));
    }, ACTUAL.timeout);
    signal.addEventListener('abort', abort, { once: true });
    worker.onerror = () => {
      cleanup();
      reject(new Error('Unable to read this Actual export.'));
    };
    worker.onmessage = (event: MessageEvent<{ file?: unknown; error?: string }>) => {
      cleanup();
      const parsed = actualFileSchema.safeParse(event.data.file);
      if (parsed.success) {
        resolve(parsed.data);
      } else {
        reject(new Error(event.data.error || 'The Actual export contains unsupported values.'));
      }
    };
    worker.postMessage(bytes, [bytes]);
  });
}

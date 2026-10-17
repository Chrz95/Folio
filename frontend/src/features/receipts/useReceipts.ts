import { useState, useEffect } from 'react';
import type { ReceiptMetadata, ReceiptInput } from '../../types/receipts';
import { listReceipts, saveReceipt, getReceipt, removeReceipt } from './receiptService';
import { encodeReceipt, downloadReceipt } from './receiptFiles';
/** Load metadata and keep failed upload IDs available for safe retries.
 * @param {string} transactionId - Saved actual posting UUID. @returns {object} Receipt interaction state. */
export function useReceipts(transactionId: string) {
  const [entries, setEntries] = useState<ReceiptMetadata[]>([]);
  const [pending, setPending] = useState<ReceiptInput | null>(null);
  const [fileKey, setFileKey] = useState(() => crypto.randomUUID());
  const [isBusy, setBusy] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    listReceipts(transactionId)
      .then((rows) => {
        if (active) {
          setEntries(rows);
        }
      })
      .catch((failure: Error) => {
        if (active) {
          setError(failure.message);
        }
      })
      .finally(() => {
        if (active) {
          setBusy(false);
        }
      });
    return () => {
      active = false;
    };
  }, [transactionId]);
  /** Keep async failures visible next to the supporting documents.
   * @param {() => Promise<void>} action - File operation. @returns {Promise<void>} Feedback and metadata refresh. */
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await action();
      setEntries(await listReceipts(transactionId));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to update attachments.');
    } finally {
      setBusy(false);
    }
  }
  /** Prepare a newly selected file. @param {File | undefined} file - Browser selection.
   * @returns {Promise<void>} Encoded pending upload. */
  async function choose(file?: File) {
    setPending(null);
    if (file) {
      await run(async () => {
        setPending(await encodeReceipt(file));
      });
    }
  }
  /** Upload the same request UUID until acknowledgment. @returns {Promise<void>} Durable attachment. */
  async function upload() {
    if (!pending) {
      return;
    }
    await run(async () => {
      await saveReceipt(transactionId, pending);
      setPending(null);
      setFileKey(crypto.randomUUID());
    });
  }
  /** Download a selected file. @param {string} id - Receipt UUID.
   * @returns {Promise<void>} Download or visible failure. */
  async function download(id: string) {
    await run(async () => downloadReceipt(await getReceipt(id)));
  }
  /** Remove a file after an explicit confirmation. @param {string} id - Receipt UUID.
   * @returns {Promise<void>} Durable deletion. */
  async function remove(id: string) {
    if (window.confirm('Remove this attachment? The transaction will remain.')) {
      await run(() => removeReceipt(id));
    }
  }
  return { entries, pending, fileKey, isBusy, error, choose, upload, download, remove };
}
export type ReceiptState = ReturnType<typeof useReceipts>;

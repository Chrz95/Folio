import { useState } from 'react';
import { useWorkspace } from '../../app/WorkspaceContext';
import { parseBackup, restoreBackup } from './backupService';
import type { RestorableWorkspace } from './backupSchema';
import { BACKUP } from './backup.constants';
import { APP } from '../../constants/app.constants';
/** Stage a file without writes and require an explicit reviewed replacement action.
 * @returns {object} Backup review state and actions. */
export function useBackupRestore() {
  const { reload, setNotice } = useWorkspace();
  const [reviewed, setReviewed] = useState<RestorableWorkspace | null>(null);
  const [previous, setPrevious] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [isBusy, setBusy] = useState(false);
  /** Validate a bounded browser-selected JSON file. @param {File | undefined} file - Backup file.
   * @returns {Promise<void>} Read-only review. */
  async function choose(file?: File) {
    setReviewed(null);
    setError('');
    if (!file) {
      return;
    }
    setBusy(true);
    try {
      if (file.size > BACKUP.maximumBytes) {
        throw new Error('Choose a workspace backup of up to 8 MiB.');
      }
      const text = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('This backup could not be read.'));
        reader.readAsText(file);
      });
      const next = parseBackup(text);
      setPrevious(localStorage.getItem(APP.storageKey));
      setReviewed(next);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to read this backup.');
    } finally {
      setBusy(false);
    }
  }
  /** Commit only the currently reviewed replacement. @returns {Promise<void>} Updated preview and feedback. */
  async function restore() {
    if (!reviewed || isBusy) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      restoreBackup(reviewed, previous);
      setReviewed(null);
      await reload();
      setNotice('Preview workspace restored.');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to restore. Storage was not updated.');
    } finally {
      setBusy(false);
    }
  }
  /** Discard a review without touching stored data. @returns {void} Clears review state. */
  function cancel() {
    setReviewed(null);
  }
  return { reviewed, error, isBusy, choose, restore, cancel };
}

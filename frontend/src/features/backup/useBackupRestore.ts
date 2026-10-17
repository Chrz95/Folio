import { useEffect, useRef, useState } from 'react';
import { useWorkspace } from '../../app/WorkspaceContext';
import { environment } from '../../app/config/environment';
import { parseBackup } from './backupService';
import type { RestorableWorkspace } from './backupSchema';
import { reviewWorkspace, importWorkspace } from './workspaceImportService';
import type { WorkspaceImportReview } from './workspaceImportPlan';
import { BACKUP } from './backup.constants';
/** Stage a source, review exact counts and explicitly acknowledge the replacement before any write.
 * @returns {object} File import workflow. */
export function useBackupRestore() {
  const { data, reload, setNotice } = useWorkspace();
  const [staged, setStaged] = useState<{
    source: RestorableWorkspace;
    review: WorkspaceImportReview;
    workspace: typeof data;
  } | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState('');
  const [isBusy, setBusy] = useState(false);
  const sequence = useRef(0);
  useEffect(
    () => () => {
      sequence.current += 1;
    },
    [],
  );
  const reviewed = staged?.workspace === data ? staged : null;
  /** Validate a bounded explicit file and bind its review to the latest selection and workspace.
   * @param {File | undefined} file - Source JSON. @returns {Promise<void>} Read-only review. */
  async function choose(file?: File) {
    const selection = ++sequence.current;
    setStaged(null);
    setAcknowledged(false);
    setError('');
    if (!file) {
      setBusy(false);
      return;
    }
    setBusy(true);
    try {
      const maximum = environment.isDemo ? BACKUP.maximumBytes : BACKUP.maximumServerBytes;
      if (file.size > maximum) {
        throw new Error('The workspace backup exceeds this destination’s import limit.');
      }
      const text = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('This backup could not be read.'));
        reader.readAsText(file);
      });
      const source = parseBackup(text);
      const review = await reviewWorkspace(source);
      if (sequence.current === selection) {
        setStaged({ source, review, workspace: data });
      }
    } catch (failure) {
      if (sequence.current === selection) {
        setError(failure instanceof Error ? failure.message : 'Unable to read this backup.');
      }
    } finally {
      if (sequence.current === selection) {
        setBusy(false);
      }
    }
  }
  /** Replace only the current acknowledged financial workspace.
   * @returns {Promise<void>} Durable save feedback, distinguishing refresh failures. */
  async function restore() {
    if (!reviewed || !acknowledged || isBusy) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      await importWorkspace(reviewed.source, reviewed.review.revision);
      setStaged(null);
      setAcknowledged(false);
      setNotice('Workspace imported. Imported schedules are paused until you resume them.');
      try {
        await reload();
      } catch {
        setError('Import saved. Refresh the page to load the updated workspace.');
      }
    } catch (failure) {
      setStaged(null);
      setAcknowledged(false);
      setError(failure instanceof Error ? failure.message : 'Unable to import. Storage was not updated.');
    } finally {
      setBusy(false);
    }
  }
  /** Discard pending file results without changing storage. @returns {void} Cancelled review. */
  function cancel() {
    sequence.current += 1;
    setStaged(null);
    setAcknowledged(false);
    setBusy(false);
  }
  return { reviewed, acknowledged, setAcknowledged, error, isBusy, choose, restore, cancel };
}
export type WorkspaceImporter = ReturnType<typeof useBackupRestore>;

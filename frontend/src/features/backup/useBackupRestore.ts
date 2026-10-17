import { useEffect, useRef, useState } from 'react';
import { useWorkspace } from '../../app/WorkspaceContext';
import { environment } from '../../app/config/environment';
import { parseBackup } from './backupService';
import type { RestorableWorkspace } from './backupSchema';
import { reviewWorkspace, importWorkspace } from './workspaceImportService';
import type { WorkspaceImportReview } from './workspaceImportPlan';
import { BACKUP } from './backup.constants';
/** Stage either a selected JSON file or a converted Actual source, bound to its current selection and workspace.
 * @param {unknown} identity - Optional live source identity. @param {boolean} enabled - Current import consent.
 * @returns {object} Reviewed overwrite workflow. */
export function useBackupRestore(identity?: unknown, enabled = true) {
  const { data, reload, setNotice } = useWorkspace();
  const [staged, setStaged] = useState<{
    source: RestorableWorkspace;
    review: WorkspaceImportReview;
    workspace: typeof data;
    identity: unknown;
  } | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [isBusy, setBusy] = useState(false);
  const [completed, setCompleted] = useState<{ identity: unknown } | null>(null);
  const didReplace = completed !== null && completed.identity === identity && enabled;
  const sequence = useRef(0);
  useEffect(
    () => () => {
      sequence.current += 1;
    },
    [],
  );
  const reviewed = staged?.workspace === data && staged.identity === identity && enabled ? staged : null;
  /** Load and validate a source before requesting exact replacement counts; no writes occur.
   * @param {() => Promise<RestorableWorkspace>} load - Explicit source reader.
   * @returns {Promise<void>} Read-only review bound to the latest selection. */
  async function prepare(load: () => Promise<RestorableWorkspace>) {
    const selection = ++sequence.current;
    setStaged(null);
    setAcknowledged(false);
    setConfirmation('');
    setCompleted(null);
    setError('');
    setBusy(true);
    try {
      const source = await load();
      const review = await reviewWorkspace(source);
      if (sequence.current === selection) {
        setStaged({ source, review, workspace: data, identity });
      }
    } catch (failure) {
      if (sequence.current === selection) {
        setError(failure instanceof Error ? failure.message : 'Unable to prepare this import.');
      }
    } finally {
      if (sequence.current === selection) {
        setBusy(false);
      }
    }
  }
  /** Select a bounded workspace export and validate its complete graph.
   * @param {File | undefined} file - Source JSON. @returns {Promise<void>} Read-only review. */
  async function choose(file?: File) {
    if (!file) {
      cancel();
      return;
    }
    await prepare(async () => {
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
      return parseBackup(text);
    });
  }
  /** Replace only a still-current, acknowledged source after exact typed confirmation.
   * @returns {Promise<void>} Durable result, distinguishing refresh failure. */
  async function restore() {
    if (!reviewed || !acknowledged || confirmation !== BACKUP.confirmation || isBusy) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      await importWorkspace(reviewed.source, reviewed.review.revision);
      setStaged(null);
      setAcknowledged(false);
      setConfirmation('');
      setCompleted({ identity });
      setNotice('Workspace imported. Imported schedules are paused until you resume them.');
      try {
        await reload();
      } catch {
        setError('Import saved. Refresh the page to load the updated workspace.');
      }
    } catch (failure) {
      setStaged(null);
      setAcknowledged(false);
      setConfirmation('');
      setError(failure instanceof Error ? failure.message : 'Unable to import. Storage was not updated.');
    } finally {
      setBusy(false);
    }
  }
  /** Discard pending source results without touching storage. @returns {void} Cancelled review. */
  function cancel() {
    sequence.current += 1;
    setStaged(null);
    setAcknowledged(false);
    setConfirmation('');
    setBusy(false);
  }
  return {
    reviewed,
    acknowledged,
    setAcknowledged,
    confirmation,
    setConfirmation,
    didReplace,
    error,
    isBusy,
    prepare,
    choose,
    restore,
    cancel,
  };
}
export type WorkspaceImporter = ReturnType<typeof useBackupRestore>;

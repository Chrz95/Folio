import { useEffect, useRef, useState } from 'react';
import { useWorkspace } from '../../app/WorkspaceContext';
import { BACKUP } from './backup.constants';
import { deleteAllData, reviewDeletion } from './workspaceDeleteService';
import type { DeletionReview } from './workspaceDeleteService';
/** Stage explicit deletion without executing it until both confirmation controls and the review are current.
 * @returns {object} Dialog state and destructive action. */
export function useDeleteData() {
  const { data, reload, setNotice, setError } = useWorkspace();
  const [isOpen, setOpen] = useState(false);
  const [busy, setBusy] = useState<'review' | 'delete' | null>(null);
  const [staged, setStaged] = useState<{ review: DeletionReview; data: typeof data } | null>(null);
  const [word, setWord] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setFailure] = useState('');
  const sequence = useRef(0);
  useEffect(
    () => () => {
      sequence.current += 1;
    },
    [],
  );
  const review = staged?.data === data ? staged.review : null;
  /** Prepare counts without changing any data. @returns {Promise<void>} Ready confirmation dialog. */
  async function prepare() {
    const selection = ++sequence.current;
    setOpen(true);
    setBusy('review');
    setStaged(null);
    setWord('');
    setAcknowledged(false);
    setFailure('');
    try {
      const next = await reviewDeletion();
      if (selection === sequence.current) {
        setStaged({ review: next, data });
      }
    } catch (failure) {
      if (selection === sequence.current) {
        setFailure(failure instanceof Error ? failure.message : 'Review failed.');
      }
    } finally {
      if (selection === sequence.current) {
        setBusy(null);
      }
    }
  }
  /** Cancel a review without any writes. Active commits cannot be dismissed mid-write. @returns {void} Closed. */
  function cancel() {
    if (busy === 'delete') {
      return;
    }
    sequence.current += 1;
    setOpen(false);
    setStaged(null);
    setWord('');
    setAcknowledged(false);
    setBusy(null);
  }
  /** Execute only the explicitly confirmed current review and distinguish reload/cleanup errors from failed deletion.
   * @returns {Promise<void>} Durable completion feedback. */
  async function remove() {
    if (!review || busy || !acknowledged || word !== BACKUP.deleteWord) {
      return;
    }
    setBusy('delete');
    setFailure('');
    try {
      const localCleared = await deleteAllData(review, word, acknowledged);
      setStaged(null);
      setOpen(false);
      setWord('');
      setAcknowledged(false);
      setNotice(
        localCleared
          ? 'All app data deleted.'
          : 'App data deleted. Some browser preferences could not be cleared; clear Folio site data to finish.',
      );
      try {
        await reload();
      } catch {
        setError('Data deleted. Refresh the page to load the empty workspace.');
      }
      window.dispatchEvent(new Event(BACKUP.deleteEvent));
    } catch (failure) {
      setStaged(null);
      setWord('');
      setAcknowledged(false);
      setFailure(failure instanceof Error ? failure.message : 'Deletion failed.');
    } finally {
      setBusy(null);
    }
  }
  return { isOpen, busy, review, word, setWord, acknowledged, setAcknowledged, error, prepare, cancel, remove };
}
export type DeleteDataState = ReturnType<typeof useDeleteData>;

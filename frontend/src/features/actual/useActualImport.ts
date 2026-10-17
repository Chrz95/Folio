import { useEffect, useMemo, useRef, useState } from 'react';
import { useWorkspace } from '../../app/WorkspaceContext';
import type { ActualFile } from './actualSchema';
import type { ActualReview } from './actualMerge';
import { readActualFile } from './actualFile';
import { previewActual, commitActual } from './actualService';
/** Own selection cancellation, scope-bound review and durable completion feedback.
 * @returns {object} Import workflow state and actions. */
export function useActualImport() {
  const { data, reload } = useWorkspace();
  const [source, setSource] = useState<ActualFile | null>(null);
  const [includeBudgets, setIncludeBudgets] = useState(true);
  const [includeSchedules, setIncludeSchedules] = useState(true);
  const [currency, setCurrency] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [isReading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ActualReview['added'] | null>(null);
  const [reviewed, setReviewed] = useState<{ file: ActualFile; data: typeof data; plan: ActualReview } | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const file = useMemo(
    () =>
      source && {
        ...source,
        monthlyBudgets: includeBudgets ? source.monthlyBudgets : [],
        recurring: includeSchedules ? source.recurring : [],
        scheduleSettings: includeSchedules ? source.scheduleSettings : [],
        transactions: includeSchedules
          ? source.transactions
          : source.transactions.map((row) => ({ ...row, recurringId: null })),
      },
    [source, includeBudgets, includeSchedules],
  );
  const sourceSummary = useMemo(
    () =>
      source && {
        total: source.recurring.length + source.exclusions.length,
        supported: source.recurring.length,
        ending: source.scheduleSettings.filter((row) => row.endDate).length,
        linked: source.transactions.filter((row) => row.recurringId).length,
      },
    [source],
  );
  const review = reviewed?.file === file && reviewed.data === data && currency ? reviewed.plan : null;
  /** Read a new explicit file; old worker results cannot replace the new selection.
   * @param {File} selected - Native ZIP. @returns {Promise<void>} Completed local read. */
  async function select(selected: File) {
    controller.current?.abort();
    const next = new AbortController();
    controller.current = next;
    setSource(null);
    setReviewed(null);
    setResult(null);
    setCurrency(false);
    setAcknowledged(false);
    setReading(true);
    setBusy(true);
    setError('');
    try {
      const decoded = await readActualFile(selected, next.signal);
      if (!next.signal.aborted) {
        setSource(decoded);
      }
    } catch (failure) {
      if (!next.signal.aborted) {
        setError(failure instanceof Error ? failure.message : 'Reading failed.');
      }
    } finally {
      if (controller.current === next) {
        setBusy(false);
        setReading(false);
      }
    }
  }
  /** Create a review after currency consent. @returns {Promise<void>} Exact additions. */
  async function preview() {
    if (!file || !currency) {
      return;
    }
    setBusy(true);
    setError('');
    setReviewed(null);
    setAcknowledged(false);
    try {
      setReviewed({ file, data, plan: await previewActual(file) });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Review failed.');
    } finally {
      setBusy(false);
    }
  }
  /** Save a still-current acknowledged review, distinguishing refresh failures from failed writes.
   * @returns {Promise<void>} Persistence feedback. */
  async function commit() {
    if (!file || !review || !acknowledged) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      const added = await commitActual(file, review.revision);
      setResult(added);
      setReviewed(null);
      try {
        await reload();
      } catch {
        setError('Import saved. Refresh the page to load the updated workspace.');
      }
    } catch (failure) {
      setReviewed(null);
      setAcknowledged(false);
      setError(failure instanceof Error ? failure.message : 'Import failed. Review and try again.');
    } finally {
      setBusy(false);
    }
  }
  /** Stop a pending worker read. @returns {void} Cancelled selection. */
  function cancel() {
    controller.current?.abort();
    setReading(false);
    setBusy(false);
  }
  return {
    isReading,
    sourceSummary,
    file,
    includeBudgets,
    setIncludeBudgets,
    includeSchedules,
    setIncludeSchedules,
    currency,
    setCurrency,
    acknowledged,
    setAcknowledged,
    busy,
    error,
    result,
    review,
    select,
    preview,
    commit,
    cancel,
  };
}
export type ActualWizard = ReturnType<typeof useActualImport>;

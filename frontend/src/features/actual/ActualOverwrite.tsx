import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { ActualFile } from './actualSchema';
import { actualReplacement } from './actualReplacement';
import { useBackupRestore } from '../backup/useBackupRestore';
import { WorkspaceImportReview } from '../backup/WorkspaceImportReview';
/** Review a full replacement separately from the default additive Actual import.
 * @param {object} props - Selected scope. @param {ActualFile | null} props.file - Converted source.
 * @param {boolean} props.currency - Explicit EUR consent.
 * @param {(value: boolean) => void} props.onBusyChange - Lock source controls during replacement.
 * @returns {JSX.Element} Overwrite controls. */
export function ActualOverwrite({
  file,
  currency,
  onBusyChange,
}: {
  file: ActualFile | null;
  currency: boolean;
  onBusyChange: (value: boolean) => void;
}) {
  const state = useBackupRestore(file, currency);
  useEffect(() => {
    onBusyChange(state.isBusy);
    return () => onBusyChange(false);
  }, [state.isBusy, onBusyChange]);
  return (
    <section className="panel actual-review">
      <h2>Overwrite from Actual Budget</h2>
      <p>
        This replaces the entire financial workspace with the selected Actual data, including conflicting records.
        Existing goals, receipts, reconciliations and data omitted from this import will be removed. Unsupported
        schedules are not recreated. Export a recovery copy in Settings before continuing.
      </p>
      {state.didReplace ? (
        <output>
          Financial workspace overwritten. <Link to="/recurring">Review imported schedules</Link>.
        </output>
      ) : (
        <button
          className="button primary"
          disabled={!file || !currency || state.isBusy}
          onClick={() => file && void state.prepare(async () => actualReplacement(file))}
        >
          {state.isBusy ? 'Preparing…' : 'Review overwrite'}
        </button>
      )}
      <WorkspaceImportReview state={state} />
      {state.error && (
        <p
          className="error-message"
          role="alert"
        >
          {state.error}
        </p>
      )}
    </section>
  );
}

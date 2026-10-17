import { useWorkspace } from '../../app/WorkspaceContext';
import type { Occurrence } from '../../types/budget';
interface ActionsProps {
  occurrence?: Occurrence;
}
/** Keep one-date skips separate from posting an actual payment.
 * @param {ActionsProps} props - Planned date. @param {Occurrence} props.occurrence - Optional next unpaid occurrence.
 * @returns {JSX.Element} Explicit payment or skip actions. */
export function OccurrenceActions({ occurrence }: ActionsProps) {
  const { pay, save, isSaving } = useWorkspace();
  return (
    <div className="occurrence-actions">
      <button
        type="button"
        className="text-button"
        disabled={isSaving || !occurrence}
        onClick={() => occurrence && void pay(occurrence)}
      >
        Mark paid
      </button>
      <button
        type="button"
        className="text-button"
        disabled={isSaving || !occurrence}
        onClick={() =>
          occurrence &&
          void save('skippedOccurrences', 'PUT', { recurringId: occurrence.id, date: occurrence.date, isSkipped: true })
        }
      >
        Skip this occurrence
      </button>
    </div>
  );
}

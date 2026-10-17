import { Check, SkipForward } from 'lucide-react';
import { useWorkspace } from '../../app/WorkspaceContext';
import type { Occurrence } from '../../types/budget';
interface ActionsProps {
  occurrence?: Occurrence;
  isPaused?: boolean;
}
/** Keep one-date skips separate from posting an actual payment.
 * @param {ActionsProps} props - Planned date. @param {Occurrence} props.occurrence - Optional next unpaid occurrence.
 * @param {boolean} props.isPaused - Disable posting until the schedule resumes.
 * @returns {JSX.Element} Explicit payment or skip actions. */
export function OccurrenceActions({ occurrence, isPaused = false }: ActionsProps) {
  const { pay, save, isSaving } = useWorkspace();
  return (
    <div className="occurrence-actions">
      <button
        type="button"
        className="icon-button schedule-action"
        disabled={isSaving || !occurrence || isPaused}
        aria-label="Mark paid"
        title={isPaused ? 'Resume this schedule before confirming a payment.' : 'Mark paid'}
        onClick={() => occurrence && !isPaused && void pay(occurrence)}
      >
        <Check
          size={17}
          aria-hidden="true"
        />
      </button>
      <button
        type="button"
        className="icon-button schedule-action"
        aria-label="Skip this occurrence"
        title="Skip this occurrence"
        disabled={isSaving || !occurrence}
        onClick={() =>
          occurrence &&
          void save('skippedOccurrences', 'PUT', { recurringId: occurrence.id, date: occurrence.date, isSkipped: true })
        }
      >
        <SkipForward
          size={17}
          aria-hidden="true"
        />
      </button>
    </div>
  );
}

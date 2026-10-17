import type { ActualReview } from './actualMerge';
import type { ActualFile } from './actualSchema';
import { ACTUAL } from './actual.constants';
/** Explain source progress additions separately from recorded payments, including upgrades of old imports.
 * @param {object} props - Import review. @param {ActualReview} props.review - Authoritative additions.
 * @param {ActualFile | null} props.file - Current source. @returns {JSX.Element | null} Reversible progress review. */
export function ActualProgressReview({ review, file }: { review: ActualReview; file: ActualFile | null }) {
  const rows = review.rows.skippedOccurrences;
  if (!rows.length) {
    return null;
  }
  return (
    <details
      className="actual-schedule-review"
      open
    >
      <summary>{rows.length} advanced Actual dates to keep skipped</summary>
      <p>
        These dates precede Actual's next due date or belong to a completed schedule. They are reversible skips, not
        confirmed payments. Existing postings and pause controls stay unchanged.
      </p>
      <ul>
        {rows.slice(0, ACTUAL.previewRows).map((row) => (
          <li key={`${row.recurringId}:${row.date}`}>
            {file?.recurring.find((rule) => rule.id === row.recurringId)?.name} · {row.date}
          </li>
        ))}
      </ul>
      <p>Review every date in Download complete review. Restore a skipped date in Recurring → Schedule controls.</p>
    </details>
  );
}

import type { ActualFile } from './actualSchema';
import { ACTUAL } from './actual.constants';
import { money } from '../../utils/format';
/** Show the exact new schedules, estimates and controls before the user commits.
 * @param {object} props - Reviewed additions and source catalog. @returns {JSX.Element | null} Schedule review. */
export function ActualScheduleReview({ rows, file }: { rows: ActualFile['recurring']; file: ActualFile }) {
  if (!rows.length) {
    return null;
  }
  return (
    <details
      className="actual-schedule-review"
      open
    >
      <summary>{rows.length} recurring transactions to add · all paused</summary>
      <p>Check amounts and dates here. After import, open Recurring to edit and resume each schedule.</p>
      <ul>
        {rows.slice(0, ACTUAL.previewRows).map((row) => (
          <li key={row.id}>
            <strong>{row.name}</strong> · {money(row.amount)} · {row.type} · {row.frequency}
            <p>
              From {row.date} · {file.accounts.find((account) => account.id === row.accountId)?.name}
              {row.destinationAccountId &&
                ` → ${file.accounts.find((account) => account.id === row.destinationAccountId)?.name}`}
              {' · '}
              {row.category}
            </p>
            {file.scheduleSettings.find((setting) => setting.recurringId === row.id)?.endDate && (
              <p>Ends {file.scheduleSettings.find((setting) => setting.recurringId === row.id)?.endDate}</p>
            )}
            {row.notes && <p className="actual-schedule-notes">{row.notes}</p>}
          </li>
        ))}
      </ul>
      {rows.length > ACTUAL.previewRows && <p>Download the complete review for every schedule.</p>}
    </details>
  );
}

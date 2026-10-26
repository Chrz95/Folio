import type { RecurringRow } from './recurringRows';
import { PAYMENT_LABEL, paymentStatus } from '../calendar/calendarEntries';
import { FREQUENCY_LABEL } from '../../constants/app.constants';
import { formatDate, money } from '../../utils/format';
import { useWorkspace } from '../../app/WorkspaceContext';
import { RecurringRowActions } from './RecurringRowActions';
/** Display one recurring rule with a separate confirmation state and pause/end controls.
 * @param {object} props - Display data. @param {RecurringRow} props.row - Computed schedule row.
 * @param {string} props.today - Current local date. @returns {JSX.Element} One semantic table row. */
export function RecurringTableRow({ row, today }: { row: RecurringRow; today: string }) {
  const { data } = useWorkspace();
  const { template, closest, isPaused, endDate } = row;
  const status = closest ? paymentStatus(closest.date, false, today) : null;
  return (
    <tr>
      <th scope="row">
        <strong>{template.name}</strong>
        <span className={`type-pill ${template.type}`}>{template.type}</span>
        <small>
          {template.category} · {data.accounts.find((account) => account.id === template.accountId)?.name}
        </small>
      </th>
      <td
        data-label="Amount"
        className="recurring-table-amount"
      >
        {money(template.amount)}
      </td>
      <td data-label="Frequency">{FREQUENCY_LABEL[template.frequency]}</td>
      <td data-label="Closest unconfirmed">
        {closest ? (
          <time dateTime={closest.date}>
            {formatDate(closest.date, { day: 'numeric', month: 'short', year: 'numeric' })}
          </time>
        ) : (
          'No unconfirmed dates'
        )}
        {endDate && <small>Ends {formatDate(endDate, { day: 'numeric', month: 'short', year: 'numeric' })}</small>}
      </td>
      <td data-label="Remaining unconfirmed">
        {row.remaining === null ? <span aria-label="Infinite unconfirmed transactions">∞</span> : row.remaining}
      </td>
      <td data-label="Status">
        {status && <span className={`payment-status ${status}`}>{PAYMENT_LABEL[status]}</span>}
        {isPaused && <span className="recurring-pause">Paused</span>}
        {data.scheduleSettings?.some((control) => control.recurringId === template.id && control.autoConfirm) && (
          <small>Automatic confirmation{isPaused ? ' · paused' : ''}</small>
        )}
        {!closest && !isPaused && <span>No pending dates</span>}
        {row.overdue > 0 && (
          <small>
            {row.overdue} overdue {row.overdue === 1 ? 'date' : 'dates'}
          </small>
        )}
      </td>
      <td data-label="Actions">
        <RecurringRowActions row={row} />
      </td>
    </tr>
  );
}

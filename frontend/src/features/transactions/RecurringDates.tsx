import { useWorkspace } from '../../app/WorkspaceContext';
import type { TransactionFormState } from './useTransactionForm';
import { editorOccurrences } from './editorOccurrences';
import { PAYMENT_LABEL, paymentStatus } from '../calendar/calendarEntries';
import { formatDate } from '../../utils/format';
import { useToday } from '../../hooks/useToday';
/** Preview the editable recurrence without posting or enabling reminders.
 * @param {object} props - Editor state. @param {TransactionFormState} props.form - Draft dates/frequency.
 * @returns {JSX.Element | null} Upcoming and overdue planned dates. */
export function RecurringDates({ form }: { form: TransactionFormState }) {
  const { data } = useWorkspace();
  const today = useToday();
  if (!form.isRecurring) {
    return null;
  }
  const template = {
    id: form.original?.id ?? 'draft',
    name: '',
    amount: 1,
    type: form.type,
    category: '',
    accountId: '',
    destinationAccountId: null,
    notes: '',
    reminderDays: 0,
    date: form.scheduleDate,
    frequency: form.frequency,
  };
  const previewData = {
    ...data,
    scheduleSettings: [
      ...(data.scheduleSettings ?? []).filter((row) => row.recurringId !== template.id),
      {
        recurringId: template.id,
        isPaused: data.scheduleSettings?.some((row) => row.recurringId === template.id && row.isPaused) ?? false,
        endDate: form.ending.resolved,
      },
    ],
  };
  const dates = form.ending.error ? [] : editorOccurrences(previewData, template);
  const control = previewData.scheduleSettings.find((row) => row.recurringId === template.id);
  return (
    <section
      className="editor-date-preview"
      aria-labelledby="recurring-dates-title"
      aria-live="polite"
    >
      <h3 id="recurring-dates-title">Scheduled dates</h3>
      <p>The next six unconfirmed dates, including overdue dates. Changes apply after you save.</p>
      {control?.isPaused && <p>Paused · dates remain visible; reminders and confirmation stay disabled.</p>}
      {control?.endDate && <p>Last allowed payment: {formatDate(control.endDate)}</p>}
      <ol>
        {dates.map((row) => {
          const status = paymentStatus(row.date, false, today);
          return (
            <li key={row.date}>
              <time dateTime={row.date}>
                {formatDate(row.date, { day: 'numeric', month: 'short', year: 'numeric' })}
              </time>
              <span className={`payment-status ${status}`}>{PAYMENT_LABEL[status]}</span>
            </li>
          );
        })}
      </ol>
      {!dates.length && <p>No unconfirmed dates remain for this rule. Check the due date, ending and skipped dates.</p>}
      {form.original && (
        <p>
          Schedule anchor: {form.scheduleDate}. Changing the due date starts the recurrence from that date. Recorded
          payments and pause controls stay unchanged. A changed recurrence pattern clears prior skips.
        </p>
      )}
    </section>
  );
}
